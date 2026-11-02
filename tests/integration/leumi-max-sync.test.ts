import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initDatabase, closeDatabase, getDatabase } from "../../src/db/database.js";
import { createProvider } from "../../src/db/repositories/providers.js";
import { listTransactions } from "../../src/db/repositories/transactions.js";
import { getAccountsByProvider } from "../../src/db/repositories/accounts.js";
import { DEFAULT_CONFIG } from "../../src/types/config.js";

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

import { scrapeProvider, launchBrowser, closeBrowser } from "../../src/core/scraper.js";
import { syncProviders } from "../../src/services/sync.js";

beforeEach(() => {
  vi.clearAllMocks();
  initDatabase(":memory:");
});
afterEach(() => closeDatabase());

describe.each(["leumi", "max"] as const)("offline %s ingestion", (companyId) => {
  it("preserves financial fields, repeats idempotently, and completes pending records", async () => {
    const provider = createProvider(companyId, companyId, companyId === "leumi" ? "bank" : "credit_card");
    const date = new Date().toISOString();
    const purchase = {
      identifier: "synthetic-purchase", date, processedDate: date,
      description: "Synthetic purchase", chargedAmount: -120,
      chargedCurrency: "ILS", originalAmount: -120, originalCurrency: "ILS",
      status: "pending", type: companyId === "max" ? "installments" : "normal",
      ...(companyId === "max" ? { installments: { number: 2, total: 6 } } : {}),
    };
    const refund = {
      ...purchase, identifier: "synthetic-refund", description: "Synthetic refund",
      chargedAmount: 30, originalAmount: 30, status: "completed", type: "normal",
      installments: undefined,
    };
    const response = {
      success: true,
      accounts: [{ accountNumber: "synthetic-001", balance: 1000, txns: [purchase, purchase, refund] }],
    };
    vi.mocked(scrapeProvider).mockResolvedValue(response);
    const options = { config: DEFAULT_CONFIG, concurrency: 1 };

    const first = await syncProviders([provider], options);
    expect(first.hasErrors).toBe(false);
    expect(first.totalAdded).toBe(2);
    const initial = listTransactions({ providerCompanyId: companyId });
    const stored = initial.find((tx) => tx.identifier === purchase.identifier)!;
    expect(stored).toMatchObject({
      providerCompanyId: companyId, accountNumber: "synthetic-001",
      identifier: purchase.identifier, date, processedDate: date,
      description: purchase.description, chargedAmount: -120, chargedCurrency: "ILS",
      originalAmount: -120, originalCurrency: "ILS", status: "pending",
      type: purchase.type,
      installmentNumber: companyId === "max" ? 2 : null,
      installmentTotal: companyId === "max" ? 6 : null,
    });
    expect(stored.id).toEqual(expect.any(Number));
    expect(getAccountsByProvider(provider.id)[0].balance).toBe(1000);

    const repeat = await syncProviders([provider], options);
    expect(repeat.totalAdded).toBe(0);
    expect(repeat.totalUpdated).toBe(0);
    expect(listTransactions({})).toHaveLength(2);

    vi.mocked(scrapeProvider).mockResolvedValue({
      ...response,
      accounts: [{ ...response.accounts[0], txns: [{ ...purchase, status: "completed" }, refund] }],
    });
    const completed = await syncProviders([provider], options);
    expect(completed.totalAdded).toBe(0);
    expect(completed.totalUpdated).toBe(1);
    expect(listTransactions({})).toHaveLength(2);
    expect(listTransactions({}).find((tx) => tx.identifier === purchase.identifier))
      .toMatchObject({ id: stored.id, status: "completed" });
    expect(launchBrowser).toHaveBeenCalledTimes(3);
    expect(closeBrowser).toHaveBeenCalledTimes(3);
    expect(vi.mocked(scrapeProvider).mock.calls[1][0].startDate.getTime())
      .toBeLessThan(Date.now());
  });

  it("records a failed scrape without importing transactions", async () => {
    const provider = createProvider(companyId, companyId, companyId === "leumi" ? "bank" : "credit_card");
    vi.mocked(scrapeProvider).mockResolvedValue({
      success: false, accounts: [], error: "Authentication challenge requires user action",
      errorType: "TWO_FACTOR_MISSING",
    });
    const result = await syncProviders([provider], { config: DEFAULT_CONFIG });
    expect(result.hasErrors).toBe(true);
    expect(listTransactions({})).toEqual([]);
    expect(getDatabase().prepare("SELECT status FROM sync_log").get())
      .toMatchObject({ status: "error" });
    expect(closeBrowser).toHaveBeenCalledTimes(1);
  });
});
