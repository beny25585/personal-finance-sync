import { createHash } from "node:crypto";
import { getDatabase } from "../db/database.js";
import { getAccount, upsertAccount } from "../db/repositories/accounts.js";
import { ensureCategoryWithClassification } from "../db/repositories/categories.js";
import {
  createProvider, getProviderByAlias, MONEYTOR_ALIAS, MONEYTOR_COMPANY,
} from "../db/repositories/providers.js";
import { upsertTransaction } from "../db/repositories/transactions.js";
import {
  getMoneytorAssets, getMoneytorTransactions, MoneytorError,
  type MoneytorAsset, type MoneytorTransaction,
} from "./moneytor-client.js";

interface AccountRow {
  id: string;
  label: string;
  bank: string | null;
  suffix: string;
  selected: number;
  localAccountId: number | null;
}

export interface MoneytorStatus {
  configured: boolean;
  accounts: { id: string; label: string; bank: string | null; selected: boolean }[];
  lastSync: string | null;
}

interface DateRange { from: string; to: string }
type BankAsset = MoneytorAsset & { externalId: string };

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function assetById(assets: MoneytorAsset[]): Map<string, BankAsset> {
  const result = new Map<string, BankAsset>();
  const duplicates = new Set<string>();
  for (const asset of assets) {
    if (!asset.externalId || asset.isChecking === false) continue;
    if (result.has(asset.externalId)) duplicates.add(asset.externalId);
    result.set(asset.externalId, { ...asset, externalId: asset.externalId });
  }
  for (const id of duplicates) result.delete(id);
  return result;
}

function readAccounts(): AccountRow[] {
  return getDatabase().prepare(
    `SELECT id, label, bank, suffix, selected, local_account_id AS localAccountId
     FROM moneytor_accounts WHERE available = 1 ORDER BY label, id`,
  ).all() as AccountRow[];
}

export function moneytorStatus(configured: boolean): MoneytorStatus {
  return {
    configured,
    accounts: configured ? readAccounts().map(({ id, label, bank, selected }) => ({
      id, label, bank, selected: selected === 1,
    })) : [],
    lastSync: (getDatabase().prepare("SELECT last_sync AS lastSync FROM moneytor_sync WHERE id = 1")
      .get() as { lastSync: string } | null)?.lastSync ?? null,
  };
}

export function clearMoneytorSelection(): void {
  const db = getDatabase();
  db.transaction(() => {
    db.run("UPDATE moneytor_accounts SET available = 0, selected = 0");
    db.run("DELETE FROM moneytor_accounts WHERE local_account_id IS NULL");
  }).immediate();
}

export async function discoverMoneytorAccounts(token: string, range: DateRange): Promise<MoneytorStatus> {
  const [assets, transactions] = await Promise.all([
    getMoneytorAssets(token), getMoneytorTransactions(token, range.from, range.to),
  ]);
  const linked = assetById(assets);
  const checking = new Map<string, Set<string>>();
  for (const row of transactions) {
    if (row.type !== "CHECKING" || !row.accountId || !row.bookingDate) continue;
    const suffixes = checking.get(row.accountId) ?? new Set<string>();
    const suffix = row.accountNumber?.match(/\d{4}$/)?.[0];
    if (suffix && row.category !== "CREDIT_CARD_CHECKING") suffixes.add(suffix);
    checking.set(row.accountId, suffixes);
  }
  const db = getDatabase();
  const saveAccount = db.prepare(
    `INSERT INTO moneytor_accounts (id, label, bank, suffix, available)
     VALUES ($id, $label, $bank, $suffix, 1)
     ON CONFLICT(id) DO UPDATE SET label = excluded.label, bank = excluded.bank,
       suffix = excluded.suffix, available = 1`,
  );
  db.transaction(() => {
    const prior = new Map(readAccounts().filter(row => row.selected).map(row => [row.id, row.suffix]));
    db.run("UPDATE moneytor_accounts SET available = 0");
    for (const asset of linked.values()) {
      const id = hashKey(asset.externalId);
      const suffixes = checking.get(asset.externalId);
      if (!suffixes && !prior.has(id)) continue;
      const suffix = asset.accountNumber?.match(/\d{4}$/)?.[0]
        ?? prior.get(id) ?? (suffixes?.size === 1 ? Array.from(suffixes)[0] : undefined);
      if (!suffix || (suffixes && Array.from(suffixes).some(value => value !== suffix))) continue;
      const bank = asset.bank?.replace(/[\u0000-\u001f\u007f]|\d{5,}/g, "").trim().slice(0, 60) || null;
      const label = `${bank || "Moneytor"} · ••••${suffix}`;
      saveAccount.run({ $id: id, $label: label, $bank: bank, $suffix: suffix });
    }
    db.run("UPDATE moneytor_accounts SET selected = 0 WHERE available = 0");
    db.run("DELETE FROM moneytor_accounts WHERE available = 0 AND local_account_id IS NULL");
  }).immediate();
  return moneytorStatus(true);
}

export function saveMoneytorAccounts(ids: string[]): MoneytorStatus {
  const db = getDatabase();
  db.transaction(() => {
    const candidates = new Set(readAccounts().map(account => account.id));
    if (ids.some(id => !candidates.has(id))) throw new MoneytorError("invalidSelection");
    db.prepare(
      `UPDATE moneytor_accounts SET selected = id IN (SELECT value FROM json_each($ids))
       WHERE available = 1`,
    ).run({ $ids: JSON.stringify(ids) });
  }).immediate();
  return moneytorStatus(true);
}

function checkOverlap(accounts: AccountRow[], range: DateRange): void {
  const db = getDatabase();
  const replacedAccount = db.prepare(
    `SELECT 1 FROM moneytor_accounts
     WHERE id != $id AND suffix = $suffix AND local_account_id IS NOT NULL LIMIT 1`,
  );
  const otherSource = db.prepare(
    `SELECT 1 FROM accounts a JOIN providers p ON p.id = a.provider_id
     JOIN transactions t ON t.account_id = a.id
     WHERE p.alias != $alias AND p.type = 'bank'
       AND ((t.date BETWEEN $from AND $through) OR (t.processed_date BETWEEN $from AND $through))
       AND (substr(trim(a.account_number), -4) = $suffix
         OR trim(a.account_number) NOT GLOB '*[0-9][0-9][0-9][0-9]')
     LIMIT 1`,
  );
  for (const { id, suffix, localAccountId } of accounts) {
    if ((!localAccountId && replacedAccount.get({ $id: id, $suffix: suffix }))
      || otherSource.get({ $alias: MONEYTOR_ALIAS, $from: range.from, $through: range.to + "\uffff", $suffix: suffix })) {
      throw new MoneytorError("overlappingSource");
    }
  }
}

function storeMovement(
  accountId: number, tx: MoneytorTransaction, date: string, hash: string,
): "inserted" | "updated" | "unchanged" {
  const description = tx.description ?? "";
  const category = tx.category === "CREDIT_CARD_CHECKING" || tx.category === "BANK_TRANSFER" ? tx.category : null;
  if (category) ensureCategoryWithClassification(category, category === "CREDIT_CARD_CHECKING" ? "cc_billing" : "transfer");

  // The general upsert preserves an already-completed movement. For an exact
  // Moneytor ID, apply corrections to provider fields without replacing user tags.
  const correction = getDatabase().prepare(
    `UPDATE transactions SET date = $date, processed_date = $date,
       original_amount = $amount, charged_amount = $amount, original_currency = $currency,
       charged_currency = $currency, description = $description, memo = $memo,
       updated_at = datetime('now')
     WHERE account_id = $accountId AND hash = $hash
       AND (date IS NOT $date OR charged_amount IS NOT $amount OR charged_currency IS NOT $currency
         OR description IS NOT $description OR memo IS NOT $memo)`,
  ).run({
    $accountId: accountId, $hash: hash, $date: date, $amount: tx.amount,
    $currency: tx.currency, $description: description, $memo: tx.extraInfo,
  });
  if (correction.changes) return "updated";
  return upsertTransaction({
    accountId, type: "normal", identifier: tx.id, date, processedDate: date,
    originalAmount: tx.amount, chargedAmount: tx.amount,
    originalCurrency: tx.currency, chargedCurrency: tx.currency,
    description, memo: tx.extraInfo, category, status: "completed", hash, uniqueId: hash,
  }).action;
}

export async function syncMoneytor(token: string, range: DateRange) {
  const selected = readAccounts().filter(row => row.selected);
  if (!selected.length) throw new MoneytorError("noAccounts");
  const [assets, transactions] = await Promise.all([
    getMoneytorAssets(token), getMoneytorTransactions(token, range.from, range.to),
  ]);
  const linked = new Map(Array.from(assetById(assets).values(), asset => [hashKey(asset.externalId), asset]));
  const selectedByExternalId = new Map<string, AccountRow>();
  for (const row of selected) {
    const asset = linked.get(row.id);
    const suffix = asset?.accountNumber?.match(/\d{4}$/)?.[0];
    if (!asset || (suffix && suffix !== row.suffix)) throw new MoneytorError("invalidSelection");
    selectedByExternalId.set(asset.externalId, row);
  }

  const movements: Array<{ row: AccountRow; tx: MoneytorTransaction; date: string; hash: string }> = [];
  const receivedHashes = new Map<string, Set<string>>();
  for (const tx of transactions) {
    const row = tx.accountId && selectedByExternalId.get(tx.accountId);
    const date = tx.bookingDate;
    if (!row || tx.type !== "CHECKING" || !date || date < range.from || date > range.to) continue;
    const suffix = tx.accountNumber?.match(/\d{4}$/)?.[0];
    // The documented card settlement can carry the card's masked number.
    if (suffix && suffix !== row.suffix && tx.category !== "CREDIT_CARD_CHECKING") {
      throw new MoneytorError("invalidResponse");
    }
    const hash = hashKey("moneytor:" + tx.id);
    movements.push({ row, tx, date, hash });
    const accountHashes = receivedHashes.get(row.id) ?? new Set<string>();
    accountHashes.add(hash);
    receivedHashes.set(row.id, accountHashes);
  }

  const db = getDatabase();
  return db.transaction(() => {
    const current = readAccounts().filter(row => row.selected);
    const currentById = new Map(current.map(row => [row.id, row]));
    if (current.length !== selected.length || selected.some(row => currentById.get(row.id)?.suffix !== row.suffix)) {
      throw new MoneytorError("invalidSelection");
    }
    checkOverlap(current, range);
    for (const row of current) {
      if (row.localAccountId && getAccount(row.localAccountId)?.excluded) {
        throw new MoneytorError("invalidSelection");
      }
    }
    // A previous ID that vanished while a matching row appeared may have
    // changed at the source. Reject the overlap instead of guessing.
    const matchingHistory = db.prepare(
      `SELECT hash FROM transactions WHERE account_id = $localId AND date = $date
       AND charged_amount = $amount AND charged_currency = $currency AND description = $description
       AND hash != $hash`,
    );
    for (const { row, tx, date, hash } of movements) {
      const localId = currentById.get(row.id)?.localAccountId;
      if (!localId) continue;
      const matches = matchingHistory.all({
        $localId: localId, $date: date, $amount: tx.amount, $currency: tx.currency,
        $description: tx.description ?? "", $hash: hash,
      }) as Array<{ hash: string }>;
      if (matches.some(match => !receivedHashes.get(row.id)?.has(match.hash))) {
        throw new MoneytorError("overlappingSource");
      }
    }
    let provider = getProviderByAlias(MONEYTOR_ALIAS);
    const localIds = new Map<string, number>();
    const lastSync = new Date().toISOString();
    let imported = 0;
    let updated = 0;
    for (const { row, tx, date, hash } of movements) {
      provider ??= createProvider(MONEYTOR_COMPANY, "Moneytor", "bank", MONEYTOR_ALIAS);
      let localId = localIds.get(row.id) ?? currentById.get(row.id)?.localAccountId;
      if (!localId) {
        localId = upsertAccount(provider.id, `${row.id}:${row.suffix}`, MONEYTOR_COMPANY).id;
        db.prepare("UPDATE accounts SET display_name = $label WHERE id = $id").run({ $label: row.label, $id: localId });
        db.prepare("UPDATE moneytor_accounts SET local_account_id = $localId WHERE id = $id")
          .run({ $localId: localId, $id: row.id });
      }
      localIds.set(row.id, localId);
      const action = storeMovement(localId, tx, date, hash);
      if (action === "inserted") imported++;
      if (action === "updated") updated++;
    }
    db.prepare(`INSERT INTO moneytor_sync (id, last_sync) VALUES (1, $time)
      ON CONFLICT(id) DO UPDATE SET last_sync = excluded.last_sync`).run({ $time: lastSync });
    return { imported, updated, skipped: transactions.length - movements.length, lastSync };
  }).immediate();
}
