import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initDatabase, closeDatabase } from "../../src/db/database.js";
import { createProvider } from "../../src/db/repositories/providers.js";
import { listTransactions } from "../../src/db/repositories/transactions.js";
import { DEFAULT_CONFIG } from "../../src/types/config.js";
import type { Provider } from "../../src/types/provider.js";

// Deliberately repeated synthetic input tests ingestion idempotence only.
// Equal-valued real bank records are not assumed to be the same transaction.
// Result-set overlap does not test bank date filtering or ID stability.
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

import { scrapeProvider, type ScrapeResult } from "../../src/core/scraper.js";
import { syncProviders } from "../../src/services/sync.js";

function record(label = "A", day = "20", identifierForm: "present" | "omitted" | "null" = "present") {
  return {
    type: "normal",
    ...(identifierForm === "present" ? { identifier: `synthetic-${label}` }
      : identifierForm === "null" ? { identifier: null } : {}),
    date: `2026-10-${day}T12:00:00.000Z`,
    processedDate: `2026-10-${day}T12:00:00.000Z`,
    description: `Synthetic record ${label}`,
    chargedAmount: -120,
    originalAmount: -120,
    originalCurrency: "ILS",
    memo: "",
    status: "completed",
  };
}

async function sync(provider: Provider, accounts: ScrapeResult["accounts"]) {
  vi.mocked(scrapeProvider).mockResolvedValue({ success: true, accounts });
  const result = await syncProviders([provider], { config: DEFAULT_CONFIG, concurrency: 1 });
  expect(result.hasErrors).toBe(false);
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(scrapeProvider).mockReset();
  initDatabase(":memory:");
});
afterEach(() => closeDatabase());

describe.each(["leumi", "max"] as const)("%s exact-input idempotence", (companyId) => {
  let provider: Provider;
  beforeEach(() => {
    provider = createProvider(companyId, companyId, companyId === "leumi" ? "bank" : "credit_card");
  });

  it.each(["present", "omitted", "null"] as const)(
    "imports redundant copies once and preserves the row on repeat, identifier %s",
    async (identifierForm) => {
      const tx = record("A", "20", identifierForm);
      const response = [{ accountNumber: "synthetic-001", txns: [tx, { ...tx }, { ...tx }] }];
      const first = await sync(provider, response);
      expect(first.totalAdded).toBe(1);
      const original = listTransactions({});
      expect(original).toHaveLength(1);

      for (let iteration = 0; iteration < 2; iteration++) {
        const repeated = await sync(provider, response);
        expect(repeated.totalAdded).toBe(0);
        expect(repeated.totalUpdated).toBe(0);
        expect(listTransactions({})).toEqual(original);
      }
    },
  );

  it("adds only new records from overlapping mocked result sets", async () => {
    const a = record("A", "20");
    const b = record("B", "21");
    const c = record("C", "22");
    const first = await sync(provider, [{ accountNumber: "synthetic-001", txns: [a, b] }]);
    expect(first.totalAdded).toBe(2);
    const original = listTransactions({});

    const overlap = await sync(provider, [{ accountNumber: "synthetic-001", txns: [{ ...b }, c] }]);
    expect(overlap.totalAdded).toBe(1);
    expect(overlap.totalUpdated).toBe(0);
    expect(listTransactions({})).toHaveLength(3);
    expect(listTransactions({})).toEqual(expect.arrayContaining(original));

    const all = listTransactions({});
    const repeat = await sync(provider, [{ accountNumber: "synthetic-001", txns: [a, b, c] }]);
    expect(repeat.totalAdded).toBe(0);
    expect(repeat.totalUpdated).toBe(0);
    expect(listTransactions({})).toEqual(all);
  });

  it("keeps identical transaction values in different accounts separate on repeat", async () => {
    const response = [
      { accountNumber: "synthetic-001", txns: [record()] },
      { accountNumber: "synthetic-002", txns: [record()] },
    ];
    const first = await sync(provider, response);
    expect(first.totalAdded).toBe(2);
    const original = listTransactions({});
    expect(original).toHaveLength(2);
    expect(new Set(original.map((tx) => tx.accountId)).size).toBe(2);
    expect(original.map((tx) => tx.accountNumber).sort()).toEqual(["synthetic-001", "synthetic-002"]);

    const repeat = await sync(provider, response);
    expect(repeat.totalAdded).toBe(0);
    expect(repeat.totalUpdated).toBe(0);
    expect(listTransactions({})).toEqual(original);
  });
});

it("keeps identical account numbers and transaction values separate across Leumi and MAX", async () => {
  const leumi = createProvider("leumi", "leumi", "bank");
  const max = createProvider("max", "max", "credit_card");
  const response = [{ accountNumber: "synthetic-001", txns: [record()] }];
  for (const provider of [leumi, max]) {
    expect((await sync(provider, response)).totalAdded).toBe(1);
  }
  const original = listTransactions({});
  expect(original).toHaveLength(2);
  expect(new Set(original.map((tx) => tx.accountId)).size).toBe(2);
  expect(original.map((tx) => tx.providerCompanyId).sort()).toEqual(["leumi", "max"]);

  for (const provider of [leumi, max]) {
    const repeat = await sync(provider, response);
    expect(repeat.totalAdded).toBe(0);
    expect(repeat.totalUpdated).toBe(0);
  }
  expect(listTransactions({})).toEqual(original);
});
