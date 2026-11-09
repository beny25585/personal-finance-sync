# Personal Finance Sync

Personal Finance Sync is a fork of [KolShek](https://github.com/DaveDushi/kolshek) for tracking Israeli bank and credit-card activity in a local SQLite database. It keeps the `kolshek` CLI and original React dashboard and adds a Vue dashboard for smaller screens. The Vue interface is available in English, Hebrew (right to left), and Russian. Bank descriptions remain in their original language.

Use the Vue dashboard to manage connections, assign accounts to groups, and view cash flow for a selected date range. [Moneytor](docs/moneytor.md) provides a read-only source for your own linked checking accounts through its service. Existing direct connections use the inherited [`israeli-bank-scrapers`](https://github.com/eshaham/israeli-bank-scrapers) integration and require a compatible browser.

## Run from source

Install Bun for the backend and CLI. For the Vue app, install Node.js 22.18+ within the 22.x series or Node.js 24.12+ and npm. Install Chrome or Chromium if you plan to use the direct bank connectors. The Moneytor API connection itself does not require a browser scraper.

From the root of this checkout:

```sh
bun install --ignore-scripts
npm --prefix mobile ci --ignore-scripts
bun run prebuild
npm --prefix mobile run build
bun run dev -- dashboard --mobile
```

`prebuild` prepares the original dashboard assets used by the CLI. The final command opens the connected Vue dashboard on the local Bun server. If it does not open the browser, use the local URL printed in your terminal and keep that session URL private. Use **More → Settings** to choose the interface language and **More → Connections** to manage sources. The [Moneytor guide](docs/moneytor.md) covers account selection, sync, and disconnect.

The server uses your normal KolShek data directory. The standalone Vite preview and bundled Android app are separate from this connected dashboard. See the [mobile setup](mobile/README.md) for the isolated read-only development mode and Android prerequisites.

## CLI and original dashboard

These examples run this checkout. An installed executable uses the same `kolshek` commands.

```sh
bun run dev -- --no-auto-fetch accounts
bun run dev -- --no-auto-fetch accounts --json
bun run dev -- dashboard
```

See the [CLI reference](docs/commands.md) for reports, categorization, CSV import, and schedules. The [direct connection guide](docs/first-local-sync.md) covers the existing Leumi and MAX setup. Follow the [AI agent guide](docs/ai-agents.md) for the optional Claude Code, Codex, OpenCode, and OpenClaw integrations.

## Verify locally

Run these from the repository root after installing dependencies. The root tests use Vitest. If its SQLite adapter is unavailable, review the `better-sqlite3` install script before running `npm rebuild better-sqlite3`.

```sh
bun run typecheck
bun run test
bun run build
npm --prefix mobile run typecheck
npm --prefix mobile test
npm --prefix mobile run build
npm --prefix mobile run test:browser
```

The optional browser suite requires Chromium and the root `puppeteer-core` dependency. See [mobile setup](mobile/README.md#appearance-and-navigation) for the `CHROME_PATH` setting. These checks do not verify an actual Moneytor account. Live Moneytor verification is pending.

## Data and credentials

Keep credentials, API tokens, session URLs, exports, and SQLite databases out of Git and chat. Keep the dashboard on the trusted computer that owns the data. The Moneytor token is stored in the operating system’s credential store. Moneytor processes linked data in its own service. This app imports verified transactions for the checking accounts you select into local SQLite. See the [security guide](docs/security.md) for the inherited direct-connection storage.

## Credits and license

Based on [KolShek by David D](https://github.com/DaveDushi/kolshek). The original `analyze` and `review` agent skills were designed by [Adir Traitel](https://adirtraitel.com/). The fork retains the [MIT license and original copyright notice](LICENSE).
