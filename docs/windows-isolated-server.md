# Isolated connection API on Windows

This development entry point reuses the existing Bun HTTP server, SQLite schema,
and migrations. It starts with a new **in-memory database on every launch**. It
does not populate providers, accounts, transactions, or sync logs. Stopping the
process discards the database.

Requirements: the existing root dependencies, Bun, and the actual generated Web
assets. The user runs the existing Web build from the repository root:

```powershell
& (Join-Path $env:USERPROFILE '.bun\bin\bun.exe') run prebuild
```

This generates the original React Web assets and embedded modules. It does not
build an APK. A generated file already tracked by Git may appear modified;
inspect that change separately before any Git operation.

Prepare the isolated profile and initialize the empty database without opening
an HTTP listener:

```powershell
& (Join-Path $env:USERPROFILE '.bun\bin\bun.exe') --no-env-file --no-install --no-macros scripts/dev-isolated-server.ts --prepare-only
```

Start the isolated server:

```powershell
& (Join-Path $env:USERPROFILE '.bun\bin\bun.exe') --no-env-file --no-install --no-macros scripts/dev-isolated-server.ts
```

The default uses an OS-assigned available port on `127.0.0.1`. Supply an explicit
`--port 45092` if required. The launcher prints the actual address and publishes
it for the Vue development server; no browser is opened. Use Ctrl+C to stop the
process.

The launcher creates a fresh profile under
`node_modules/.cache/kolshek-isolated-server/run-*`, which is ignored by Git. It
sets `APPDATA` and `LOCALAPPDATA` for this process before loading application
modules, verifies that application directories resolve inside that profile, and
clears inherited `KOLSHEK_*` and `DEBUG` variables. The command disables automatic
`.env` loading, package installation, and macros. The normal CLI startup path is
not used, so the default application database and update checks are not invoked.

The existing session authentication and origin checks remain active. The
launcher prints the isolated session-file **path**, without printing its value
or a token-bearing URL. It never overwrites the regular repository-root
`.dev-session`. Keep the isolated session file private; its token authorizes
access to this server while the process is running. It is not a bank credential.

After startup, `active-server.json` in the ignored cache contains the actual
port, the relative session-file path, and the `connections-read-only` mode. It
contains no token. Publication is atomic; graceful shutdown removes this file
only if it still describes this process. Stale metadata causes the Vue proxy to
fail rather than fall back to the normal dashboard.

The isolated mode permits only these authenticated data requests:

- `GET /api/v2/providers`
- `GET /api/v2/providers/fields/leumi`
- `GET /api/v2/providers/fields/max`

The authenticated development-only `GET /api/v2/dev/capabilities` identifies the
isolated mode without reading the database or credentials. It is used internally
by Vite and is not forwarded as a browser API endpoint.

The existing token-exchange endpoint and CORS preflight remain available. Other
authenticated requests are rejected before the application route handlers,
including provider/credential writes, sync, import, schedule access, and static
dashboard pages. An empty provider list never invokes the credential lookup.
Profile redirection alone would not isolate Windows Credential Manager; the
restricted endpoints and empty database prevent this launcher from reaching it.

The normal dashboard keeps its existing behavior unless explicitly started with
the isolated connection-read option. No SQLite, ingestion, transaction identity,
or duplicate-prevention logic is replaced.

The Vue development server now integrates with this backend through a restricted
server-side proxy; see [mobile setup](../mobile/README.md#local-connections-data).
Built Web previews and Android bundles remain disconnected. Android connectivity
and real bank authentication remain separate tasks. Do not enter bank credentials
into this development environment.

## Local verification

On 2026-11-02, the user ran `bun run prebuild` successfully on Windows. Root
TypeScript and a separate TypeScript check of the launcher passed. The launcher
applied the existing migrations to an empty in-memory database and started on
`127.0.0.1:45092`.

Local HTTP checks confirmed a 401 response without a session, successful empty
provider and Leumi/MAX field responses, and the existing session exchange with
HttpOnly/SameSite=Strict cookie attributes. Authenticated provider creation,
credential update, fetch, import, and schedule requests returned
`403 READ_ONLY_PREVIEW` before their route handlers. The provider list remained
empty. The isolated session file was ignored by Git; the regular root session
file did not exist.

These were backend startup and local HTTP checks. No automated test suite or
build was run by the agent, and no browser, Android, bank authentication,
personal credential storage, or real financial-data behavior was verified.

The subsequent Vue integration was checked through the development proxy: all
three data reads returned successful responses, disallowed routes and private
file requests were rejected, and missing/restored discovery produced a 503/200
transition. Connections rendered and refreshed the actual empty result in the
in-app browser at a 390×844 Hebrew/RTL viewport. The launcher now uses an
OS-assigned port and publishes discovery for Vite. The user subsequently reported
all ten connection tests, the Web build and all 15 browser tests passing. Two
existing CSS reference tests initially failed on Windows CRLF line endings.
After the parser fix and two regression checks, the user's unit rerun passed
all 43 tests. No automated test or build was run by the agent.
