import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import puppeteer from 'puppeteer-core'
import { preview } from 'vite'

const mobileRoot = fileURLToPath(new URL('../', import.meta.url))
const storageKey = 'personal-finance-sync.locale'
const messages = {
  en: {
    heading: 'Personal Finance Sync',
    ready: 'Android app setup is ready.',
    label: 'Language',
    lang: 'en',
    dir: 'ltr',
  },
  he: {
    heading: 'סנכרון פיננסי אישי',
    ready: 'האפליקציה מוכנה לפיתוח.',
    label: 'שפת ממשק',
    lang: 'he',
    dir: 'rtl',
  },
}

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

  // Pass no application secrets or credential-bearing environment variables to Chrome.
  const browserEnv = Object.fromEntries(
    ['PATH', 'LANG', 'LC_ALL']
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]]),
  )
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
      headless: true,
      env: browserEnv,
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

async function openApp(t, { languages, savedValue, blockedStorage } = {}) {
  const context = await browser.createBrowserContext()
  t.after(async () => context.close())
  const page = await context.newPage()
  page.setDefaultTimeout(10_000)
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })

  const errors = []
  const blockedRequests = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin === new URL(appUrl).origin || ['data:', 'blob:'].includes(url.protocol)) {
      void request.continue()
    } else {
      blockedRequests.push(request.url())
      void request.abort()
    }
  })
  t.after(() => {
    assert.deepEqual(errors, [], 'The language controls must not cause uncaught browser errors.')
    assert.deepEqual(blockedRequests, [], 'These startup checks must not contact external services.')
  })

  await page.evaluateOnNewDocument(({ languages: preferred, savedValue: saved, blockedStorage: blocked, key }) => {
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
    } else if (typeof saved === 'string' && !sessionStorage.getItem('i18n-test-seeded')) {
      // Seed once per tab so reloading tests the app's actual saved selection.
      localStorage.setItem(key, saved)
      sessionStorage.setItem('i18n-test-seeded', '1')
    }
  }, { languages: languages || ['en-US'], savedValue, blockedStorage, key: storageKey })

  await page.goto(appUrl, { waitUntil: 'networkidle0' })
  return page
}

async function assertLocale(page, locale) {
  const expected = messages[locale]
  try {
    await page.waitForFunction((value) => (
      document.documentElement.lang === value.lang
      && document.documentElement.dir === value.dir
      && document.title === value.heading
      && document.querySelector('h1')?.textContent?.trim() === value.heading
      && document.querySelector('label[for="app-language"]')?.textContent?.trim() === value.label
      && document.querySelector('#app-language')?.value === value.lang
      && [...document.querySelectorAll('p')].some((item) => item.textContent?.trim() === value.ready)
    ), {}, expected)
  } catch (error) {
    const actual = await page.evaluate(() => ({
      heading: document.querySelector('h1')?.textContent?.trim(),
      paragraphs: [...document.querySelectorAll('p')].map((item) => item.textContent?.trim()),
      label: document.querySelector('label[for="app-language"]')?.textContent?.trim(),
      title: document.title,
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      selection: document.querySelector('#app-language')?.value,
    }))
    assert.fail(`Expected ${locale} startup text and document metadata; received ${JSON.stringify(actual)}. ${error.message}`)
  }
}

async function storedLocale(page) {
  return page.evaluate((key) => localStorage.getItem(key), storageKey)
}

test('Hebrew system language is not saved; explicit English/Hebrew choices persist and restore direction', { timeout: 30_000 }, async (t) => {
  const page = await openApp(t, { languages: ['he-IL', 'en-US'] })
  await assertLocale(page, 'he')
  assert.equal(await storedLocale(page), null, 'Detected language must not become an explicit preference.')

  const options = await page.$$eval('#app-language option', (items) => (
    Object.fromEntries(items.map((item) => [item.value, item.textContent.trim()]))
  ))
  assert.equal(options.en, 'English')
  assert.equal(options.he, 'עברית')

  await page.select('#app-language', 'en')
  await assertLocale(page, 'en')
  assert.equal(await storedLocale(page), 'en')
  await page.reload({ waitUntil: 'networkidle0' })
  await assertLocale(page, 'en')

  await page.select('#app-language', 'he')
  await assertLocale(page, 'he')
  assert.equal(await storedLocale(page), 'he')
  await page.reload({ waitUntil: 'networkidle0' })
  await assertLocale(page, 'he')

  await page.select('#app-language', 'en')
  await assertLocale(page, 'en')
  assert.equal(await storedLocale(page), 'en')
})

test('Unsupported system language and an invalid saved preference fall back to English', { timeout: 20_000 }, async (t) => {
  const page = await openApp(t, { languages: ['fr-FR'], savedValue: '{invalid-locale' })
  await assertLocale(page, 'en')

  await page.select('#app-language', 'he')
  await assertLocale(page, 'he')
  assert.equal(await storedLocale(page), 'he')
  await page.reload({ waitUntil: 'networkidle0' })
  await assertLocale(page, 'he')
})

for (const blockedStorage of ['getter', 'operations']) {
  test(`Language selection remains usable when localStorage ${blockedStorage} are blocked`, { timeout: 20_000 }, async (t) => {
    const page = await openApp(t, { languages: ['he-IL'], blockedStorage })
    await assertLocale(page, 'he')

    await page.select('#app-language', 'en')
    await assertLocale(page, 'en')
    await page.select('#app-language', 'he')
    await assertLocale(page, 'he')

    await page.reload({ waitUntil: 'networkidle0' })
    await assertLocale(page, 'he')
  })
}
