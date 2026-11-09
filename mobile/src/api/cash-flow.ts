import { requestApi } from './connections'

export interface FlowAccount {
  id: number
  name: string
  displayName: string | null
  group: string | null
}

export interface FlowTotal {
  currency: string
  income: number
  expenses: number
  net: number
}

export interface FlowReport {
  accounts: FlowAccount[]
  totals: FlowTotal[]
  breakdown: { accountId: number; totals: FlowTotal[] }[]
}

export interface FlowFilter {
  from: string
  to: string
  scope: string
}

export interface AccountOrganization {
  name: string | null
  group: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isTotal(value: unknown): value is FlowTotal {
  return isRecord(value)
    && typeof value.currency === 'string'
    && isAmount(value.income)
    && isAmount(value.expenses)
    && isAmount(value.net)
}

export async function getCashFlow(filter: FlowFilter, signal: AbortSignal): Promise<FlowReport> {
  const params = new URLSearchParams({ from: filter.from, to: filter.to })
  if (filter.scope.startsWith('g:')) params.set('group', filter.scope.slice(2))
  if (filter.scope.startsWith('a:')) params.set('accountId', filter.scope.slice(2))
  const data = await requestApi(`/api/v2/cash-flow?${params}`, { signal })
  if (!isRecord(data)
    || !Array.isArray(data.accounts)
    || !data.accounts.every((account: unknown): account is FlowAccount => isRecord(account)
      && isId(account.id)
      && typeof account.name === 'string'
      && isStringOrNull(account.displayName)
      && isStringOrNull(account.group))
    || !Array.isArray(data.totals) || !data.totals.every(isTotal)
    || !Array.isArray(data.breakdown)
    || !data.breakdown.every((row: unknown): row is FlowReport['breakdown'][number] =>
      isRecord(row) && isId(row.accountId) && Array.isArray(row.totals) && row.totals.every(isTotal))) {
    throw new Error('Invalid cash-flow response')
  }
  return { accounts: data.accounts, totals: data.totals, breakdown: data.breakdown }
}

export async function updateAccountOrganization(
  accountId: number,
  organization: AccountOrganization,
  signal: AbortSignal,
): Promise<void> {
  await requestApi(`/api/v2/accounts/${accountId}/organization`, {
    method: 'PATCH',
    body: organization,
    signal,
  })
}
