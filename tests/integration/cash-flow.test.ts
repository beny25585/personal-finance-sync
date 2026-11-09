import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, initDatabase } from "../../src/db/database.js";
import { upsertAccount, updateAccountExcluded } from "../../src/db/repositories/accounts.js";
import { getCashFlow, updateAccountOrganization } from "../../src/db/repositories/cash-flow.js";
import { createProvider } from "../../src/db/repositories/providers.js";
import { upsertTransaction } from "../../src/db/repositories/transactions.js";
import type { TransactionInput } from "../../src/types/index.js";

const range = { from: "2026-11-01", to: "2026-11-30" };
let row = 0;

beforeEach(() => {
  const db = initDatabase(":memory:");
  db.run("INSERT INTO categories (name, classification) VALUES ('Own transfer', 'transfer'), ('Card statement', 'cc_billing')");
  row = 0;
});

afterEach(() => closeDatabase());

function account(company: string, type: "bank" | "credit_card", accountNumber: string): number {
  const provider = createProvider(company, company, type);
  return upsertAccount(provider.id, accountNumber, company).id;
}

function record(
  accountId: number,
  date: string,
  amount: number,
  overrides: Partial<TransactionInput> = {},
): void {
  const key = "fixture-" + ++row;
  upsertTransaction({
    accountId,
    type: "normal",
    date,
    processedDate: date,
    originalAmount: amount,
    originalCurrency: "ILS",
    chargedAmount: amount,
    chargedCurrency: "ILS",
    description: "Fixture movement",
    status: "completed",
    hash: key,
    uniqueId: key,
    ...overrides,
  });
}

describe("cash flow across connected accounts", () => {
  it("filters by group or account and nets only corroborated unique transfers", () => {
    const fibi = account("fibi", "bank", "synthetic-0011");
    const leumi = account("leumi", "bank", "synthetic-0022");
    const outside = account("hapoalim", "bank", "synthetic-0033");
    const excluded = account("discount", "bank", "synthetic-0044");
    updateAccountOrganization(fibi, "Main account", "Household");
    updateAccountOrganization(leumi, null, "Household");
    updateAccountExcluded(excluded, true);

    record(fibi, "2026-11-01", 1_000);
    record(fibi, "2026-11-30T23:59:59.999Z", -100);
    record(fibi, "2026-11-03", -999, { status: "pending" });
    record(fibi, "2026-12-01", -888);
    record(leumi, "2026-11-04", 10, { chargedCurrency: "$" });
    record(leumi, "2026-11-04", -3.425, { chargedCurrency: "USD" });
    record(outside, "2026-11-04", 900);
    record(excluded, "2026-11-04", 5_000);

    const confirmed = { category: "Own transfer", identifier: "confirmed-reference" };
    record(fibi, "2026-11-05", -50, confirmed);
    record(leumi, "2026-11-06", 50, confirmed);

    const ambiguous = { category: "Own transfer", identifier: "repeated-reference" };
    record(fibi, "2026-11-07", -70, ambiguous);
    record(leumi, "2026-11-07", 70, ambiguous);
    record(leumi, "2026-11-08", 70, ambiguous);

    const household = getCashFlow({ ...range, group: "Household" });
    expect(household.accounts).toEqual(expect.arrayContaining([
      { id: fibi, name: "Main account", displayName: "Main account", group: "Household" },
      { id: leumi, name: "leumi · ••••0022", displayName: null, group: "Household" },
      expect.objectContaining({ id: outside, group: null }),
    ]));
    expect(household.accounts).toHaveLength(3);
    expect(household.breakdown.map(item => item.accountId)).toEqual([fibi, leumi]);
    expect(household.totals).toEqual([
      { currency: "ILS", income: 1_140, expenses: 170, net: 970 },
      { currency: "USD", income: 10, expenses: 3.425, net: 6.575 },
    ]);

    const transferOnly = getCashFlow({ from: "2026-11-05", to: "2026-11-06", group: "Household" });
    expect(transferOnly.totals).toEqual([{ currency: "ILS", income: 0, expenses: 0, net: 0 }]);

    const mainOnly = getCashFlow({ ...range, accountId: fibi });
    expect(mainOnly.totals).toEqual([
      { currency: "ILS", income: 1_000, expenses: 220, net: 780 },
    ]);
    expect(household.breakdown.find(item => item.accountId === fibi)?.totals).toEqual(mainOnly.totals);
  });

  it("keeps the bank debit when a matched card statement is outside or incomplete in the selected period", () => {
    const fibi = account("fibi", "bank", "synthetic-0011");
    const max = account("max", "credit_card", "synthetic-0033");

    const processedDate = "2026-11-20";
    record(max, "2026-11-01", -80, { processedDate });
    record(max, "2026-11-02", -35, { processedDate });
    record(max, "2026-11-06", 15, { processedDate });
    record(fibi, processedDate, -100, { category: "Card statement", description: "Max statement" });
    record(fibi, "2026-11-22", -75, { category: "Card statement", description: "Max statement" });

    expect(getCashFlow(range).totals).toEqual([
      { currency: "ILS", income: 15, expenses: 190, net: -175 },
    ]);
    expect(getCashFlow({ ...range, accountId: fibi }).totals).toEqual([
      { currency: "ILS", income: 0, expenses: 175, net: -175 },
    ]);
    expect(getCashFlow({ ...range, from: "2026-11-02" }).totals).toEqual([
      { currency: "ILS", income: 15, expenses: 210, net: -195 },
    ]);
  });
});
