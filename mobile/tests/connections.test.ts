import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { effectScope } from 'vue'
import {
  ConnectionRequestError,
  getConnections,
  getProviderFields,
  type ConnectionErrorCode,
} from '../src/api/connections.ts'
import { useConnections } from '../src/composables/useConnections.ts'

function stubFetch(context: TestContext, handler: typeof fetch): void {
  const previous = globalThis.fetch
  globalThis.fetch = handler
  context.after(() => { globalThis.fetch = previous })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function emptyResponse(): Response {
  return jsonResponse({ success: true, data: [] })
}

function unavailableResponse(): Response {
  return jsonResponse({ success: false, error: { code: 'ISOLATED_API_UNAVAILABLE' } }, 503)
}

function hasErrorCode(code: ConnectionErrorCode) {
  return (error: unknown) => error instanceof ConnectionRequestError && error.code === code
}

function scopedConnections(context: TestContext) {
  const scope = effectScope()
  context.after(() => { scope.stop() })
  const state = scope.run(() => useConnections())
  assert.ok(state)
  return { scope, state }
}

test('an authenticated successful empty provider response is accepted through a read-only request', async (context) => {
  stubFetch(context, async (input, init) => {
    assert.equal(input, '/api/v2/providers')
    assert.equal(init?.method, 'GET')
    assert.equal(init?.credentials, 'include')
    assert.equal(init?.cache, 'no-store')
    assert.equal(init?.body, undefined)
    return emptyResponse()
  })

  assert.deepEqual(await getConnections(), [])
})

test('malformed or non-JSON replies are errors rather than successful empty lists', async (context) => {
  const replies = [
    new Response('<html>Development server fallback</html>', { headers: { 'Content-Type': 'text/html' } }),
    new Response('{invalid-json', { headers: { 'Content-Type': 'application/json' } }),
    jsonResponse([]),
    jsonResponse({ success: true }),
    jsonResponse({ success: true, data: null }),
    jsonResponse({ success: true, data: {} }),
    jsonResponse({ success: true, data: [null] }),
    jsonResponse({ success: false, data: [] }),
  ]
  stubFetch(context, async () => {
    const reply = replies.shift()
    assert.ok(reply)
    return reply
  })

  while (replies.length) {
    await assert.rejects(getConnections(), hasErrorCode('invalidResponse'))
  }
})

test('authentication failures remain distinguishable from an empty connection list', async (context) => {
  const statuses = [401, 403]
  stubFetch(context, async () => jsonResponse({ success: false }, statuses.shift()))

  await assert.rejects(getConnections(), hasErrorCode('unauthorized'))
  await assert.rejects(getConnections(), hasErrorCode('unauthorized'))
})

test('an unavailable backend or a network failure never becomes an empty success', async (context) => {
  const statuses = [502, 503, 504]
  stubFetch(context, async () => {
    const status = statuses.shift()
    if (status === undefined) throw new TypeError('Network unavailable')
    return jsonResponse({ success: false }, status)
  })

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await assert.rejects(getConnections(), hasErrorCode('unavailable'))
  }
})

test('provider field reads use only the existing Leumi and MAX GET endpoints', async (context) => {
  const requestedPaths: string[] = []
  stubFetch(context, async (input, init) => {
    requestedPaths.push(String(input))
    assert.equal(init?.method, 'GET')
    assert.equal(init?.body, undefined)
    const companyId = String(input).endsWith('/leumi') ? 'leumi' : 'max'
    return jsonResponse({
      success: true,
      data: {
        companyId,
        displayName: companyId === 'leumi' ? 'Bank Leumi' : 'Max',
        type: companyId === 'leumi' ? 'bank' : 'credit_card',
        loginFields: ['username', 'password'],
      },
    })
  })

  assert.equal((await getProviderFields('leumi')).companyId, 'leumi')
  assert.equal((await getProviderFields('max')).companyId, 'max')
  assert.deepEqual(requestedPaths, [
    '/api/v2/providers/fields/leumi',
    '/api/v2/providers/fields/max',
  ])
})

test('a field response for another institution is rejected', async (context) => {
  stubFetch(context, async () => jsonResponse({
    success: true,
    data: { companyId: 'max', displayName: 'Max', type: 'credit_card', loginFields: ['username', 'password'] },
  }))

  await assert.rejects(getProviderFields('leumi'), hasErrorCode('invalidResponse'))
})

test('repeated load actions do not create concurrent requests', async (context) => {
  const pending = Promise.withResolvers<Response>()
  let requests = 0
  stubFetch(context, async () => {
    requests += 1
    return pending.promise
  })
  const { state } = scopedConnections(context)
  const firstLoad = state.load()
  context.after(async () => {
    pending.resolve(emptyResponse())
    await firstLoad
  })

  await state.load()
  assert.equal(requests, 1)
  assert.equal(state.status.value, 'loading')
  assert.equal(state.hasLoaded.value, false)
  pending.resolve(emptyResponse())
  await firstLoad
  assert.equal(state.status.value, 'loaded')
  assert.equal(state.hasLoaded.value, true)
})

test('a cancelled late success cannot overwrite a newer failed request', async (context) => {
  const pending = Promise.withResolvers<Response>()
  const signals: (AbortSignal | null | undefined)[] = []
  let requests = 0
  stubFetch(context, async (_input, init) => {
    signals.push(init?.signal)
    requests += 1
    return requests === 1 ? pending.promise : unavailableResponse()
  })
  const { state } = scopedConnections(context)
  const staleLoad = state.load()
  context.after(async () => {
    pending.resolve(emptyResponse())
    await staleLoad
  })

  state.cancel()
  assert.equal(signals[0]?.aborted, true)
  await state.load()
  assert.equal(state.status.value, 'error')
  assert.equal(state.errorCode.value, 'unavailable')
  pending.resolve(emptyResponse())
  await staleLoad
  assert.equal(state.status.value, 'error')
  assert.equal(state.errorCode.value, 'unavailable')
  assert.equal(state.hasLoaded.value, false)
})

test('disposing the Vue scope aborts work and ignores a late response', async (context) => {
  const pending = Promise.withResolvers<Response>()
  const signals: (AbortSignal | null | undefined)[] = []
  stubFetch(context, async (_input, init) => {
    signals.push(init?.signal)
    return pending.promise
  })
  const { scope, state } = scopedConnections(context)
  const pendingLoad = state.load()
  context.after(async () => {
    pending.resolve(emptyResponse())
    await pendingLoad
  })

  scope.stop()
  assert.equal(signals[0]?.aborted, true)
  pending.resolve(emptyResponse())
  await pendingLoad
  assert.equal(state.status.value, 'idle')
  assert.equal(state.hasLoaded.value, false)
  assert.equal(state.errorCode.value, null)
  await state.load()
  assert.equal(signals.length, 1)
})

test('a failed refresh preserves the previous successful load while exposing the error', async (context) => {
  let requests = 0
  stubFetch(context, async () => {
    requests += 1
    return requests === 1 ? emptyResponse() : unavailableResponse()
  })
  const { state } = scopedConnections(context)

  await state.load()
  assert.equal(state.hasLoaded.value, true)
  await state.retry()
  assert.equal(state.status.value, 'error')
  assert.equal(state.errorCode.value, 'unavailable')
  assert.equal(state.hasLoaded.value, true)
  assert.deepEqual(state.providers.value, [])
})
