import { normalizeCurrency } from "../../shared/currency.js";
import { getDatabase } from "../database.js";

interface AccountRow {
  id: number;
  display_name: string | null;
  account_group: string | null;
  account_number: string;
  provider_name: string;
}

interface CashFlowTotal {
  currency: string;
  income: number;
  expenses: number;
  net: number;
}

export interface CashFlowResult {
  accounts: Array<{ id: number; name: string; displayName: string | null; group: string | null }>;
  totals: CashFlowTotal[];
  breakdown: Array<{ accountId: number; totals: CashFlowTotal[] }>;
}

interface CashFlowFilters {
  from: string;
  to: string;
  group?: string;
  accountId?: number;
}

interface Movement {
  id: number;
  accountId: number;
  amount: number;
  currency: string;
  date: string;
  processedDate: string;
  providerType: "bank" | "credit_card";
  companyId: string;
  classification: string | null;
  identifier: string | null;
  details: string;
  inRange: boolean;
}

const cardIssuers = [
  { companyId: "visaCal", pattern: /(?:visa\s+cal|כ[.״"'׳]?א[.״"'׳]?ל)/iu },
  { companyId: "max", pattern: /(?<![\p{L}\p{N}])(?:max|מקס|לאומי קארד)(?![\p{L}\p{N}])/iu },
  { companyId: "isracard", pattern: /(?:isracard|ישראכרט)/iu },
  { companyId: "amex", pattern: /(?:amex|american express|אמריקן\s+אקספרס)/iu },
];

function roundAmount(value: number): number {
  return Number(value.toFixed(8));
}

function containsAccountReference(details: string, accountNumber: string | undefined): boolean {
  if (!accountNumber || accountNumber.replace(/\D/g, "").length < 6) return false;
  const accountPattern = accountNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(?<!\\d)" + accountPattern + "(?!\\d)").test(details);
}

function sameTransferReference(a: Movement, b: Movement, accountNumbers: Map<number, string>): boolean {
  const reference = a.identifier?.trim();
  if (reference && reference.length >= 6 && reference === b.identifier?.trim()) return true;
  return containsAccountReference(a.details, accountNumbers.get(b.accountId))
    && containsAccountReference(b.details, accountNumbers.get(a.accountId));
}

function appendToGroup<T>(map: Map<string, T[]>, key: string, value: T): void {
  const group = map.get(key);
  if (group) group.push(value);
  else map.set(key, [value]);
}

function uniquePairs<T extends { id: number }>(pairs: Array<[Movement, T]>): Array<[Movement, T]> {
  const left = new Map<number, number>();
  const right = new Map<number, number>();
  for (const [a, b] of pairs) {
    left.set(a.id, (left.get(a.id) ?? 0) + 1);
    right.set(b.id, (right.get(b.id) ?? 0) + 1);
  }
  return pairs.filter(([a, b]) => left.get(a.id) === 1 && right.get(b.id) === 1);
}

function matchedTransfers(movements: Movement[], accountNumbers: Map<number, string>): number[] {
  const transfers = movements.filter(row => row.inRange && row.providerType === "bank"
    && row.classification === "transfer" && row.amount !== 0);
  const incoming = new Map<string, Movement[]>();
  for (const row of transfers) {
    if (row.amount > 0) appendToGroup(incoming, JSON.stringify([row.currency, roundAmount(row.amount)]), row);
  }

  const pairs: Array<[Movement, Movement]> = [];
  // A matching amount narrows the candidates. Both sides still need a transfer
  // classification and corroboration from their stored references.
  for (const debit of transfers) {
    if (debit.amount >= 0) continue;
    const key = JSON.stringify([debit.currency, roundAmount(-debit.amount)]);
    for (const credit of incoming.get(key) ?? []) {
      const daysApart = Math.abs(Date.parse(debit.date) - Date.parse(credit.date)) / 86_400_000;
      if (debit.accountId !== credit.accountId && daysApart <= 2
        && sameTransferReference(debit, credit, accountNumbers)) {
        pairs.push([debit, credit]);
      }
    }
  }
  return uniquePairs(pairs).flatMap(([debit, credit]) => [debit.id, credit.id]);
}

function matchedCardDebits(movements: Movement[]): number[] {
  interface Statement {
    id: number;
    amount: number;
    covered: boolean;
    hasBillingDate: boolean;
  }

  const statements = new Map<string, Statement>();
  const statementsByIssuer = new Map<string, Statement[]>();
  for (const card of movements) {
    if (card.providerType !== "credit_card") continue;
    const issuerKey = JSON.stringify([card.companyId, card.currency, card.processedDate]);
    const statementKey = JSON.stringify([issuerKey, card.accountId]);
    let statement = statements.get(statementKey);
    if (!statement) {
      statement = { id: card.id, amount: 0, covered: true, hasBillingDate: false };
      statements.set(statementKey, statement);
      appendToGroup(statementsByIssuer, issuerKey, statement);
    }
    statement.amount += card.amount;
    statement.covered &&= card.inRange;
    statement.hasBillingDate ||= card.processedDate !== card.date;
  }

  const pairs: Array<[Movement, Statement]> = [];
  for (const debit of movements) {
    if (!debit.inRange || debit.providerType !== "bank"
      || debit.classification !== "cc_billing" || debit.amount >= 0) continue;
    const issuers = cardIssuers.filter(({ pattern }) => pattern.test(debit.details));
    if (issuers.length !== 1) continue;
    const issuerKey = JSON.stringify([issuers[0].companyId, debit.currency, debit.date]);
    for (const statement of statementsByIssuer.get(issuerKey) ?? []) {
      if (statement.covered && statement.hasBillingDate && roundAmount(statement.amount) === roundAmount(debit.amount)) {
        pairs.push([debit, statement]);
      }
    }
  }
  return uniquePairs(pairs).map(([debit]) => debit.id);
}

function summarize(movements: Movement[], omitted?: ReadonlySet<number>): CashFlowTotal[] {
  const totals = new Map<string, CashFlowTotal>();
  for (const row of movements) {
    const total = totals.get(row.currency) ?? { currency: row.currency, income: 0, expenses: 0, net: 0 };
    totals.set(row.currency, total);
    if (omitted?.has(row.id)) continue;
    if (row.amount >= 0) total.income += row.amount;
    else total.expenses -= row.amount;
  }
  return Array.from(totals.values(), ({ currency, income, expenses }) => ({
    currency,
    income: roundAmount(income),
    expenses: roundAmount(expenses),
    net: roundAmount(income - expenses),
  })).sort((a, b) => a.currency.localeCompare(b.currency));
}

export function getCashFlow(filters: CashFlowFilters): CashFlowResult {
  const db = getDatabase();
  const { accounts, selected, movements } = db.transaction(() => {
    const accounts = db.prepare(
      `SELECT a.id, a.display_name, a.account_group, a.account_number, p.display_name AS provider_name
       FROM accounts a JOIN providers p ON p.id = a.provider_id
       WHERE a.excluded = 0
       ORDER BY p.display_name, a.id`,
    ).all() as AccountRow[];

    const selected = accounts.filter(account =>
      (filters.group === undefined || account.account_group === filters.group)
      && (filters.accountId === undefined || account.id === filters.accountId));

    if (selected.length === 0) return { accounts, selected, movements: [] };

    // Fetch full available card batches as well as the visible rows. If any
    // detail in a batch falls outside the report range, keep the bank debit.
    const rows = db.prepare(
      `SELECT t.id, t.account_id AS accountId, t.charged_amount AS amount,
         COALESCE(NULLIF(TRIM(t.charged_currency), ''), a.currency) AS currency,
         SUBSTR(t.date, 1, 10) AS date, SUBSTR(t.processed_date, 1, 10) AS processedDate,
         p.type AS providerType, p.company_id AS companyId, c.classification, t.identifier,
         t.description || ' ' || COALESCE(t.memo, '') AS details
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       JOIN providers p ON p.id = a.provider_id
       LEFT JOIN categories c ON c.name = t.category
       WHERE t.status = 'completed'
         AND t.account_id IN (SELECT value FROM json_each($accountIds))
         AND ((t.date BETWEEN $from AND $through)
           OR (p.type = 'credit_card' AND t.processed_date BETWEEN $from AND $through))`,
    ).all({
      $accountIds: JSON.stringify(selected.map(account => account.id)),
      $from: filters.from,
      $through: filters.to + "\uffff",
    }) as Array<Omit<Movement, "inRange">>;

    const movements = rows.map(row => ({
      ...row,
      currency: normalizeCurrency(row.currency.trim()).toUpperCase(),
      inRange: row.date >= filters.from && row.date <= filters.to,
    }));
    return { accounts, selected, movements };
  })();

  const visible = movements.filter(row => row.inRange);
  const accountNumbers = new Map(selected.map(account => [account.id, account.account_number]));
  const omitted = new Set([...matchedTransfers(movements, accountNumbers), ...matchedCardDebits(movements)]);
  const byAccount = new Map<string, Movement[]>();
  for (const row of visible) appendToGroup(byAccount, String(row.accountId), row);

  return {
    accounts: accounts.map(account => ({
      id: account.id,
      name: account.display_name?.trim() || (account.account_number.length > 4
        ? account.provider_name + " · ••••" + account.account_number.slice(-4)
        : account.provider_name + " #" + account.id),
      displayName: account.display_name,
      group: account.account_group,
    })),
    totals: summarize(visible, omitted),
    breakdown: selected.map(account => ({
      accountId: account.id,
      totals: summarize(byAccount.get(String(account.id)) ?? []),
    })),
  };
}

export function updateAccountOrganization(id: number, name: string | null, group: string | null): boolean {
  const result = getDatabase().prepare(
    "UPDATE accounts SET display_name = $name, account_group = $group WHERE id = $id AND excluded = 0",
  ).run({ $id: id, $name: name, $group: group });
  return result.changes > 0;
}
