import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createBrowserHarness, storedSetting, themeStorageKey } from './browser-helper.mjs'

const { openApp } = createBrowserHarness()
const locales = {
  en: {
    brand: 'Personal Finance Sync',
    state: 'No financial data loaded',
    dir: 'ltr',
    headings: { dashboard: 'Dashboard', providers: 'Connections', transactions: 'Transactions', settings: 'Settings' },
    tabs: ['Dashboard', 'Transactions', 'Spending', 'Categories', 'More'],
    details: 'Transaction details',
  },
  he: {
    brand: 'סנכרון פיננסי אישי',
    state: 'לא נטענו נתונים כספיים',
    dir: 'rtl',
    headings: { dashboard: 'לוח בקרה', providers: 'חיבורים', transactions: 'עסקאות', settings: 'הגדרות' },
    tabs: ['לוח בקרה', 'עסקאות', 'הוצאות', 'קטגוריות', 'עוד'],
    details: 'פרטי עסקה',
  },
}
const pages = ['dashboard', 'transactions', 'providers', 'settings']
const wrappers = {
  dashboard: 'overview-page',
  providers: 'accounts-page',
  transactions: 'transactions-page',
  settings: 'settings-page',
  'transactions/details': 'transaction-details-page',
}

async function assertPage(page, route, locale = 'en') {
  const expected = locales[locale]
  const heading = route === 'transactions/details'
    ? expected.details
    : expected.headings[route]
  const wrapper = wrappers[route]
  await page.waitForSelector(`[data-testid="${wrapper}"]`, { visible: true })
  await page.waitForFunction(({ route: path, locale: lang, direction, heading: title, brand, state, wrapper }) => (
    location.hash === `#/${path}`
    && document.documentElement.lang === lang
    && document.documentElement.dir === direction
    && document.title === brand
    && document.querySelector(`[data-testid="${wrapper}"] [data-testid="page-heading"]`)?.textContent?.trim() === title
    && document.querySelector('[data-testid="financial-data-state"]')?.textContent?.trim() === state
  ), {}, { route, locale, direction: expected.dir, heading, brand: expected.brand, state: expected.state, wrapper })

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
  assert.equal(await page.$('[data-testid="app-brand"]'), null, 'The source mobile shell has no persistent brand header.')
}

async function openMore(page) {
  await page.click('#more-navigation')
  await page.waitForFunction(() => document.querySelector('[data-testid="more-sheet"]')?.open === true)
}

async function assertMoreClosed(page) {
  await page.waitForFunction(() => !document.querySelector('[data-testid="more-sheet"]')?.open)
}

async function navigate(page, route, locale = 'en') {
  if (route === 'providers' || route === 'settings') {
    await openMore(page)
    await page.click(`[data-testid="more-sheet"] a[href="#/${route}"]`)
    await assertMoreClosed(page)
  } else {
    await page.click(`[data-testid="bottom-nav"] a[href="#/${route}"]`)
  }
  await assertPage(page, route, locale)
}

for (const locale of ['en', 'he']) {
  test(`${locale}: four routes, translated navigation, and browser back work without financial data`, { timeout: 30_000 }, async (t) => {
    const page = await openApp(t, { savedLocale: locale })
    await assertPage(page, 'dashboard', locale)
    const controls = await page.$$eval('[data-testid="bottom-nav"] a, [data-testid="bottom-nav"] button', (items) => (
      items.map((item) => ({
        tag: item.tagName,
        href: item.getAttribute('href'),
        label: item.textContent.trim(),
        disabled: item.tagName === 'BUTTON' && item.disabled,
      }))
    ))
    assert.deepEqual(controls, [
      { tag: 'A', href: '#/dashboard', label: locales[locale].tabs[0], disabled: false },
      { tag: 'A', href: '#/transactions', label: locales[locale].tabs[1], disabled: false },
      { tag: 'BUTTON', href: null, label: locales[locale].tabs[2], disabled: true },
      { tag: 'BUTTON', href: null, label: locales[locale].tabs[3], disabled: true },
      { tag: 'BUTTON', href: null, label: locales[locale].tabs[4], disabled: false },
    ])

    for (const route of pages.slice(1)) {
      await navigate(page, route, locale)
      if (route === 'transactions') {
        assert.equal(await page.$eval('[data-testid="bottom-nav"] a[href="#/transactions"]', (item) => item.getAttribute('aria-current')), 'page')
      }
      if (route === 'providers') await page.waitForSelector('[data-testid="accounts-empty"]')
      if (route === 'transactions') await page.waitForSelector('[data-testid="transactions-empty"]')
    }

    await page.goBack()
    await assertPage(page, 'providers', locale)
    await page.goBack()
    await assertPage(page, 'transactions', locale)
  })
}

test('Root, unknown, and legacy routes redirect to their canonical source routes', { timeout: 20_000 }, async (t) => {
  const page = await openApp(t, { path: '/' })
  await assertPage(page, 'dashboard')
  for (const [path, destination] of [['not-an-app-route', 'dashboard'], ['overview', 'dashboard'], ['accounts', 'providers']]) {
    await page.goto(new URL(`#/${path}`, page.url()).href, { waitUntil: 'networkidle0' })
    await assertPage(page, destination)
  }
})

test('Transaction search, status filtering, and clearing are local controls over an unloaded state', { timeout: 20_000 }, async (t) => {
  const page = await openApp(t, { path: '/transactions' })
  await assertPage(page, 'transactions')
  await page.waitForSelector('[data-testid="transactions-empty"]')
  await page.waitForSelector('#clear-filters', { hidden: true })
  const structure = await page.$eval('#transaction-search', (item) => ({
    outerPanel: item.closest('.panel') !== null,
    pageSubtitle: item.closest('[data-testid="transactions-page"]')
      ?.querySelector('[data-testid="page-heading"]')?.parentElement?.querySelector(':scope > p') !== null,
  }))
  assert.equal(structure.outerPanel, false, 'The source transaction toolbar is not wrapped in an invented outer panel.')
  assert.equal(structure.pageSubtitle, false, 'The source transaction page has no added subtitle.')

  await page.type('#transaction-search', 'local-search-check')
  await page.waitForSelector('#clear-filters', { visible: true })
  const initialExpanded = await page.$eval('#toggle-filters', (item) => item.getAttribute('aria-expanded'))
  if (initialExpanded !== 'true') await page.click('#toggle-filters')
  await page.waitForSelector('#transaction-status', { visible: true })
  assert.equal(await page.$eval('#toggle-filters', (item) => item.getAttribute('aria-expanded')), 'true')
  const fieldOrder = await page.$$eval('#transaction-filters input, #transaction-filters select', (items) => items.map((item) => item.id))
  assert.deepEqual(fieldOrder, ['filter-from', 'filter-to', 'filter-provider', 'filter-category', 'transaction-status', 'filter-min', 'filter-max'])
  for (const selector of ['#filter-provider', '#filter-category']) {
    assert.equal(await page.$eval(selector, (item) => item.disabled), true, 'No unconnected provider/category choices should be fabricated.')
  }
  const statuses = await page.$$eval('#transaction-status option', (items) => items.map((item) => item.value))
  assert.deepEqual(statuses, ['all', 'completed', 'pending'])
  for (const [selector, value] of [['#filter-from', '2026-11-01'], ['#filter-to', '2026-11-30'], ['#filter-min', '10'], ['#filter-max', '20']]) {
    await page.$eval(selector, (item, value) => {
      item.value = value
      item.dispatchEvent(new Event('input', { bubbles: true }))
      item.dispatchEvent(new Event('change', { bubbles: true }))
    }, value)
    assert.equal(await page.$eval(selector, (item) => item.value), value)
  }
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
  assert.equal(await page.$eval('#transaction-status', (item) => item.value), 'all')
  for (const selector of ['#filter-from', '#filter-to', '#filter-min', '#filter-max']) {
    assert.equal(await page.$eval(selector, (item) => item.value), '')
  }
  await page.waitForSelector('#clear-filters', { hidden: true })
  await page.waitForSelector('[data-testid="transactions-empty"]')
  await assertPage(page, 'transactions')
})

test('Direct transaction details use a native right-side dialog; close and Escape return to transactions', { timeout: 20_000 }, async (t) => {
  const page = await openApp(t, { path: '/transactions/details' })
  await assertPage(page, 'transactions/details')
  await page.waitForSelector('[data-testid="transaction-details-empty"]')
  const selector = '[data-testid="transaction-details-page"] dialog'
  await page.waitForFunction((selector) => document.querySelector(selector)?.open === true, {}, selector)
  const position = await page.$eval(selector, (item) => ({ right: item.getBoundingClientRect().right, viewport: innerWidth }))
  assert.ok(Math.abs(position.viewport - position.right) <= 1, 'Details should preserve the source right-side sheet position.')
  await page.click('[data-testid="transaction-details-close"]')
  await assertPage(page, 'transactions')
  await page.waitForSelector('[data-testid="transactions-empty"]')

  await page.goto(new URL('#/transactions/details', page.url()).href, { waitUntil: 'networkidle0' })
  await assertPage(page, 'transactions/details')
  await page.waitForFunction((selector) => document.querySelector(selector)?.open === true, {}, selector)
  await page.keyboard.press('Escape')
  await assertPage(page, 'transactions')
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

test('Dashboard preserves the standalone unloaded source layout at 320px and 390px', { timeout: 25_000 }, async (t) => {
  for (const locale of ['en', 'he']) {
    const page = await openApp(t, { savedLocale: locale })
    for (const width of [320, 390]) {
      await page.setViewport({ width, height: 844, deviceScaleFactor: 1 })
      await assertPage(page, 'dashboard', locale)
      await page.waitForSelector('[data-testid="dashboard-empty"]')
      const metrics = await page.$$eval('[data-testid="overview-page"] .metric-card, [data-testid="overview-page"] .summary-card, [data-testid="overview-page"] .summary-grid, [data-testid="overview-page"] [data-testid="summary-metric"]', (items) => items.length)
      assert.equal(metrics, 0, 'No financial summary metric cards should be invented for the unloaded dashboard.')
    }
  }
})

async function scrollState(page) {
  return page.evaluate(() => ({
    body: getComputedStyle(document.body).overflowY,
    root: getComputedStyle(document.documentElement).overflowY,
  }))
}

async function assertMoreRestored(page, previousScroll) {
  await assertMoreClosed(page)
  await page.waitForFunction(() => document.activeElement?.id === 'more-navigation')
  assert.deepEqual(await scrollState(page), previousScroll, 'Closing More must restore the previous scroll behavior.')
}

test('More is a native modal with source links, contained focus, scroll lock, Escape and backdrop dismissal', { timeout: 25_000 }, async (t) => {
  const page = await openApp(t)
  await assertPage(page, 'dashboard')
  const previousScroll = await scrollState(page)
  await openMore(page)
  assert.equal(await page.$eval('[data-testid="more-sheet"]', (item) => item.tagName), 'DIALOG')
  assert.equal(await page.evaluate(() => document.querySelector('[data-testid="more-sheet"]')?.contains(document.activeElement)), true)
  const locked = await scrollState(page)
  assert.ok(['hidden', 'clip'].includes(locked.body) || ['hidden', 'clip'].includes(locked.root), 'More must lock background scrolling.')
  const links = await page.$$eval('[data-testid="more-sheet"] a', (items) => items.map((item) => ({
    href: item.getAttribute('href'),
    label: item.textContent.trim(),
  })))
  assert.deepEqual(links, [
    { href: '#/dashboard', label: 'Dashboard' },
    { href: '#/transactions', label: 'Transactions' },
    { href: '#/providers', label: 'Connections' },
    { href: '#/settings', label: 'Settings' },
  ])

  await page.keyboard.press('Escape')
  await assertMoreRestored(page, previousScroll)
  await assertPage(page, 'dashboard')

  await openMore(page)
  const outside = await page.$eval('[data-testid="more-sheet"]', (item) => {
    const box = item.getBoundingClientRect()
    return [
      { x: 1, y: 1 },
      { x: innerWidth - 1, y: 1 },
      { x: 1, y: innerHeight - 1 },
      { x: innerWidth - 1, y: innerHeight - 1 },
    ].find(({ x, y }) => x < box.left || x > box.right || y < box.top || y > box.bottom)
  })
  assert.ok(outside, 'The modal must expose its backdrop for dismissal.')
  await page.mouse.click(outside.x, outside.y)
  await assertMoreRestored(page, previousScroll)
  await assertPage(page, 'dashboard')
})

async function assertTheme(page, effective, choice, attribute = 'data-theme-choice') {
  try {
    await page.waitForFunction(({ effective, choice, attribute }) => (
      document.documentElement.dataset.theme === effective
      && document.documentElement.classList.contains('dark') === (effective === 'dark')
      && getComputedStyle(document.documentElement).colorScheme === effective
      && document.querySelector(`[${attribute}="${choice}"]`)?.getAttribute('aria-pressed') === 'true'
    ), {}, { effective, choice, attribute })
  } catch (error) {
    const actual = await page.evaluate((attribute) => ({
      theme: document.documentElement.dataset.theme,
      classes: document.documentElement.className,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      choices: [...document.querySelectorAll(`[${attribute}]`)].map((item) => ({
        choice: item.getAttribute(attribute),
        pressed: item.getAttribute('aria-pressed'),
      })),
    }), attribute)
    assert.fail(`Expected ${choice} choice and effective ${effective} theme; received ${JSON.stringify(actual)}. ${error.message}`)
  }
}

test('More and Settings share persisted appearance preferences and live system theme', { timeout: 25_000 }, async (t) => {
  const page = await openApp(t, { colorScheme: 'light' })
  await openMore(page)
  await assertTheme(page, 'light', 'system', 'data-more-theme-choice')
  assert.equal(await storedSetting(page, themeStorageKey), null)
  await page.click('[data-more-theme-choice="dark"]')
  await assertTheme(page, 'dark', 'dark', 'data-more-theme-choice')
  assert.equal(await storedSetting(page, themeStorageKey), 'dark')

  await page.click('[data-testid="more-sheet"] a[href="#/settings"]')
  await assertMoreClosed(page)
  await assertPage(page, 'settings')
  await assertTheme(page, 'dark', 'dark')
  await page.click('[data-theme-choice="light"]')
  await assertTheme(page, 'light', 'light')
  await openMore(page)
  await assertTheme(page, 'light', 'light', 'data-more-theme-choice')
  await page.click('[data-more-theme-choice="system"]')
  await assertTheme(page, 'light', 'system', 'data-more-theme-choice')
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
  await assertTheme(page, 'dark', 'system', 'data-more-theme-choice')
  assert.equal(await storedSetting(page, themeStorageKey), 'system')
  await page.keyboard.press('Escape')
  await assertMoreClosed(page)
  await assertTheme(page, 'dark', 'system')
})

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
