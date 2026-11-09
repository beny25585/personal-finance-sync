import type { LedgerTransaction } from '../api/transactions'

export function formatTransactionAccount(transaction: LedgerTransaction): string {
  const name = transaction.accountDisplayName?.trim()
  if (name) return name
  const suffix = transaction.accountNumber.match(/\d{4}$/)?.[0]
  return suffix ? [transaction.providerDisplayName, '\u2022\u2022\u2022\u2022' + suffix].join(' \u00b7 ') : transaction.providerDisplayName
}

export function formatTransactionDate(date: string, locale: string): string {
  const day = date.slice(0, 10)
  const value = new Date(day + 'T00:00:00Z')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(value.getTime())
    || value.toISOString().slice(0, 10) !== day) return date
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(value)
}

export function formatTransactionAmount(transaction: LedgerTransaction, locale: string): string {
  // A currency and its amount must come from the same pair.
  const chargedCurrency = transaction.chargedCurrency?.trim()
  const amount = chargedCurrency ? transaction.chargedAmount : transaction.originalAmount
  const currency = (chargedCurrency || transaction.originalCurrency).trim().toUpperCase()
  if (/^[A-Z]{3}$/.test(currency)) {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
  }
  return [new Intl.NumberFormat(locale).format(amount), currency].filter(Boolean).join(' ')
}
