import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createBrowserHarness, localeStorageKey, storedSetting } from './browser-helper.mjs'

const { openApp } = createBrowserHarness()
const messages = {
  en: {
    brand: 'Personal Finance Sync',
    heading: 'Settings',
    label: 'Language',
    state: 'No financial data loaded',
    lang: 'en',
    dir: 'ltr',
  },
  he: {
    brand: 'סנכרון פיננסי אישי',
    heading: 'הגדרות',
    label: 'שפת ממשק',
    state: 'לא נטענו נתונים כספיים',
    lang: 'he',
    dir: 'rtl',
  },
}

async function assertLocale(page, locale) {
  const expected = messages[locale]
  try {
    await page.waitForFunction((value) => (
      document.documentElement.lang === value.lang
      && document.documentElement.dir === value.dir
      && document.title === value.brand
      && document.querySelector('[data-testid="app-brand"]')?.textContent?.trim() === value.brand
      && document.querySelector('[data-testid="page-heading"]')?.textContent?.trim() === value.heading
      && document.querySelector('[data-testid="financial-data-state"]')?.textContent?.trim() === value.state
      && document.querySelector('label[for="app-language"]')?.textContent?.trim() === value.label
      && document.querySelector('#app-language')?.value === value.lang
    ), {}, expected)
  } catch (error) {
    const actual = await page.evaluate(() => ({
      brand: document.querySelector('[data-testid="app-brand"]')?.textContent?.trim(),
      heading: document.querySelector('[data-testid="page-heading"]')?.textContent?.trim(),
      label: document.querySelector('label[for="app-language"]')?.textContent?.trim(),
      title: document.title,
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      selection: document.querySelector('#app-language')?.value,
    }))
    assert.fail(`Expected ${locale} Settings text and document metadata; received ${JSON.stringify(actual)}. ${error.message}`)
  }
}

async function storedLocale(page) {
  return storedSetting(page, localeStorageKey)
}

test('Hebrew system language is not saved; explicit choices persist across Settings reloads and restore direction', { timeout: 30_000 }, async (t) => {
  const page = await openApp(t, { path: '/settings', languages: ['he-IL', 'en-US'] })
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

test('Unsupported system language and an invalid saved preference fall back to English Settings', { timeout: 20_000 }, async (t) => {
  const page = await openApp(t, { path: '/settings', languages: ['fr-FR'], savedLocale: '{invalid-locale' })
  await assertLocale(page, 'en')

  await page.select('#app-language', 'he')
  await assertLocale(page, 'he')
  assert.equal(await storedLocale(page), 'he')
  await page.reload({ waitUntil: 'networkidle0' })
  await assertLocale(page, 'he')
})

for (const blockedStorage of ['getter', 'operations']) {
  test(`Language selection remains usable when localStorage ${blockedStorage} are blocked`, { timeout: 20_000 }, async (t) => {
    const page = await openApp(t, { path: '/settings', languages: ['he-IL'], blockedStorage })
    await assertLocale(page, 'he')

    await page.select('#app-language', 'en')
    await assertLocale(page, 'en')
    await page.select('#app-language', 'he')
    await assertLocale(page, 'he')

    await page.reload({ waitUntil: 'networkidle0' })
    await assertLocale(page, 'he')
  })
}
