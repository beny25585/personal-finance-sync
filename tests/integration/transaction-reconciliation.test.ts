import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initDatabase, closeDatabase } from "../../src/db/database.js";
import { createProvider } from "../../src/db/repositories/providers.js";
import { listTransactions } from "../../src/db/repositories/transactions.js";
import { DEFAULT_CONFIG } from "../../src/types/config.js";
import type { Provider } from "../../src/types/provider.js";

// Contract tests for normalized ingestion, not claims about live bank IDs.
// Correction scenarios explicitly assume a stable ID within one provider/account.
// No browser, keychain, user directories, or provider websites are accessed.
vi.mock("../../src/core/scraper.js", () => ({
  findChromePath: vi.fn(() => "/mock/chromium"),
  launchBrowser: vi.fn(async () => ({})),
  closeBrowser: vi.fn(async () => {}),
  scrapeProvider: vi.fn(),
}));
vi.mock("../../src/security/keychain.js", () => ({
  getCredentials: vi.fn(async () => ({ username: "synthetic", password: "synthetic" })),
}));
vi.mock("../../src/config/loader.js", () => ({
  ensureDirectories: vi.fn(async () => {}),
  getDbPath: vi.fn(() => ":memory:"),
  loadConfig: vi.fn(),
}));

import { scrapeProvider } from "../../src/core/scraper.js";
import { syncProviders } from "../../src/services/sync.js";

interface SyntheticTransaction {
  identifier: string;
  type: "normal" | "installments";
  date: string;
  processedDate: string;
  description: string;
  memo: string;
  originalAmount: number;
  originalCurrency: string;
  chargedAmount: number;
  chargedCurrency: string;
  status: "pending" | "completed";
  installments?: { number: number; total: number };
}

const DATE = "2026-10-20T12:00:00.000Z";
const NEXT_DAY = "2026-10-21T12:00:00.000Z";

function purchase(overrides: Partial<SyntheticTransaction> = {}): SyntheticTransaction {
  return {
    identifier: "synthetic-purchase-A",
    type: "normal",
    date: DATE,
    processedDate: DATE,
    description: "Synthetic merchant",
    memo: "",
    originalAmount: -120,
    originalCurrency: "ILS",
    chargedAmount: -120,
    chargedCurrency: "ILS",
    status: "completed",
    ...overrides,
  };
}

async function sync(provider: Provider, txns: SyntheticTransaction[]) {
  vi.mocked(scrapeProvider).mockResolvedValue({
    success: true,
    accounts: [{ accountNumber: "synthetic-account-001", txns }],
  });
  const result = await syncProviders([provider], { config: DEFAULT_CONFIG, concurrency: 1 });
  expect(result.hasErrors).toBe(false);
  return result;
}

async function reconcile(provider: Provider, initial: SyntheticTransaction, updated: SyntheticTransaction) {
  const first = await sync(provider, [initial]);
  expect(first.totalAdded).toBe(1);
  const before = listTransactions({});
  expect(before).toHaveLength(1);
  const result = await sync(provider, [updated]);
  return { before: before[0], after: listTransactions({}), result };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(scrapeProvider).mockReset();
  initDatabase(":memory:");
});
afterEach(() => closeDatabase());

describe.each(["leumi", "max"] as const)("%s reconciliation contract", (companyId) => {
  let provider: Provider;
  beforeEach(() => {
    provider = createProvider(companyId, companyId, companyId === "leumi" ? "bank" : "credit_card");
  });

  it("control: repeating an unchanged purchase preserves one row and its internal ID", async () => {
    const { before, after, result } = await reconcile(provider, purchase(), purchase());
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id: before.id, identifier: "synthetic-purchase-A" });
    expect(result.totalAdded).toBe(0);
    expect(result.totalUpdated).toBe(0);
  });

  it("control: a purchase and separately identified refund survive repeated synchronization", async () => {
    const txns = [purchase(), purchase({
      identifier: "synthetic-refund-A", chargedAmount: 120, originalAmount: 120,
    })];
    await sync(provider, txns);
    const before = listTransactions({}).map((tx) => tx.id).sort((a, b) => a - b);
    const result = await sync(provider, txns);
    const after = listTransactions({});
    expect(after).toHaveLength(2);
    expect(after.map((tx) => tx.chargedAmount).sort((a, b) => a - b)).toEqual([-120, 120]);
    expect(after.map((tx) => tx.id).sort((a, b) => a - b)).toEqual(before);
    expect(result.totalAdded).toBe(0);
    expect(result.totalUpdated).toBe(0);
  });

  it("preserves two explicitly distinct provider IDs with otherwise identical fields in one response", async () => {
    const txns = [purchase(), purchase({ identifier: "synthetic-purchase-B" })];
    await sync(provider, txns);
    expect(listTransactions({}).map((tx) => tx.identifier).sort())
      .toEqual(["synthetic-purchase-A", "synthetic-purchase-B"]);
    const repeat = await sync(provider, txns);
    expect(listTransactions({})).toHaveLength(2);
    expect(repeat.totalAdded).toBe(0);
  });

  it("preserves two explicitly distinct provider IDs introduced in separate synchronizations", async () => {
    await sync(provider, [purchase()]);
    const result = await sync(provider, [purchase({ identifier: "synthetic-purchase-B" })]);
    expect(listTransactions({}).map((tx) => tx.identifier).sort())
      .toEqual(["synthetic-purchase-A", "synthetic-purchase-B"]);
    expect(result.totalAdded).toBe(1);
  });

  it("updates a pending purchase when completion changes the amount but retains its stable ID", async () => {
    const initial = purchase({ status: "pending" });
    const updated = purchase({ chargedAmount: -125, originalAmount: -125 });
    const { before, after, result } = await reconcile(provider, initial, updated);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id: before.id, status: "completed", chargedAmount: -125 });
    expect(result.totalAdded).toBe(0);
    expect(result.totalUpdated).toBe(1);
  });

  it("control: completion shifted by one day retains the pending row's internal ID", async () => {
    const initial = purchase({ status: "pending" });
    const updated = purchase({ date: NEXT_DAY, processedDate: NEXT_DAY });
    const { before, after, result } = await reconcile(provider, initial, updated);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id: before.id, date: NEXT_DAY, status: "completed" });
    expect(result.totalAdded).toBe(0);
    expect(result.totalUpdated).toBe(1);
  });

  it("updates a completed purchase's corrected amount under the stable-ID contract", async () => {
    const { before, after, result } = await reconcile(provider, purchase(), purchase({
      chargedAmount: -125, originalAmount: -125,
    }));
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id: before.id, chargedAmount: -125, originalAmount: -125 });
    expect(result.totalAdded).toBe(0);
    expect(result.totalUpdated).toBe(1);
  });

  it("updates a completed purchase's corrected date under the stable-ID contract", async () => {
    const { before, after, result } = await reconcile(provider, purchase(), purchase({
      date: NEXT_DAY, processedDate: NEXT_DAY,
    }));
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id: before.id, date: NEXT_DAY, processedDate: NEXT_DAY });
    expect(result.totalAdded).toBe(0);
    expect(result.totalUpdated).toBe(1);
  });

  it("refreshes original amount/currency without a status or charged-amount change", async () => {
    const initial = purchase({ originalAmount: -30, originalCurrency: "USD" });
    const updated = purchase({ originalAmount: -28, originalCurrency: "EUR" });
    const { before, after, result } = await reconcile(provider, initial, updated);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({
      id: before.id, status: "completed", chargedAmount: -120, chargedCurrency: "ILS",
      originalAmount: -28, originalCurrency: "EUR",
    });
    expect(result.totalAdded).toBe(0);
    expect(result.totalUpdated).toBe(1);
  });
});

describe("MAX installment metadata contract", () => {
  it.each([
    { label: "pending completion with the same date", status: "pending" as const, date: DATE },
    { label: "pending completion with a shifted date", status: "pending" as const, date: NEXT_DAY },
    { label: "a completed transaction with unchanged status", status: "completed" as const, date: DATE },
  ])("refreshes the total for $label without changing the installment identity", async ({ status, date }) => {
    const provider = createProvider("max", "max", "credit_card");
    // MAX appends the installment number to ARN. Keep number and ID fixed;
    // changing the installment number could mean a different transaction.
    const initial = purchase({
      identifier: "synthetic-arn_2", type: "installments", status,
      installments: { number: 2, total: 6 },
    });
    const updated = { ...initial, status: "completed" as const, date, processedDate: date,
      installments: { number: 2, total: 12 } };
    const { before, after, result } = await reconcile(provider, initial, updated);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({
      id: before.id, identifier: "synthetic-arn_2", type: "installments",
      status: "completed", installmentNumber: 2, installmentTotal: 12,
    });
    expect(result.totalAdded).toBe(0);
    expect(result.totalUpdated).toBe(1);
  });
});
