import { normalizeCurrency } from "../shared/currency.js";

const MONEYTOR_ORIGIN = "https://app.moneytor.co.il";
const REQUEST_TIMEOUT_MS = 30_000;
const PAGE_SIZE = 2_000;
const MAX_PAGES = 20;

export class MoneytorError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "MoneytorError";
  }
}

export interface MoneytorAsset {
  externalId: string | null;
  name: string;
  accountNumber: string | null;
  bank: string | null;
  bankNumber: string | null;
  isChecking: boolean | null;
}

export interface MoneytorTransaction {
  id: string;
  accountId: string | null;
  accountNumber: string | null;
  type: string | null;
  date: string;
  bookingDate: string | null;
  transactionDate: string | null;
  valueDate: string | null;
  amount: number;
  currency: string;
  description: string | null;
  category: string | null;
  extraInfo: string | null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

function asIdentifier(value: unknown): string | null {
  if (typeof value === "number") return Number.isSafeInteger(value) ? String(value) : null;
  return asText(value);
}

function maskedAccountNumber(value: unknown): string | null {
  const number = asIdentifier(value);
  const suffix = number?.replace(/[\s-]/g, "").match(/\d{4}$/)?.[0];
  return number && suffix && number.length > suffix.length ? "••••" + suffix : null;
}

function calendarDay(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day.startsWith("0000")) return null;
  if (value.length > 10 && (!value.startsWith(day + "T") || !Number.isFinite(Date.parse(value)))) return null;
  const midnight = new Date(day + "T00:00:00.000Z");
  return Number.isFinite(midnight.getTime()) && midnight.toISOString().slice(0, 10) === day ? day : null;
}

async function request(
  path: "/api/v1/assets" | "/api/v1/transactions",
  token: string,
  signal: AbortSignal,
  params?: URLSearchParams,
): Promise<Record<string, unknown>> {
  const secret = token.trim();
  if (!secret || /[^\x21-\x7e]/.test(secret)) throw new MoneytorError("tokenInvalid");
  const url = new URL(path, MONEYTOR_ORIGIN);
  if (params) url.search = params.toString();

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: "Bearer " + secret, Accept: "application/json" },
      redirect: "error",
      signal,
    });
  } catch {
    throw new MoneytorError("apiUnavailable");
  }

  // Error bodies are not exposed to callers. They may include private details.
  if (response.status === 401) throw new MoneytorError("tokenInvalid");
  if (response.status === 403) throw new MoneytorError("premiumRequired");
  if (response.status === 429) throw new MoneytorError("rateLimited");
  if (!response.ok) throw new MoneytorError("apiUnavailable");

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new MoneytorError(signal.aborted ? "apiUnavailable" : "invalidResponse");
  }
  const payload = asObject(value);
  if (!payload || payload.ok !== true) throw new MoneytorError("invalidResponse");
  return payload;
}

export async function getMoneytorAssets(token: string): Promise<MoneytorAsset[]> {
  const payload = await request("/api/v1/assets", token, AbortSignal.timeout(REQUEST_TIMEOUT_MS));
  if (!Array.isArray(payload.assets) || payload.count !== payload.assets.length) {
    throw new MoneytorError("invalidResponse");
  }

  const assets: MoneytorAsset[] = [];
  for (const value of payload.assets) {
    const asset = asObject(value);
    const form = asText(asset?.form);
    if (!asset || !form) throw new MoneytorError("invalidResponse");
    if (form !== "bank") continue;

    const name = asText(asset.name);
    if (!name) throw new MoneytorError("invalidResponse");

    const normalizedId = asText(asset.openfinanceAssetId);
    const sourceId = asText(asset.openfinance_asset_id);
    const accountType = asText(asObject(asset.accountType)?.value ?? asset.accountType)?.toLowerCase();
    assets.push({
      // These fields are only candidates for matching the transaction account ID.
      externalId: normalizedId && sourceId && normalizedId !== sourceId ? null : normalizedId ?? sourceId,
      name,
      accountNumber: maskedAccountNumber(asset.accountNumber),
      bank: asText(asset.bank),
      bankNumber: asIdentifier(asset.bankNumber),
      isChecking: accountType == null ? null : accountType === "balance" || accountType === "checking",
    });
  }
  return assets;
}

function readTransaction(value: unknown): MoneytorTransaction {
  const row = asObject(value);
  const id = asIdentifier(row?.id);
  const date = calendarDay(row?.date);
  const currencyText = asText(row?.currency);
  if (!row || !id || !date || !currencyText || typeof row.amount !== "number" || !Number.isFinite(row.amount)) {
    throw new MoneytorError("invalidResponse");
  }

  const bookingDate = calendarDay(row.bookingDate);
  const transactionDate = calendarDay(row.transactionDate);
  const valueDate = calendarDay(row.valueDate);
  if ((row.bookingDate != null && !bookingDate)
    || (row.transactionDate != null && !transactionDate)
    || (row.valueDate != null && !valueDate)) {
    throw new MoneytorError("invalidResponse");
  }
  const currency = normalizeCurrency(currencyText).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new MoneytorError("invalidResponse");

  return {
    id,
    accountId: asIdentifier(row.accountId),
    accountNumber: maskedAccountNumber(row.accountNumber),
    type: asText(row.type)?.toUpperCase() ?? null,
    date,
    bookingDate,
    transactionDate,
    valueDate,
    amount: row.amount,
    currency,
    description: asText(row.description),
    category: asText(row.category),
    extraInfo: asText(row.extra_info),
  };
}

export async function getMoneytorTransactions(
  token: string,
  from: string,
  to: string,
): Promise<MoneytorTransaction[]> {
  if (calendarDay(from) !== from || calendarDay(to) !== to || from > to) {
    throw new MoneytorError("invalidResponse");
  }
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const transactions: MoneytorTransaction[] = [];
  const transactionKeys = new Set<string>();
  let offset = 0;
  let totalAvailable: number | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ from, to, limit: String(PAGE_SIZE), offset: String(offset) });
    const payload = await request("/api/v1/transactions", token, signal, params);
    const total = payload.totalAvailable;
    const rows = payload.transactions;
    if (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0
      || total > PAGE_SIZE * MAX_PAGES || !Array.isArray(rows) || rows.length > PAGE_SIZE
      || payload.count !== rows.length || payload.offset !== offset
      || (totalAvailable !== undefined && total !== totalAvailable)) {
      throw new MoneytorError("invalidResponse");
    }
    totalAvailable = total;

    const expectedOffset = offset + rows.length;
    const hasMore = expectedOffset < total;
    if (expectedOffset > total || payload.hasMore !== hasMore
      || payload.nextOffset !== (hasMore ? expectedOffset : null)
      || (hasMore && expectedOffset === offset)) {
      throw new MoneytorError("invalidResponse");
    }

    for (const value of rows) {
      const row = readTransaction(value);
      const key = JSON.stringify([row.accountId, row.id]);
      if (transactionKeys.has(key)) throw new MoneytorError("invalidResponse");
      transactionKeys.add(key);
      transactions.push(row);
    }
    if (!hasMore) return transactions;
    offset = expectedOffset;
  }

  // Never pass a partially retrieved period to the importer.
  throw new MoneytorError("invalidResponse");
}
