import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createBrowserHarness, storedSetting, themeStorageKey } from './browser-helper.mjs'

const { openApp } = createBrowserHarness()
const locales = {
  en: {
    brand: 'Personal Finance Sync',
    state: 'No financial data loaded',
    dir: 'ltr',
    headings: ['Overview', 'Accounts', 'Transactions', 'Settings'],
    tabs: ['Overview', 'Accounts', 'Transactions', 'Settings'],
    details: 'Transaction details',
  },
  he: {
    brand: 'סנכרון פיננסי אישי',
    state: 'לא נטענו נתונים כספיים',
    dir: 'rtl',
    headings: ['סקירה כללית', 'חשבונות', 'עסקאות', 'הגדרות'],
    tabs: ['סקירה', 'חשבונות', 'עסקאות', 'הגדרות'],
    details: 'פרטי עסקה',
  },
}
const pages = ['overview', 'accounts', 'transactions', 'settings']

async function assertPage(page, route, locale = 'en') {
  const expected = locales[locale]
  const heading = route === 'transactions/details'
    ? expected.details
    : expected.headings[pages.indexOf(route)]
  const wrapper = route === 'transactions/details' ? 'transaction-details-page' : `${route}-page`
  await page.waitForSelector(`[data-testid="${wrapper}"]`)
  await page.waitForFunction(({ route: path, locale: lang, direction, heading: title, brand, state }) => (
    location.hash === `#/${path}`
    && document.documentElement.lang === lang
    && document.documentElement.dir === direction
    && document.title === brand
    && document.querySelector('[data-testid="page-heading"]')?.textContent?.trim() === title
    && document.querySelector('[data-testid="app-brand"]')?.textContent?.trim() === brand
    && document.querySelector('[data-testid="financial-data-state"]')?.textContent?.trim() === state
  ), {}, { route, locale, direction: expected.dir, heading, brand: expected.brand, state: expected.state })

  const content = await page.evaluate(() => ({
    mainPresent: document.querySelector('main') !== null,
    text: document.querySelector('main')?.textContent || '',
    rows: document.querySelectorAll('[data-testid="transaction-row"], [data-testid="account-row"], [data-testid="account-card"]').length,
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  assert.equal(content.mainPresent, true, 'The shell must expose a main content landmark.')
  assert.equal(content.rows, 0, 'The shell must not render fabricated financial records.')
  assert.doesNotMatch(content.text, /[₪$€£]\s*[−-]?\d|[−-]?\d[\d,.]*\s*(?:₪|€|\$|\bILS\b|\bUSD\b|\bEUR\b)/u,
    'An unloaded shell must not display fabricated monetary amounts.')
  assert.doesNotMatch(content.text, /\b0\s+(?:accounts?|transactions?|records?|balances?)\b|(?:^|\s)0\s+(?:חשבונות|עסקאות|יתרות)(?=\s|$|[.,:])/iu,
    'Unknown financial data must not be presented as a known zero count.')
  assert.ok(content.width <= content.viewport, 'The phone layout must not overflow horizontally.')
}

async function navigate(page, route, locale = 'en') {
  await page.click(`[data-testid="bottom-nav"] a[href="#/${route}"]`)
  await assertPage(page, route, locale)
}

for (const locale of ['en', 'he']) {
  test(`${locale}: four routes, translated navigation, and browser back work without financial data`, { timeout: 30_000 }, async (t) => {
    const page = await openApp(t, { savedLocale: locale })
    await assertPage(page, 'overview', locale)
    const links = await page.$$eval('[data-testid="bottom-nav"] a', (items) => (
      items.map((item) => ({ href: item.getAttribute('href'), label: item.textContent.trim() }))
    ))
    assert.deepEqual(links, pages.map((route, index) => ({
      href: `#/${route}`,
      label: locales[locale].tabs[index],
    })))

    for (const route of pages.slice(1)) {
      await navigate(page, route, locale)
      assert.equal(await page.$eval(`[data-testid="bottom-nav"] a[href="#/${route}"]`, (item) => item.getAttribute('aria-current')), 'page')
      if (route === 'accounts') await page.waitForSelector('[data-testid="accounts-empty"]')
      if (route === 'transactions') await page.waitForSelector('[data-testid="transactions-empty"]')
    }

    await page.goBack()
    await assertPage(page, 'transactions', locale)
    await page.goBack()
    await assertPage(page, 'accounts', locale)
  })
}

test('Root and unknown routes redirect to Overview', { timeout: 20_000 }, async (t) => {
  const page = await openApp(t, { path: '/' })
  await assertPage(page, 'overview')
  const unknown = new URL('#/not-an-app-route', page.url()).href
  await page.goto(unknown, { waitUntil: 'networkidle0' })
  await assertPage(page, 'overview')
})

test('Transaction search, status filtering, and clearing are local controls over an unloaded state', { timeout: 20_000 }, async (t) => {
  const page = await openApp(t, { path: '/transactions' })
  await assertPage(page, 'transactions')
  await page.waitForSelector('[data-testid="transactions-empty"]')
  await page.type('#transaction-search', 'local-search-check')
  const initialExpanded = await page.$eval('#toggle-filters', (item) => item.getAttribute('aria-expanded'))
  if (initialExpanded !== 'true') await page.click('#toggle-filters')
  await page.waitForSelector('#transaction-status', { visible: true })
  assert.equal(await page.$eval('#toggle-filters', (item) => item.getAttribute('aria-expanded')), 'true')
  const initialStatus = await page.$eval('#transaction-status', (item) => item.value)
  assert.deepEqual(await page.select('#transaction-status', 'pending'), ['pending'])
  assert.equal(await page.$eval('#transaction-search', (item) => item.value), 'local-search-check')
  await page.waitForSelector('[data-testid="transactions-empty"]')
  await assertPage(page, 'transactions')

  await page.click('#clear-filters')
  await page.waitForFunction(() => document.querySelector('#transaction-search')?.value === '')
  if (await page.$eval('#toggle-filters', (item) => item.getAttribute('aria-expanded')) !== 'true') {
    await page.click('#toggle-filters')
  }
  await page.waitForSelector('#transaction-status', { visible: true })
  assert.equal(await page.$eval('#transaction-status', (item) => item.value), initialStatus)
  await page.waitForSelector('[data-testid="transactions-empty"]')
  await assertPage(page, 'transactions')
})

test('Direct transaction details show an explicit empty state and a working return link', { timeout: 20_000 }, async (t) => {
  const page = await openApp(t, { path: '/transactions/details' })
  await assertPage(page, 'transactions/details')
  await page.waitForSelector('[data-testid="transaction-details-empty"]')
  await page.click('main a[href="#/transactions"]')
  await assertPage(page, 'transactions')
  await page.waitForSelector('[data-testid="transactions-empty"]')
})

test('Keyboard skip link focuses main content without changing a hash route', { timeout: 20_000 }, async (t) => {
  const page = await openApp(t, { path: '/settings' })
  await assertPage(page, 'settings')
  await page.keyboard.press('Tab')
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('href')), '#main-content')
  await page.keyboard.press('Enter')
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'main-content')
  await assertPage(page, 'settings')
})

async function assertTheme(page, effective, choice) {
  try {
    await page.waitForFunction(({ effective, choice }) => (
      document.documentElement.dataset.theme === effective
      && document.documentElement.classList.contains('dark') === (effective === 'dark')
      && getComputedStyle(document.documentElement).colorScheme === effective
      && document.querySelector(`[data-theme-choice="${choice}"]`)?.getAttribute('aria-pressed') === 'true'
    ), {}, { effective, choice })
  } catch (error) {
    const actual = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      classes: document.documentElement.className,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      choices: [...document.querySelectorAll('[data-theme-choice]')].map((item) => ({
        choice: item.getAttribute('data-theme-choice'),
        pressed: item.getAttribute('aria-pressed'),
      })),
    }))
    assert.fail(`Expected ${choice} choice and effective ${effective} theme; received ${JSON.stringify(actual)}. ${error.message}`)
  }
}

test('Explicit themes persist; system mode follows live OS changes without automatically saving detection', { timeout: 30_000 }, async (t) => {
  const page = await openApp(t, { path: '/settings', colorScheme: 'light' })
  await assertPage(page, 'settings')
  await assertTheme(page, 'light', 'system')
  assert.equal(await storedSetting(page, themeStorageKey), null)

  await page.click('[data-theme-choice="dark"]')
  await assertTheme(page, 'dark', 'dark')
  assert.equal(await storedSetting(page, themeStorageKey), 'dark')
  await page.reload({ waitUntil: 'networkidle0' })
  await assertTheme(page, 'dark', 'dark')
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
  await assertTheme(page, 'dark', 'dark')
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  await assertTheme(page, 'dark', 'dark')

  await page.click('[data-theme-choice="light"]')
  await assertTheme(page, 'light', 'light')
  assert.equal(await storedSetting(page, themeStorageKey), 'light')
  await page.reload({ waitUntil: 'networkidle0' })
  await assertTheme(page, 'light', 'light')
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
  await assertTheme(page, 'light', 'light')

  await page.click('[data-theme-choice="system"]')
  await assertTheme(page, 'dark', 'system')
  assert.equal(await storedSetting(page, themeStorageKey), 'system')
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  await assertTheme(page, 'light', 'system')
  await page.reload({ waitUntil: 'networkidle0' })
  await assertTheme(page, 'light', 'system')
  assert.equal(await storedSetting(page, themeStorageKey), 'system')
})

test('Theme selection and system-mode updates remain usable when storage is blocked', { timeout: 20_000 }, async (t) => {
  const page = await openApp(t, { path: '/settings', blockedStorage: 'operations', colorScheme: 'light' })
  await assertTheme(page, 'light', 'system')
  await page.click('[data-theme-choice="dark"]')
  await assertTheme(page, 'dark', 'dark')
  await page.click('[data-theme-choice="system"]')
  await assertTheme(page, 'light', 'system')
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
  await assertTheme(page, 'dark', 'system')
})
