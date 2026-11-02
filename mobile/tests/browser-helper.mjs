import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { after, before } from 'node:test'
import puppeteer from 'puppeteer-core'
import { preview } from 'vite'

export const localeStorageKey = 'personal-finance-sync.locale'
export const themeStorageKey = 'personal-finance-sync.theme'

export function createBrowserHarness() {
  const mobileRoot = fileURLToPath(new URL('../', import.meta.url))
  let server
  let browser
  let appUrl

  before(async () => {
    await access(new URL('../dist/index.html', import.meta.url)).catch(() => {
      throw new Error('Build the mobile app with npm run build before running browser tests.')
    })
    server = await preview({
      root: mobileRoot,
      configFile: false,
      logLevel: 'silent',
      preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false },
    })
    const address = server.httpServer.address()
    assert.ok(address && typeof address === 'object')
    appUrl = `http://127.0.0.1:${address.port}/`
    const env = Object.fromEntries(
      ['PATH', 'LANG', 'LC_ALL']
        .filter((key) => process.env[key] !== undefined)
        .map((key) => [key, process.env[key]]),
    )
    try {
      browser = await puppeteer.launch({
        executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
        headless: true,
        env,
        args: [
          '--disable-background-networking',
          '--disable-component-update',
          '--no-first-run',
          ...(process.env.BROWSER_NO_SANDBOX === '1' ? ['--no-sandbox'] : []),
        ],
      })
    } catch (error) {
      await server.close()
      server = undefined
      throw error
    }
  }, { timeout: 30_000 })

  after(async () => {
    try {
      await browser?.close()
    } finally {
      await server?.close()
    }
  })

  async function openApp(t, {
    path = '/overview',
    languages = ['en-US'],
    savedLocale,
    savedTheme,
    blockedStorage,
    colorScheme = 'light',
  } = {}) {
    const context = await browser.createBrowserContext()
    t.after(async () => context.close())
    const page = await context.newPage()
    page.setDefaultTimeout(10_000)
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: colorScheme }])

    const errors = []
    const forbiddenRequests = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      const url = new URL(request.url())
      const serviceCall = ['fetch', 'xhr', 'eventsource', 'websocket'].includes(request.resourceType())
        || /^\/api(?:\/|$)/.test(url.pathname)
      const localAsset = url.origin === new URL(appUrl).origin
        || ['data:', 'blob:'].includes(url.protocol)
      if (!serviceCall && localAsset) {
        void request.continue().catch(() => {})
      } else {
        forbiddenRequests.push({ url: request.url(), type: request.resourceType() })
        void request.abort().catch(() => {})
      }
    })
    t.after(() => {
      assert.deepEqual(errors, [], 'The shell must not cause uncaught browser errors.')
      assert.deepEqual(forbiddenRequests, [], 'The empty shell must use only local assets, without fetch/XHR/API calls.')
    })

    await page.evaluateOnNewDocument(({ preferred, locale, theme, blocked, localeKey, themeKey }) => {
      Object.defineProperty(navigator, 'languages', { configurable: true, get: () => preferred })
      Object.defineProperty(navigator, 'language', { configurable: true, get: () => preferred[0] || '' })
      if (blocked === 'getter') {
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          get() { throw new DOMException('Storage is blocked for this test.', 'SecurityError') },
        })
      } else if (blocked === 'operations') {
        for (const method of ['getItem', 'setItem', 'removeItem']) {
          Object.defineProperty(Storage.prototype, method, {
            configurable: true,
            value() { throw new DOMException('Storage is blocked for this test.', 'SecurityError') },
          })
        }
      } else if (!sessionStorage.getItem('shell-test-seeded')) {
        if (typeof locale === 'string') localStorage.setItem(localeKey, locale)
        if (typeof theme === 'string') localStorage.setItem(themeKey, theme)
        sessionStorage.setItem('shell-test-seeded', '1')
      }
    }, {
      preferred: languages,
      locale: savedLocale,
      theme: savedTheme,
      blocked: blockedStorage,
      localeKey: localeStorageKey,
      themeKey: themeStorageKey,
    })

    await page.goto(`${appUrl}#${path}`, { waitUntil: 'networkidle0' })
    return page
  }

  return { openApp }
}

export async function storedSetting(page, key) {
  return page.evaluate((name) => localStorage.getItem(name), key)
}
