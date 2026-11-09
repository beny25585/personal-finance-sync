import { computed, shallowRef, watch, type Ref } from 'vue'
import { isHostedFinanceApp } from '../api/host'
import { getLedgerPage, type LedgerPage } from '../api/transactions'

const PAGE_SIZE = 25

export function useTransactionList(query: Readonly<Ref<string>>) {
  const loaded = shallowRef<(LedgerPage & { offset: number }) | null>(null)
  const loading = shallowRef(isHostedFinanceApp)
  const failed = shallowRef(false)
  const requestedPage = shallowRef({ query: '', offset: 0 })
  const reloadCount = shallowRef(0)
  const offset = computed(() => requestedPage.value.query === query.value ? requestedPage.value.offset : 0)

  const canGoBack = computed(() => (loaded.value?.offset ?? 0) > 0)
  const canGoForward = computed(() => loaded.value !== null
    && loaded.value.offset + loaded.value.transactions.length < loaded.value.total)

  if (isHostedFinanceApp) {
    watch([query, offset, reloadCount], ([currentQuery, currentOffset], previous, onCleanup) => {
      const filtersChanged = previous?.[0] !== undefined && previous[0] !== currentQuery
      if (filtersChanged) requestedPage.value = { query: currentQuery, offset: 0 }
      const controller = new AbortController()
      loading.value = true
      failed.value = false

      const timer = setTimeout(async () => {
        try {
          const page = await getLedgerPage(currentQuery, currentOffset, PAGE_SIZE, controller.signal)
          if (controller.signal.aborted) return
          if (currentOffset > 0 && currentOffset >= page.total) {
            requestedPage.value = {
              query: currentQuery,
              offset: Math.max(0, Math.ceil(page.total / PAGE_SIZE) - 1) * PAGE_SIZE,
            }
          } else {
            loaded.value = { ...page, offset: currentOffset }
            loading.value = false
          }
        } catch {
          if (controller.signal.aborted) return
          failed.value = true
          loading.value = false
        }
      }, filtersChanged ? 250 : 0)

      onCleanup(() => {
        clearTimeout(timer)
        controller.abort()
      })
    }, { immediate: true })
  }

  function changePage(direction: -1 | 1): void {
    if (loading.value || failed.value || !loaded.value
      || (direction === -1 ? !canGoBack.value : !canGoForward.value)) return
    requestedPage.value = { query: query.value, offset: loaded.value.offset + direction * PAGE_SIZE }
  }

  return {
    loaded,
    loading,
    failed,
    canGoBack,
    canGoForward,
    changePage,
    retry: () => { reloadCount.value += 1 },
  }
}
