// Windows-only development entry point. Reuses the existing database and HTTP API.
// Run with Bun's --no-env-file --no-install --no-macros flags; see docs/windows-isolated-server.md.

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";

const repositoryRoot = resolve(import.meta.dir, "..");

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      "prepare-only": { type: "boolean", default: false },
      port: { type: "string", default: "0" },
      help: { type: "boolean", default: false },
    },
    strict: true,
  });

  if (values.help) {
    console.log("Usage: bun --no-env-file --no-install --no-macros scripts/dev-isolated-server.ts [--prepare-only] [--port 0]");
    return;
  }
  if (process.platform !== "win32") {
    throw new Error("This isolated development entry point currently supports Windows only.");
  }
  if (!/^\d+$/.test(values.port)) {
    throw new Error("Port must be an integer from 0 to 65535.");
  }
  const port = Number(values.port);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
    throw new Error("Port must be an integer from 0 to 65535.");
  }

  // Set paths before importing application modules, which capture env-paths at import time.
  const cacheRoot = join(repositoryRoot, "node_modules", ".cache", "kolshek-isolated-server");
  await mkdir(cacheRoot, { recursive: true });
  const runRoot = await mkdtemp(join(cacheRoot, "run-"));
  for (const key of Object.keys(process.env)) {
    if (key.toUpperCase().startsWith("KOLSHEK_") || key.toUpperCase() === "DEBUG") {
      delete process.env[key];
    }
  }
  process.env.APPDATA = join(runRoot, "roaming");
  process.env.LOCALAPPDATA = join(runRoot, "local");

  const { getAppPaths, ensureDirectories } = await import("../src/config/loader.js");
  for (const path of Object.values(getAppPaths())) {
    const child = relative(runRoot, path);
    if (!child || child === ".." || child.startsWith("..\\") || isAbsolute(child)) {
      throw new Error("Application paths did not resolve inside the isolated directory.");
    }
  }
  const { restrictPathToOwner } = await import("../src/security/permissions.js");
  restrictPathToOwner(runRoot);
  await ensureDirectories();

  const { initDatabase, closeDatabase } = await import("../src/db/database.js");
  const database = initDatabase(":memory:");
  let running = false;
  try {
    const tables = ["providers", "accounts", "transactions", "sync_log"] as const;
    for (const table of tables) {
      const row = database.query<{ count: number }, []>(`SELECT COUNT(*) AS count FROM ${table}`).get();
      if (!row || row.count !== 0) {
        throw new Error("The isolated database must contain no financial records or providers.");
      }
    }
    console.log("Existing SQLite migrations applied to an empty in-memory database.");
    console.log("Providers, accounts, transactions, and sync logs are empty.");
    console.log(`Isolated profile: ${runRoot}`);

    if (values["prepare-only"]) return;
    if (!existsSync(join(repositoryRoot, "src", "web", "web-files.ts"))) {
      throw new Error("Web assets are missing. Run the existing 'bun run prebuild' from the repository root first.");
    }

    // This file stays under ignored node_modules and never replaces the regular .dev-session.
    const sessionPath = join(runRoot, ".dev-session");
    await writeFile(sessionPath, "", { flag: "wx", mode: 0o600 });
    restrictPathToOwner(sessionPath);

    const { startDashboard } = await import("../src/web/server.js");
    const { server } = startDashboard(port, {
      connectionsReadOnly: true,
      devSessionPath: sessionPath,
    });
    const discoveryPath = join(cacheRoot, "active-server.json");
    const sessionFile = relative(cacheRoot, sessionPath).replaceAll("\\", "/");
    try {
      const pendingDiscoveryPath = join(runRoot, "active-server.json.tmp");
      await writeFile(pendingDiscoveryPath, JSON.stringify({
        version: 1,
        mode: "connections-read-only",
        port: server.port,
        sessionFile,
      }), { flag: "wx", mode: 0o600 });
      await rename(pendingDiscoveryPath, discoveryPath);
    } catch (error) {
      server.stop(true);
      throw error;
    }
    running = true;
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      await server.stop(true);
      closeDatabase();
      try {
        const discovery: unknown = JSON.parse(await readFile(discoveryPath, "utf8"));
        if (typeof discovery === "object" && discovery !== null && "sessionFile" in discovery && discovery.sessionFile === sessionFile) {
          await unlink(discoveryPath);
        }
      } catch { /* A stopped process must not remove another server's discovery file. */ }
      process.exit(0);
    };
    process.once("SIGINT", () => { void stop(); });
    process.once("SIGTERM", () => { void stop(); });
    console.log(`Isolated connection API: http://127.0.0.1:${server.port}`);
    console.log(`Session file: ${sessionPath}`);
    console.log("Only authenticated connection-list and Leumi/MAX field reads are available.");
    console.log("Press Ctrl+C to stop. The in-memory database is discarded on shutdown.");
  } finally {
    if (!running) closeDatabase();
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unable to start the isolated server.");
  process.exitCode = 1;
}
