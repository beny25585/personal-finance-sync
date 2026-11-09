import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  getDirection,
  getInitialLocale,
  isAppLocale,
  localeStorageKey,
  saveLocale,
} from '../src/i18n/locale.ts'

for (const { name, saved, languages, expected } of [
  { name: 'explicit English overrides a Hebrew device', saved: 'en', languages: ['he-IL'], expected: 'en' },
  { name: 'explicit Hebrew overrides an English device', saved: 'he', languages: ['en-US'], expected: 'he' },
  { name: 'explicit Russian overrides a Hebrew device', saved: 'ru', languages: ['he-IL'], expected: 'ru' },
  { name: 'regional Hebrew is detected', saved: null, languages: ['he-IL'], expected: 'he' },
  { name: 'legacy Hebrew code is detected', saved: null, languages: ['iw-IL'], expected: 'he' },
  { name: 'language codes are case insensitive', saved: null, languages: ['HE-il'], expected: 'he' },
  { name: 'regional English is detected', saved: null, languages: ['en-GB'], expected: 'en' },
  { name: 'regional Russian is detected', saved: null, languages: ['ru-RU'], expected: 'ru' },
  { name: 'the first supported preference wins', saved: null, languages: ['fr-FR', 'he-IL', 'en-US'], expected: 'he' },
  { name: 'unsupported saved values are ignored', saved: 'ar', languages: ['he-IL'], expected: 'he' },
  { name: 'corrupted saved values are ignored', saved: '{not-json', languages: ['en-US'], expected: 'en' },
  { name: 'unsupported device languages fall back to English', saved: null, languages: ['fr-FR'], expected: 'en' },
  { name: 'missing device preferences fall back to English', saved: null, languages: [], expected: 'en' },
]) {
  test(name, () => {
    const storage = { getItem: () => saved }
    assert.equal(getInitialLocale(storage, languages), expected)
  })
}

test('an unavailable or unreadable settings store does not block language detection', () => {
  assert.equal(getInitialLocale(undefined, ['he-IL']), 'he')
  assert.equal(getInitialLocale({ getItem() { throw new Error('Blocked storage') } }, ['he-IL']), 'he')
})

test('only supported canonical locale values are accepted as a selection', () => {
  for (const value of ['en', 'he', 'ru']) assert.equal(isAppLocale(value), true)
  for (const value of ['ar', 'he-IL', 'ru-RU', '', null, undefined, { locale: 'en' }]) {
    assert.equal(isAppLocale(value), false)
  }
})

test('an explicit selection persists without overwriting other settings', () => {
  const values = new Map([['unrelated.setting', 'keep']])
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
  assert.equal(saveLocale(storage, 'ru'), true)
  assert.equal(values.get(localeStorageKey), 'ru')
  assert.equal(values.get('unrelated.setting'), 'keep')
  assert.equal(getInitialLocale(storage, ['en-US']), 'ru')
})

test('unavailable or unwritable storage is reported without throwing', () => {
  assert.equal(saveLocale(undefined, 'he'), false)
  assert.equal(saveLocale({ setItem() { throw new Error('Quota exceeded') } }, 'he'), false)
})

test('Hebrew is right-to-left, and English and Russian are left-to-right', () => {
  assert.equal(getDirection('he'), 'rtl')
  assert.equal(getDirection('en'), 'ltr')
  assert.equal(getDirection('ru'), 'ltr')
})

test('all translation dictionaries contain the same nonempty message keys', () => {
  function keys(value: Record<string, unknown>, prefix = ''): string[] {
    return Object.entries(value).flatMap(([key, item]) => {
      const full = prefix ? `${prefix}.${key}` : key
      if (typeof item === 'object' && item !== null) return keys(item as Record<string, unknown>, full)
      assert.equal(typeof item, 'string', full)
      assert.ok((item as string).trim(), full)
      return [full]
    }).sort()
  }
  const load = (locale: string) => JSON.parse(readFileSync(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8'))
  const englishKeys = keys(load('en'))
  assert.deepEqual(keys(load('he')), englishKeys)
  assert.deepEqual(keys(load('ru')), englishKeys)
})
