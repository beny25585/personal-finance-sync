import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { getDbPath } from "../config/loader.js";
import { getMoneytorAssets, MoneytorError } from "../services/moneytor-client.js";
import {
  clearMoneytorSelection, discoverMoneytorAccounts, moneytorStatus, saveMoneytorAccounts, syncMoneytor,
} from "../services/moneytor.js";

const root = "/api/v2/moneytor";
const errorStatus: Record<string, number> = {
  tokenInvalid: 400, premiumRequired: 403, rateLimited: 429, apiUnavailable: 502,
  invalidResponse: 502, notConfigured: 409, invalidSelection: 409, noAccounts: 409,
  busy: 409, overlappingSource: 409, invalidDate: 400, storageUnavailable: 503,
};
const errorMessage: Record<string, string> = {
  tokenInvalid: "Moneytor rejected the API token.",
  premiumRequired: "Moneytor API access requires an eligible plan.",
  rateLimited: "Moneytor's request limit was reached.",
  apiUnavailable: "Could not reach Moneytor.",
  invalidResponse: "Moneytor did not return a complete response.",
  notConfigured: "Save a Moneytor API token first.",
  invalidSelection: "Discover and select the accounts again.",
  noAccounts: "Select at least one account to import.",
  busy: "Another Moneytor operation is in progress.",
  overlappingSource: "This account may overlap an existing import.",
  invalidDate: "Choose a valid date range of up to 366 days.",
  storageUnavailable: "Could not access local credential storage.",
};

type Result = { data: unknown } | { code: string; error: string; status: number };
let working = false;

function credentialSlot() {
  return {
    service: "kolshek-moneytor",
    name: createHash("sha256").update(resolve(getDbPath())).digest("hex"),
  };
}

async function withSecretStore<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new MoneytorError("storageUnavailable");
  }
}

function getToken(): Promise<string | null> {
  return withSecretStore(() => Bun.secrets.get(credentialSlot()));
}

async function bodyOf(req: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // Invalid JSON is reported as an invalid value for the requested operation.
  }
  return {};
}

function dateValue(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return NaN;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value ? date.valueOf() : NaN;
}

function readRange(body: Record<string, unknown>): { from: string; to: string } {
  const { from, to } = body;
  const days = (dateValue(to) - dateValue(from)) / 86_400_000;
  if (!Number.isInteger(days) || days < 0 || days >= 366) throw new MoneytorError("invalidDate");
  return { from: from as string, to: to as string };
}

function failure(code: string): Result {
  return { code, error: errorMessage[code] ?? "The Moneytor operation could not be completed.", status: errorStatus[code] ?? 500 };
}

export async function handleMoneytor(req: Request, path: string): Promise<Result | undefined> {
  const method = req.method;
  if (path === root && method === "GET") {
    try {
      return { data: moneytorStatus(Boolean(await getToken())) };
    } catch (err) {
      return failure(err instanceof MoneytorError ? err.code : "operationFailed");
    }
  }
  const tokenAction = path === root && (method === "PUT" || method === "DELETE");
  const selection = path === root + "/accounts" && method === "PUT";
  const discover = path === root + "/discover" && method === "POST";
  const sync = path === root + "/sync" && method === "POST";
  if (!tokenAction && !selection && !discover && !sync) return undefined;
  if (working) return failure("busy");
  working = true;
  try {
    if (tokenAction && method === "DELETE") {
      await withSecretStore(() => Bun.secrets.delete(credentialSlot()));
      clearMoneytorSelection();
      return { data: moneytorStatus(false) };
    }
    const body = await bodyOf(req);
    if (tokenAction) {
      const token = typeof body.token === "string" ? body.token.trim() : "";
      if (token.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
        throw new MoneytorError("tokenInvalid");
      }
      await getMoneytorAssets(token);
      await withSecretStore(() => Bun.secrets.set({ ...credentialSlot(), value: token }));
      clearMoneytorSelection();
      return { data: moneytorStatus(true) };
    }
    const token = await getToken();
    if (!token) throw new MoneytorError("notConfigured");
    if (selection) {
      const ids = body.accountIds;
      if (!Array.isArray(ids) || ids.length > 100
        || !ids.every(id => typeof id === "string" && /^[a-f0-9]{64}$/.test(id))) {
        throw new MoneytorError("invalidSelection");
      }
      return { data: saveMoneytorAccounts(ids) };
    }
    const range = readRange(body);
    return { data: discover ? await discoverMoneytorAccounts(token, range) : await syncMoneytor(token, range) };
  } catch (err) {
    return failure(err instanceof MoneytorError ? err.code : "operationFailed");
  } finally {
    working = false;
  }
}
