import { getCashFlow, updateAccountOrganization, type CashFlowResult } from "../db/repositories/cash-flow.js";

type CashFlowResponse = { data: CashFlowResult | null } | { status: number; error: string };

function isDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const parsed = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseAccountId(value: string): number | undefined {
  if (!/^[1-9]\d*$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
}

function parseLabel(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const label = value.trim();
  if (label.length > 80 || /[\x00-\x1f\x7f]/.test(label)) return undefined;
  return label || null;
}

export async function handleCashFlow(req: Request, url: URL): Promise<CashFlowResponse | undefined> {
  if (req.method === "GET" && url.pathname === "/api/v2/cash-flow") {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!isDate(from) || !isDate(to) || from > to) {
      return { status: 400, error: "Provide an ordered from and to date in YYYY-MM-DD format." };
    }

    const groupParam = url.searchParams.get("group");
    const group = parseLabel(groupParam);
    if (groupParam !== null && !group) {
      return { status: 400, error: "Group must be a non-empty name of up to 80 characters." };
    }

    const accountParam = url.searchParams.get("accountId");
    const accountId = accountParam === null ? undefined : parseAccountId(accountParam);
    if (accountParam !== null && accountId === undefined) {
      return { status: 400, error: "Account ID must be a positive integer." };
    }
    return { data: getCashFlow({ from, to, group: group ?? undefined, accountId }) };
  }

  const accountMatch = /^\/api\/v2\/accounts\/([^/]+)\/organization$/.exec(url.pathname);
  if (req.method !== "PATCH" || !accountMatch) return undefined;

  const id = parseAccountId(accountMatch[1]);
  if (id === undefined) return { status: 400, error: "Account ID must be a positive integer." };

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { status: 400, error: "Provide a valid JSON body." };
  }
  if (typeof body !== "object" || body === null || !("name" in body) || !("group" in body)) {
    return { status: 400, error: "Provide both name and group." };
  }
  const name = parseLabel(body.name);
  const group = parseLabel(body.group);
  if (name === undefined || group === undefined) {
    return { status: 400, error: "Name and group must be null or text of up to 80 characters." };
  }

  return updateAccountOrganization(id, name, group)
    ? { data: null }
    : { status: 404, error: "Account not found." };
}
