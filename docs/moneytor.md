# Sync your own accounts through Moneytor

The app uses one personal API token for one Moneytor profile. You can import multiple verified checking accounts from that profile. Authorize Moneytor to read each account at the bank, then issue a token so Personal Finance Sync can read the data held by Moneytor. Coverage for another person’s accounts or for business accounts has not been verified. [Moneytor personal API](https://moneytor.ai/api)

## Connect and select accounts

1. On your trusted computer, open the connected Vue dashboard with `dashboard --mobile`. Follow the [source setup](../README.md#run-from-source) if you have not built it yet.
2. Link your checking accounts in Moneytor and complete the authorization on each bank’s own screen. Check that Moneytor has loaded their activity.
3. Issue a personal API token in [Moneytor API settings](https://app.moneytor.co.il/settings#api). Open **More → Connections** and enter the token in the **Moneytor** panel. The local server stores it in the operating system’s credential store. Keep it out of the terminal, chat, source files, and Git.
4. Choose a discovery date range with known activity and run discovery. Confirm each result against Moneytor, then select the accounts you want to import. A masked account number alone does not identify an account. If the result is empty, check that Moneytor has the bank connection and try a wider range that includes activity. An account that cannot be matched by its external identifier stays out of the results.
5. Save the selection and explicitly start **Sync**. Use a short range for the first sync. In **Transactions**, check that a known debit and credit appear under the right account and that their dates, signs, and currencies match the source.
6. In **Dashboard**, set each account’s display name and group. Select a date range and an account, a group, or all accounts to see cash flow. Compare totals by currency. Review the per-account breakdown if a transfer or card settlement affects the combined total.

## Date ranges and coverage

Moneytor applies inclusive date bounds and returns pages of transactions for the profile. The app filters accounts locally. Moneytor can return transactions for other accounts and manually entered rows. The app imports checking movements with a booking date and an external account identifier matching a verified selection. Rows without those fields are skipped. Date ranges can span up to 366 days, inclusive. The public API does not document a separate flag for manual transactions. Verify uncertain totals against your bank records.

Sync reads the data already held by Moneytor. When the data is stale, check the bank connection and refresh it in Moneytor.

Use one source per account. When importing from Moneytor, the app blocks potentially overlapping history already present from another source when the account’s last four digits match or when an account number is unavailable for comparison. If you are switching sources, review your existing history and use a start date after the last movement already imported for that account. Separate feeds may use different IDs for the same transaction.

Repeated syncs of overlapping dates should leave totals unchanged for transactions with the same IDs. Check this by syncing the same short range again. If renewing the bank authorization changes account or transaction IDs, verify the mapping and reconcile overlapping history before starting another sync. Two transactions on the same date for the same amount can both be valid.

## Rotate or disconnect

- **Rotate a token.** Issue a new token in Moneytor and replace the token in the local panel. This clears discovery results and selected accounts. Discover and select the accounts again. Previous imports stay in your history. Revoke the old token in Moneytor once you no longer need it.
- **Disconnect.** Disconnect in the Moneytor panel to remove the local token and account selections. Previous imports remain available in the local ledger. Revoke the token in Moneytor if you no longer need it. Manage your bank’s authorization separately in Moneytor or at the bank.
- **Access errors.** Issue a new token if yours expired or was revoked. Check your eligibility if Moneytor denies access. If you hit a request limit, wait for the limit to reset before retrying. [Moneytor API reference](https://app.moneytor.co.il/docs)

## Local verification

From the repository root, install dependencies as described in the [README](../README.md#run-from-source), then run:

```sh
bun run typecheck
bun run test
bun run build
npm --prefix mobile run typecheck
npm --prefix mobile test
npm --prefix mobile run build
npm --prefix mobile run test:browser
```

The browser tests require Chromium. Open the connected Vue dashboard with `bun run dev -- dashboard --mobile` for the account verification above. Live verification with Moneytor is pending.
