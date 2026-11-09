// Development-only transport. Session material stays in the Vite process.
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

type UnavailableCode = 'ISOLATED_API_UNAVAILABLE' | 'SESSION_UNAVAILABLE'

class Unavailable extends Error {
  constructor(readonly code: UnavailableCode) {
    super(code)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readConnection(cacheRoot: string): Promise<{ origin: string; cookie: string }> {
  let discovery: unknown
  try {
    discovery = JSON.parse(await readFile(resolve(cacheRoot, 'active-server.json'), 'utf8'))
  } catch {
    throw new Unavailable('ISOLATED_API_UNAVAILABLE')
  }
  if (
    !isRecord(discovery)
    || discovery.version !== 1
    || discovery.mode !== 'connections-read-only'
    || typeof discovery.port !== 'number'
    || !Number.isInteger(discovery.port)
    || discovery.port < 1
    || discovery.port > 65535
    || typeof discovery.sessionFile !== 'string'
    || !/^run-[A-Za-z0-9_-]+[\\/]\.dev-session$/.test(discovery.sessionFile)
  ) {
    throw new Unavailable('ISOLATED_API_UNAVAILABLE')
  }

  let cookie: string
  try {
    cookie = (await readFile(resolve(cacheRoot, discovery.sessionFile), 'utf8')).trim()
  } catch {
    throw new Unavailable('SESSION_UNAVAILABLE')
  }
  if (!/^kolshek_session=[0-9a-f]{64}$/.test(cookie)) {
    throw new Unavailable('SESSION_UNAVAILABLE')
  }
  return { origin: `http://127.0.0.1:${discovery.port}`, cookie }
}

function sendError(response: ServerResponse, status: number, code: string): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify({
    success: false,
    error: {
      code,
      message: status === 403 ? 'This preview only permits connection reads.' : 'The isolated connection API is unavailable.',
      retryable: status === 503,
    },
  }))
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  if (response.status === 401) throw new Unavailable('SESSION_UNAVAILABLE')
  if (!response.ok) throw new Unavailable('ISOLATED_API_UNAVAILABLE')
  const body: unknown = await response.json()
  if (!isRecord(body) || body.success !== true) throw new Unavailable('ISOLATED_API_UNAVAILABLE')
  return body
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, cacheRoot: string): Promise<void> {
  // Exact paths also reject query-string tokens, redirects and unreviewed API routes.
  const allowedRead = request.method === 'GET' && (
    request.url === '/api/v2/providers'
    || /^\/api\/v2\/providers\/fields\/(leumi|max)$/.test(request.url ?? '')
  )
  if (!allowedRead) {
    sendError(response, 403, 'READ_ONLY_PREVIEW')
    return
  }

  const cancellation = new AbortController()
  const onClose = () => cancellation.abort()
  response.once('close', onClose)
  try {
    const { origin, cookie } = await readConnection(cacheRoot)
    const options: RequestInit = {
      headers: { Accept: 'application/json', Cookie: cookie },
      redirect: 'error',
      signal: AbortSignal.any([cancellation.signal, AbortSignal.timeout(5_000)]),
    }
    // A stale discovery file must not accidentally connect this UI to a normal dashboard.
    const capabilities = await readJson(await fetch(`${origin}/api/v2/dev/capabilities`, options))
    if (!isRecord(capabilities.data) || capabilities.data.mode !== 'connections-read-only') {
      throw new Unavailable('ISOLATED_API_UNAVAILABLE')
    }
    const body = await readJson(await fetch(`${origin}${request.url}`, options))
    if (response.destroyed) return
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    })
    // Do not forward cookies or other backend headers to the browser.
    response.end(JSON.stringify(body))
  } catch (error) {
    if (!response.destroyed) {
      sendError(response, 503, error instanceof Unavailable ? error.code : 'ISOLATED_API_UNAVAILABLE')
    }
  } finally {
    response.off('close', onClose)
  }
}

export function isolatedConnectionsApi(repositoryRoot: string): Plugin {
  const cacheRoot = resolve(repositoryRoot, 'node_modules', '.cache', 'kolshek-isolated-server')
  return {
    name: 'isolated-connections-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        // Vite's /@fs and ?raw handling must never serve local session material.
        let pathname: string
        try {
          pathname = decodeURIComponent((request.url ?? '').split('?')[0] ?? '').replaceAll('\\', '/').toLowerCase()
        } catch {
          sendError(response, 400, 'INVALID_REQUEST')
          return
        }
        if (pathname.split('/').some((part) => part === 'kolshek-isolated-server' || part === '.dev-session')) {
          sendError(response, 403, 'PRIVATE_DEVELOPMENT_FILE')
          return
        }
        if (!/^\/api(?:\/|$)/.test(request.url ?? '')) {
          next()
          return
        }
        void handleRequest(request, response, cacheRoot)
      })
    },
  }
}
