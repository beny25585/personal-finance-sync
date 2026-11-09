import { computed, onScopeDispose, readonly, shallowRef } from 'vue'
import {
  disconnectMoneytor,
  discoverMoneytorAccounts,
  getMoneytorErrorCode,
  getMoneytorStatus,
  saveMoneytorAccounts,
  saveMoneytorToken,
  syncMoneytor,
  type MoneytorDateRange,
  type MoneytorErrorCode,
  type MoneytorStatus,
  type MoneytorSyncResult,
} from '../api/moneytor'

type MoneytorOperation = 'load' | 'token' | 'disconnect' | 'discover' | 'selection' | 'sync'
type MoneytorNotice = 'token' | 'disconnect' | 'selection'

const maxRangeDays = 366

function localDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function dayTimestamp(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return Number.NaN
  const time = Date.parse(value)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : Number.NaN
}

export function useMoneytor() {
  const today = new Date()
  const from = shallowRef(localDate(new Date(today.getFullYear(), today.getMonth(), 1)))
  const to = shallowRef(localDate(today))
  const status = shallowRef<MoneytorStatus | null>(null)
  const operation = shallowRef<MoneytorOperation | null>(null)
  const issue = shallowRef<MoneytorErrorCode | null>(null)
  const notice = shallowRef<MoneytorNotice | null>(null)
  const result = shallowRef<MoneytorSyncResult | null>(null)
  const draft = shallowRef<ReadonlySet<string> | null>(null)
  const persistedIds = computed(() => new Set(
    status.value?.accounts.filter((account) => account.selected).map((account) => account.id),
  ))
  const selectedIds = computed(() => draft.value ?? persistedIds.value)
  const rangeValid = computed(() => {
    const days = (dayTimestamp(to.value) - dayTimestamp(from.value)) / 86_400_000 + 1
    return days >= 1 && days <= maxRangeDays
  })
  let active: AbortController | null = null

  async function run<T>(
    name: MoneytorOperation,
    perform: (signal: AbortSignal) => Promise<T>,
    apply: (data: T) => void,
  ): Promise<void> {
    if (active) return
    const controller = new AbortController()
    active = controller
    operation.value = name
    issue.value = null
    notice.value = null
    result.value = null
    try {
      const data = await perform(controller.signal)
      if (!controller.signal.aborted) apply(data)
    } catch (error) {
      if (!controller.signal.aborted) issue.value = getMoneytorErrorCode(error)
    } finally {
      active = null
      operation.value = null
    }
  }

  function updateStatus(value: MoneytorStatus): void {
    status.value = value
    draft.value = null
  }

  function setSelected(id: string, checked: boolean): void {
    if (active || !status.value?.accounts.some((account) => account.id === id)) return
    const next = new Set(selectedIds.value)
    if (checked) next.add(id)
    else next.delete(id)
    const persisted = persistedIds.value
    draft.value = next.size === persisted.size && [...next].every((value) => persisted.has(value)) ? null : next
  }

  function load(): void {
    if (draft.value) return
    void run('load', getMoneytorStatus, updateStatus)
  }

  function saveToken(token: string): void {
    if (draft.value) return
    void run('token', (signal) => {
      const request = saveMoneytorToken(token, signal)
      token = ''
      return request
    }, (value) => {
      updateStatus(value)
      notice.value = 'token'
    })
  }

  function disconnect(): void {
    if (draft.value || !status.value?.configured) return
    void run('disconnect', disconnectMoneytor, (value) => {
      updateStatus(value)
      notice.value = 'disconnect'
    })
  }

  function currentRange(): MoneytorDateRange {
    return { from: from.value, to: to.value }
  }

  function discover(): void {
    if (!rangeValid.value || draft.value || !status.value?.configured) return
    const range = currentRange()
    void run('discover', (signal) => discoverMoneytorAccounts(range, signal), updateStatus)
  }

  function saveSelection(): void {
    if (!draft.value || !status.value?.configured) return
    const ids = [...draft.value]
    void run('selection', (signal) => saveMoneytorAccounts(ids, signal), (value) => {
      updateStatus(value)
      notice.value = 'selection'
    })
  }

  function discardSelection(): void {
    if (!active) draft.value = null
  }

  function sync(): void {
    if (!rangeValid.value || draft.value || !persistedIds.value.size || !status.value?.configured) return
    const range = currentRange()
    void run('sync', (signal) => syncMoneytor(range, signal), (value) => {
      if (status.value) status.value = { ...status.value, lastSync: value.lastSync }
      result.value = value
    })
  }

  onScopeDispose(() => active?.abort())

  return {
    from,
    to,
    maxRangeDays,
    status: readonly(status),
    operation: readonly(operation),
    issue: readonly(issue),
    notice: readonly(notice),
    result: readonly(result),
    selectedIds: readonly(selectedIds),
    selectionChanged: computed(() => draft.value !== null),
    rangeValid,
    load,
    saveToken,
    disconnect,
    discover,
    setSelected,
    saveSelection,
    discardSelection,
    sync,
  }
}
