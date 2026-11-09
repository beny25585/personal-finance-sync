import { ConnectionRequestError, requestApi } from './connections'

export interface MoneytorAccount {
  id: string
  label: string
  bank: string | null
  selected: boolean
}

export interface MoneytorStatus {
  configured: boolean
  accounts: MoneytorAccount[]
  lastSync: string | null
}

export interface MoneytorDateRange {
  from: string
  to: string
}

export interface MoneytorSyncResult {
  imported: number
  updated: number
  skipped: number
  lastSync: string
}

const moneytorErrorCodes = [
  'tokenInvalid', 'premiumRequired', 'rateLimited', 'apiUnavailable', 'invalidResponse',
  'notConfigured', 'invalidSelection', 'noAccounts', 'busy', 'overlappingSource',
  'invalidDate', 'storageUnavailable',
] as const

type MoneytorServiceError = typeof moneytorErrorCodes[number]

export type MoneytorErrorCode = MoneytorServiceError | 'sessionExpired' | 'timeout' | 'requestFailed'

class MoneytorRequestError extends ConnectionRequestError {
  constructor(readonly reason: MoneytorServiceError) {
    super('requestFailed')
    this.name = 'MoneytorRequestError'
  }
}

function mapErrorCode(code: string): ConnectionRequestError | undefined {
  const reason = moneytorErrorCodes.find((value) => value === code)
  return reason ? new MoneytorRequestError(reason) : undefined
}

export function getMoneytorErrorCode(error: unknown): MoneytorErrorCode {
  if (error instanceof MoneytorRequestError) return error.reason
  if (!(error instanceof ConnectionRequestError)) return 'requestFailed'
  if (error.code === 'unauthorized') return 'sessionExpired'
  if (error.code === 'unavailable') return 'apiUnavailable'
  if (error.code === 'conflict') return 'busy'
  return error.code
}

const moneytorPath = '/api/v2/moneytor'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isMoneytorAccount(value: unknown): value is MoneytorAccount {
  return isRecord(value)
    && typeof value.id === 'string' && value.id.length > 0
    && typeof value.label === 'string' && value.label.length > 0
    && (value.bank === null || typeof value.bank === 'string')
    && typeof value.selected === 'boolean'
}

function readStatus(data: unknown): MoneytorStatus {
  if (!isRecord(data) || typeof data.configured !== 'boolean'
    || !Array.isArray(data.accounts) || !data.accounts.every(isMoneytorAccount)
    || !(data.lastSync === null || isTimestamp(data.lastSync))
    || new Set(data.accounts.map((account) => account.id)).size !== data.accounts.length) {
    throw new MoneytorRequestError('invalidResponse')
  }
  return {
    configured: data.configured,
    accounts: data.accounts.map(({ id, label, bank, selected }) => ({ id, label, bank, selected })),
    lastSync: data.lastSync,
  }
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export async function getMoneytorStatus(signal: AbortSignal): Promise<MoneytorStatus> {
  return readStatus(await requestApi(moneytorPath, { signal, mapErrorCode }))
}

export async function saveMoneytorToken(token: string, signal: AbortSignal): Promise<MoneytorStatus> {
  const request = requestApi(moneytorPath, { method: 'PUT', body: { token }, signal, mapErrorCode, timeoutMs: 30_000 })
  token = ''
  return readStatus(await request)
}

export async function disconnectMoneytor(signal: AbortSignal): Promise<MoneytorStatus> {
  return readStatus(await requestApi(moneytorPath, { method: 'DELETE', signal, mapErrorCode }))
}

export async function discoverMoneytorAccounts(range: MoneytorDateRange, signal: AbortSignal): Promise<MoneytorStatus> {
  return readStatus(await requestApi(moneytorPath + '/discover', {
    method: 'POST', body: range, signal, mapErrorCode, timeoutMs: 120_000,
  }))
}

export async function saveMoneytorAccounts(accountIds: string[], signal: AbortSignal): Promise<MoneytorStatus> {
  return readStatus(await requestApi(moneytorPath + '/accounts', {
    method: 'PUT', body: { accountIds }, signal, mapErrorCode,
  }))
}

export async function syncMoneytor(range: MoneytorDateRange, signal: AbortSignal): Promise<MoneytorSyncResult> {
  const data = await requestApi(moneytorPath + '/sync', {
    method: 'POST', body: range, signal, mapErrorCode, timeoutMs: 120_000,
  })
  if (!isRecord(data) || !isCount(data.imported) || !isCount(data.updated) || !isCount(data.skipped)
    || !isTimestamp(data.lastSync)) {
    throw new MoneytorRequestError('invalidResponse')
  }
  return { imported: data.imported, updated: data.updated, skipped: data.skipped, lastSync: data.lastSync }
}
