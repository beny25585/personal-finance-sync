# Leumi and MAX ingestion readiness

KolShek is prepared for Linux development. Real Leumi/MAX authentication and retrieval remain unverified. No bank websites were contacted, credentials supplied, production deployment performed, or synchronization schedule enabled. Automated tests were deliberately not run.

## Source and environment

The official repository, https://github.com/DaveDushi/kolshek, was inspected at commit `9b447d2574bada376f9b41e1fad9bbbe26c49307` (v0.4.8). It uses `israeli-bank-scrapers-core` **6.7.1**, from https://github.com/eshaham/israeli-bank-scrapers. This copy retains upstream history and the MIT license.

The current managed environment is Debian 13.6 Linux x86_64, rather than a verified GitHub Codespace. Git 2.52.0, Node.js 24.19.0, npm 11.9.0, and Chromium 154.0.8037.57 were available. Node meets the scraper's >=22.12.0 requirement. Chromium is at `/usr/bin/chromium`; shared-library inspection found no missing libraries. Bun 1.4.4 was installed locally at `/workspace/tools/node_modules/@oven/bun-linux-x64/bin/bun`.

Production code requires Bun APIs, including `bun:sqlite`, `Bun.spawn`, and `Bun.secrets`; Node alone is insufficient. Dependencies were installed using Bun with lifecycle scripts disabled. The reviewed `better-sqlite3` native dependency was rebuilt for Vitest's Node adapter. Other blocked lifecycle scripts were left blocked.

The existing prebuild, TypeScript check, CLI help, and Linux executable compilation succeeded. A fresh checkout needs generated asset modules before CLI startup: the existing prebuild builds upstream frontend assets because CLI imports reference them. No new frontend functionality was added. Browser launch and provider connectivity were not tested.

A new Codespace or personal computer needs its own runtime/dependency installation. Linux is used by Codespaces, not required by the repository: upstream also supports Windows and macOS. The release workflow pins Bun 1.3.2, while this session used 1.4.4. Most dependencies use ranges and the main application ignores `bun.lock`; a reviewed lockfile is needed before reproducible deployment.

## Existing implementation

- `src/core/scraper.ts`: Chromium discovery, browser contexts, upstream scraper invocation, and sanitized scraper errors.
- `src/services/sync.ts`: credential retrieval, date overlap, scraping, atomic SQLite ingestion, and synchronization logs.
- `src/core/sync-engine.ts`: identity calculation and transaction mapping.
- `src/db/`: SQLite storage, embedded migrations, and repositories.
- `src/security/keychain.ts`: credential backends.
- `src/core/scheduler/linux.ts`: Linux scheduling.

The registry in `src/types/provider.ts` includes both requested providers among 18 institutions. Other integrations were not configured. Existing tests include identity helpers, database CRUD, CSV imports, keychain helpers, authentication status, and scheduler escaping. The new test uses isolated fixtures instead of running `scripts/seed-test-data.ts` against an application database.

## Provider behavior

Both pinned integrations require `username` and `password`, use browser automation, and can be invoked repeatedly through the existing sync service.

**Leumi:** `node_modules/israeli-bank-scrapers-core/lib/scrapers/leumi.js` submits the bank login form, selects accounts, and extracts historical and pending transactions. Records include a reference identifier, date, description, memo, signed amount, ILS currency, and status. The response may include an account balance; its meaning as available-to-spend balance has not been established.

**MAX:** `node_modules/israeli-bank-scrapers-core/lib/scrapers/max.js` selects password login and retrieves monthly transactions through authenticated browser requests. It groups records by short card number and maps purchase/payment dates, merchant, signed original/charged amounts, currencies, status, memo, category, and available installment number/total. The identifier uses the deal ARN with an installment suffix when applicable and may be absent. This implementation does not return a balance or available credit limit. Refunds are represented by signed amounts, not a separate refund status.

Neither provider implements an explicit SMS/OTP retriever. Actual accounts may demand MFA, password renewal, or another challenge. Headless Linux operation is supported by the code but has not been demonstrated against either provider. `--visible` requires an available display and does not guarantee challenge recovery. Never bypass MFA or bank access restrictions.

KolShek clamps initial history to 365 days. These upstream implementations internally allow roughly three years for Leumi and four for MAX; MAX also includes a future month by default. The wrapper creates and closes a fresh browser context for each scrape; it does not persist authenticated cookies between runs. A successful visible login does not establish a reusable session for scheduled headless fetching.

## Offline pipeline and duplicate behavior

`tests/integration/leumi-max-sync.test.ts` exercises the real sync service and repositories using in-memory SQLite, synthetic transactions, and mocked browser, scraper, credential, and directory-setup functions.

For both providers, it covers provider/account context, internal and provider IDs, dates, descriptions, signed amounts/currencies, status, MAX installments, refunds, repeated imports, duplicate response rows, pending-to-completed updates retaining the internal ID, and failed-scrape logging. Its synthetic balance verifies storage only; it does not claim MAX supplies balances. It does not validate bank login or extraction from raw bank responses.

`tests/fixtures/bun-sqlite-mock.ts` now implements `Database.run`, required by production initialization for pragmas and transaction control. No production ingestion code was rewritten. These tests remain **unrun**.

Provider/account context is joined through providers and accounts. Transactions store original and charged amounts/currencies, date and processed date, description, memo, pending/completed status, and installment metadata.

Duplicate prevention combines a per-response key and SQLite uniqueness on `(account_id, hash)`. Exact repeats remain unchanged. Status changes and matching pending transactions can update existing rows.

This is not complete reconciliation: identical genuine purchases can collapse; changed completed transactions can become additional rows; fuzzy pending matching can select the wrong purchase. Same-status metadata corrections are ignored, and current update branches do not refresh installment metadata/type. The “hash” is a concatenated transaction string containing sensitive information. Do not change identity formulas without migration and regression coverage.

## Security and commercial limitations

`src/security/keychain.ts` checks environment variables, then `Bun.secrets`, then an encrypted-file fallback. The README's `secret-tool` wording does not describe the current implementation. Linux needs a working, unlocked Secret Service; one was not established here. Windows Credential Manager is not available on Linux.

The AES-256-GCM fallback stores `credentials.key` beside `credentials.enc`. Reading both permits decryption. Owner-only permissions do not protect against same-user processes, root, or compromised backups. SQLite itself is unencrypted. Do not upload real bank credentials into Codespaces during this phase.

Leave DEBUG unset, avoid sensitive screenshots/raw responses, and keep credentials, sessions, exports, and financial databases outside Git. Known-credential error sanitization is not complete PII redaction. Replacing JavaScript credential strings after use is not guaranteed memory erasure. Existing ignore rules do not cover every possible sensitive filename. The destination repository was public when inspected; repository visibility does not make committing financial data acceptable.

KolShek and the pinned scraper are MIT licensed; commercial use requires retaining applicable notices. Installed Puppeteer Core declares Apache-2.0; puppeteer-extra and its stealth plugin declare MIT. A manifest inventory of 515 installed package occurrences also found MPL-2.0 Lightning CSS packages, alongside MIT/ISC/BSD/Apache/0BSD and alternative license expressions. MPL permits commercial use with applicable file-level obligations. Manifest inspection is not a complete distribution-license or vulnerability audit.

Bank terms, automation restrictions, and relevant Israeli financial-information/privacy obligations require separate review before commercial use. Open-source licensing grants no right to bypass bank protections. No payment initiation is in scope.

## Scheduling and first real synchronization

Manual fetching (`kolshek fetch leumi max`) and `kolshek schedule set --every 12h` already exist. Neither was run. Incremental synchronization overlaps the last successful run by seven days by default. Linux prefers a systemd user timer, then cron. Codespaces suspension makes it unsuitable for permanent synchronization; presence of its systemctl executable does not establish a working user service. Current backend detection can select systemd even when the user service is unusable; crontab was absent in this environment.

A future persistent host can reuse Chromium, SQLite, the CLI, and the native scheduler without PostgreSQL or new services. Use a dedicated unprivileged user, protected persistent storage and backups, a working browser sandbox, and a reviewed credential source accessible to the scheduler. Use an installed compiled executable for scheduling rather than relying on source-mode binary resolution.

Before scheduling, address transient-error backoff, concurrent-run locking, safe alerts, and authentication failures. Current service-level retries are absent; configured navigation retry count is not forwarded. Structured scraper errors are not fully preserved through the service. Authentication status is inferred from recent failures rather than a live-session check. Database-processing failures can leave a running sync log. `--to` and `--force` are accepted but not enforced by the sync service.

On a fresh development machine with Bun and Chromium installed:

```bash
bun install --ignore-scripts
# Review native install scripts before executing this step:
npm rebuild better-sqlite3
bun run prebuild
bun run typecheck
bun run src/cli/index.ts --help

# Run these tests yourself after reviewing the changes:
bun run test -- tests/integration/leumi-max-sync.test.ts
bun run test -- tests/unit/dedup.test.ts tests/integration/database.test.ts
```

Use the package's Vitest command `bun run test`, not Bun's separate native test runner. Build artifacts, the local Bun installation, and node_modules are not transferred through Git. `bun run build` builds the executable; `bun run dev -- <command>` runs from source.

After explicit authorization, use a trusted personal computer or reviewed persistent host with protected storage and a verified credential backend. Enter credentials only through local interactive prompts, complete legitimate MFA, fetch a small date range, compare results locally with official statements, and repeat the fetch to inspect added/updated counts. Provider setup's connection test also makes a real scrape. If a challenge is unsupported, stop rather than bypass it. Read-only account/query commands may auto-fetch in interactive mode; use `--no-auto-fetch` when inspecting cached data.

Establish successful unattended authentication, reconciliation coverage, and error recovery before enabling any schedule or deployment. Neither is authorized by this development preparation.
