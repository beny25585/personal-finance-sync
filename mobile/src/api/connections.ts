// Client contracts for the authenticated connections API.
export type ConnectionType = 'bank' | 'credit_card'
export type ConnectionAuthStatus = 'no' | 'pending' | 'connected' | 'expired'

export interface ConnectionAccount {
  id: number
  accountNumber: string
  displayName: string | null
  balance: number | null
  currency: string
  excluded: boolean
}

export interface ConnectionProvider {
  id: number
  companyId: string
  alias: string
  displayName: string
  type: ConnectionType
  lastSyncedAt: string | null
  createdAt: string
  hasCredentials: boolean
  authStatus: ConnectionAuthStatus
  accountCount: number
  accounts: ConnectionAccount[]
  transactionCount: number
}

export interface Institution {
  companyId: string
  displayName: string
  type: ConnectionType
}

export interface ProviderFields extends Institution {
  loginFields: string[]
}

export interface NewConnection {
  companyId: string
  alias?: string
  credentials: Record<string, string>
}

export type ConnectionErrorCode =
  | 'unavailable'
  | 'unauthorized'
  | 'timeout'
  | 'invalidResponse'
  | 'requestFailed'
  | 'conflict'

export class ConnectionRequestError extends Error {
  readonly code: ConnectionErrorCode

  constructor(code: ConnectionErrorCode) {
    // Only stable local codes reach the UI; never forward server messages or payloads.
    super(code)
    this.name = 'ConnectionRequestError'
    this.code = code
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isId(value: unknown): value is number {
  return isCount(value) && value > 0
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isConnectionType(value: unknown): value is ConnectionType {
  return value === 'bank' || value === 'credit_card'
}

function isAccount(value: unknown): value is ConnectionAccount {
  return isRecord(value)
    && isId(value.id)
    && typeof value.accountNumber === 'string'
    && isNullableString(value.displayName)
    && (value.balance === null || (typeof value.balance === 'number' && Number.isFinite(value.balance)))
    && typeof value.currency === 'string'
    && typeof value.excluded === 'boolean'
}

function isProvider(value: unknown): value is ConnectionProvider {
  return isRecord(value)
    && isId(value.id)
    && typeof value.companyId === 'string'
    && typeof value.alias === 'string'
    && typeof value.displayName === 'string'
    && isConnectionType(value.type)
    && isNullableString(value.lastSyncedAt)
    && typeof value.createdAt === 'string'
    && typeof value.hasCredentials === 'boolean'
    && (value.authStatus === 'no' || value.authStatus === 'pending'
      || value.authStatus === 'connected' || value.authStatus === 'expired')
    && isCount(value.accountCount)
    && Array.isArray(value.accounts)
    && value.accounts.every(isAccount)
    && value.accountCount === value.accounts.length
    && isCount(value.transactionCount)
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  signal?: AbortSignal | null
  body?: unknown
  timeoutMs?: number
  mapErrorCode?: (code: string) => ConnectionRequestError | undefined
}

export async function requestApi(
  path: string,
  { method = 'GET', signal, body, timeoutMs = 10_000, mapErrorCode }: RequestOptions = {},
): Promise<unknown> {
  if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError')

  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch(path, {
      method,
      credentials: 'include',
      cache: 'no-store',
      redirect: 'error',
      headers: body === undefined
        ? { Accept: 'application/json' }
        : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    const isJson = response.headers.get('content-type')?.toLowerCase().includes('application/json')
    if (!response.ok && isJson && mapErrorCode) {
      const failure: unknown = await response.json().catch(() => undefined)
      if (isRecord(failure) && isRecord(failure.error) && typeof failure.error.code === 'string') {
        const error = mapErrorCode(failure.error.code)
        if (error) throw error
      }
    }
    if (response.status === 401 || response.status === 403) {
      throw new ConnectionRequestError('unauthorized')
    }
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw new ConnectionRequestError('unavailable')
    }
    if (method !== 'GET' && response.status === 409) throw new ConnectionRequestError('conflict')
    if (!response.ok) throw new ConnectionRequestError('requestFailed')
    if (!isJson) {
      throw new ConnectionRequestError('invalidResponse')
    }

    const envelope: unknown = await response.json()
    if (!isRecord(envelope) || envelope.success !== true || !('data' in envelope)) {
      throw new ConnectionRequestError('invalidResponse')
    }
    return envelope.data
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError')
    if (timedOut) throw new ConnectionRequestError('timeout')
    if (error instanceof ConnectionRequestError) throw error
    if (error instanceof SyntaxError) throw new ConnectionRequestError('invalidResponse')
    throw new ConnectionRequestError('unavailable')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

export async function getConnections(signal?: AbortSignal): Promise<ConnectionProvider[]> {
  const data = await requestApi('/api/v2/providers', { signal })
  if (!Array.isArray(data) || !data.every(isProvider)) {
    throw new ConnectionRequestError('invalidResponse')
  }
  const ids = new Set(data.map((provider) => provider.id))
  if (ids.size !== data.length) throw new ConnectionRequestError('invalidResponse')
  return data
}

export async function getProviderFields(
  companyId: string,
  signal?: AbortSignal,
): Promise<ProviderFields> {
  const data = await requestApi(`/api/v2/providers/fields/${encodeURIComponent(companyId)}`, { signal })
  if (!isRecord(data)
    || data.companyId !== companyId
    || typeof data.displayName !== 'string'
    || !isConnectionType(data.type)
    || !Array.isArray(data.loginFields)
    || data.loginFields.length === 0
    || !data.loginFields.every((field: unknown) => typeof field === 'string')) {
    throw new ConnectionRequestError('invalidResponse')
  }
  return {
    companyId,
    displayName: data.displayName,
    type: data.type,
    loginFields: data.loginFields,
  }
}

export async function getInstitutions(signal?: AbortSignal): Promise<Institution[]> {
  const data = await requestApi('/api/v2/providers/catalog', { signal })
  if (!Array.isArray(data) || !data.every((institution): institution is Institution => (
    isRecord(institution)
    && typeof institution.companyId === 'string'
    && typeof institution.displayName === 'string'
    && isConnectionType(institution.type)
  ))) {
    throw new ConnectionRequestError('invalidResponse')
  }
  if (new Set(data.map((institution) => institution.companyId)).size !== data.length) {
    throw new ConnectionRequestError('invalidResponse')
  }
  return data
}

export async function createConnection(connection: NewConnection, signal?: AbortSignal): Promise<void> {
  const data = await requestApi('/api/v2/providers', { method: 'POST', signal, body: connection })
  if (!isRecord(data) || !isId(data.id) || data.companyId !== connection.companyId) {
    throw new ConnectionRequestError('invalidResponse')
  }
}

export async function syncConnection(providerId: number, signal: AbortSignal): Promise<boolean> {
  const response = await fetch('/api/v2/fetch', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    redirect: 'error',
    headers: { Accept: 'text/event-stream', 'Content-Type': 'application/json' },
    body: JSON.stringify({ providers: [providerId] }),
    signal,
  })
  if (response.status === 409) throw new ConnectionRequestError('conflict')
  if (response.status === 401 || response.status === 403) throw new ConnectionRequestError('unauthorized')
  if (!response.ok) throw new ConnectionRequestError('requestFailed')
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
    throw new ConnectionRequestError('invalidResponse')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) throw new ConnectionRequestError('invalidResponse')

      pending += decoder.decode(chunk.value, { stream: true })
      // The local sync endpoint emits one JSON data line per LF-delimited SSE event.
      const events = pending.split('\n\n')
      pending = events.pop() ?? ''
      for (const event of events) {
        if (!event.startsWith('data: ')) continue
        const data: unknown = JSON.parse(event.slice('data: '.length))
        if (!isRecord(data)) throw new ConnectionRequestError('invalidResponse')
        if (data.type === 'error') return false
        if (data.type === 'done') {
          if (typeof data.success !== 'boolean') throw new ConnectionRequestError('invalidResponse')
          return data.success
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
