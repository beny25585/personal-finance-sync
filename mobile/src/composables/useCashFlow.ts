import { onScopeDispose, shallowRef } from 'vue'
import { getCashFlow, type FlowFilter, type FlowReport } from '../api/cash-flow'

function localDate(year: number, month: number, day: number): string {
  return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-')
}

export function currentMonth(): FlowFilter {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return { from: localDate(year, month, 1), to: localDate(year, month, now.getDate()), scope: '' }
}

export function useCashFlow() {
  const report = shallowRef<FlowReport>()
  const applied = shallowRef<FlowFilter>()
  const loading = shallowRef(false)
  const failed = shallowRef(false)
  let request: AbortController | undefined

  async function load(filter: FlowFilter): Promise<void> {
    request?.abort()
    const next = new AbortController()
    request = next
    loading.value = true
    failed.value = false
    try {
      const result = await getCashFlow(filter, next.signal)
      if (request === next && !next.signal.aborted) {
        report.value = result
        applied.value = filter
      }
    } catch {
      if (request === next && !next.signal.aborted) failed.value = true
    } finally {
      if (request === next) loading.value = false
    }
  }

  onScopeDispose(() => request?.abort())

  return { report, applied, loading, failed, load }
}
