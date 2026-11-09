import { computed, onScopeDispose, readonly, shallowRef } from 'vue'
import {
  ConnectionRequestError,
  getConnections,
  syncConnection,
  type ConnectionErrorCode,
  type ConnectionProvider,
} from '../api/connections.ts'

export type ConnectionsStatus = 'idle' | 'loading' | 'loaded' | 'error'

export function useConnections() {
  const providers = shallowRef<ConnectionProvider[]>([])
  const status = shallowRef<ConnectionsStatus>('idle')
  const hasLoaded = shallowRef(false)
  const errorCode = shallowRef<ConnectionErrorCode | null>(null)
  let activeRequest: AbortController | null = null
  let requestId = 0
  let disposed = false

  async function load(): Promise<void> {
    // Ignore repeated presses while a request is already running.
    if (disposed || activeRequest) return

    const currentId = ++requestId
    const controller = new AbortController()
    activeRequest = controller
    status.value = 'loading'
    errorCode.value = null

    try {
      const result = await getConnections(controller.signal)
      if (disposed || requestId !== currentId) return
      providers.value = result
      hasLoaded.value = true
      status.value = 'loaded'
    } catch (error) {
      if (disposed || requestId !== currentId) return
      errorCode.value = error instanceof ConnectionRequestError ? error.code : 'requestFailed'
      status.value = 'error'
    } finally {
      if (requestId === currentId) activeRequest = null
    }
  }

  function cancel(): void {
    requestId += 1
    activeRequest?.abort()
    activeRequest = null
    if (status.value === 'loading') status.value = hasLoaded.value ? 'loaded' : 'idle'
  }

  function refresh(): Promise<void> {
    cancel()
    return load()
  }

  onScopeDispose(() => {
    disposed = true
    cancel()
  })

  return {
    providers: readonly(providers),
    status: readonly(status),
    hasLoaded: readonly(hasLoaded),
    errorCode: readonly(errorCode),
    isLoading: computed(() => status.value === 'loading'),
    load,
    retry: load,
    refresh,
    cancel,
  }
}

export type ConnectionSyncStatus = 'success' | 'failed' | 'busy'

export function useConnectionSync(onSettled: () => void) {
  const activeProviderId = shallowRef<number | null>(null)
  const result = shallowRef<ConnectionSyncStatus | null>(null)
  let request: AbortController | null = null

  async function sync(providerId: number): Promise<void> {
    if (request) return
    const controller = new AbortController()
    request = controller
    activeProviderId.value = providerId
    result.value = null
    try {
      const success = await syncConnection(providerId, controller.signal)
      if (!controller.signal.aborted) result.value = success ? 'success' : 'failed'
    } catch (error) {
      if (!controller.signal.aborted) {
        result.value = error instanceof ConnectionRequestError && error.code === 'conflict' ? 'busy' : 'failed'
      }
    } finally {
      request = null
      activeProviderId.value = null
      if (!controller.signal.aborted) onSettled()
    }
  }

  onScopeDispose(() => request?.abort())

  return { activeProviderId: readonly(activeProviderId), result: readonly(result), sync }
}
