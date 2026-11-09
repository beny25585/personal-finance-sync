import { ConnectionRequestError, requestApi } from './connections'

export interface LedgerTransaction {
  id: number
  date: string
  processedDate: string
  originalAmount: number
  originalCurrency: string
  chargedAmount: number
  chargedCurrency: string | null
  description: string
  category: string | null
  status: 'pending' | 'completed'
  providerDisplayName: string
  accountNumber: string
  accountDisplayName: string | null
}

export interface LedgerPage {
  transactions: LedgerTransaction[]
  total: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isLedgerTransaction(value: unknown): value is LedgerTransaction {
  return isRecord(value)
    && typeof value.id === 'number' && Number.isSafeInteger(value.id) && value.id > 0
    && typeof value.date === 'string'
    && typeof value.processedDate === 'string'
    && isAmount(value.originalAmount)
    && typeof value.originalCurrency === 'string'
    && isAmount(value.chargedAmount)
    && (value.chargedCurrency === null || typeof value.chargedCurrency === 'string')
    && typeof value.description === 'string'
    && (value.category === null || typeof value.category === 'string')
    && (value.status === 'pending' || value.status === 'completed')
    && typeof value.providerDisplayName === 'string'
    && typeof value.accountNumber === 'string'
    && (value.accountDisplayName === null || typeof value.accountDisplayName === 'string')
}

export async function getLedgerPage(
  query: string,
  offset: number,
  limit: number,
  signal: AbortSignal,
): Promise<LedgerPage> {
  const params = new URLSearchParams(query)
  params.set('offset', String(offset))
  params.set('limit', String(limit))
  const data = await requestApi(`/api/v2/transactions?${params}`, { signal })
  if (!isRecord(data)
    || typeof data.total !== 'number' || !Number.isSafeInteger(data.total) || data.total < 0
    || !Array.isArray(data.transactions) || data.transactions.length > limit
    || !data.transactions.every(isLedgerTransaction)
    || new Set(data.transactions.map((transaction) => transaction.id)).size !== data.transactions.length) {
    throw new ConnectionRequestError('invalidResponse')
  }
  return { transactions: data.transactions, total: data.total }
}

export async function getLedgerTransaction(
  id: number,
  signal: AbortSignal,
): Promise<LedgerTransaction | null> {
  const data = await requestApi(`/api/v2/transactions/${id}`, { signal })
  if (data === null) return null
  if (!isLedgerTransaction(data) || data.id !== id) {
    throw new ConnectionRequestError('invalidResponse')
  }
  return data
}
