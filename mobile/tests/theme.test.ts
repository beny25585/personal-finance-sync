import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getInitialThemePreference,
  isThemePreference,
  resolveThemePreference,
  saveThemePreference,
  themeStorageKey,
  type ThemePreference,
} from '../src/theme/preferences.ts'

test('only canonical supported theme preferences are valid', () => {
  for (const value of ['system', 'light', 'dark']) assert.equal(isThemePreference(value), true)
  for (const value of ['auto', 'DARK', 'dark ', '', null, undefined, true, { theme: 'dark' }]) {
    assert.equal(isThemePreference(value), false)
  }
})

for (const preference of ['system', 'light', 'dark'] as const) {
  test(`a stored ${preference} selection is restored`, () => {
    const keys: string[] = []
    const storage = { getItem(key: string) { keys.push(key); return preference } }
    assert.equal(getInitialThemePreference(storage), preference)
    assert.deepEqual(keys, [themeStorageKey])
  })
}

test('missing, unsupported, and corrupted saved values default to system', () => {
  for (const saved of [null, '', 'auto', 'DARK', '{invalid-json', 'null', 'undefined']) {
    assert.equal(getInitialThemePreference({ getItem: () => saved }), 'system')
  }
})

test('unavailable or blocked settings storage defaults to system without throwing', () => {
  assert.equal(getInitialThemePreference(undefined), 'system')
  assert.equal(getInitialThemePreference({ getItem() { throw new Error('Blocked storage') } }), 'system')
})

test('restoring a preference never persists an automatically detected choice', () => {
  let writes = 0
  const storage = {
    getItem: () => null,
    setItem() { writes++ },
  }
  const preference = getInitialThemePreference(storage)
  assert.equal(resolveThemePreference(preference, true), 'dark')
  assert.equal(resolveThemePreference(preference, false), 'light')
  assert.equal(writes, 0)
})

test('system mode resolves the current device preference on every evaluation', () => {
  assert.equal(resolveThemePreference('system', false), 'light')
  assert.equal(resolveThemePreference('system', true), 'dark')
  assert.equal(resolveThemePreference('system', false), 'light')
})

test('explicit light and dark selections override either device preference', () => {
  for (const systemPrefersDark of [false, true]) {
    assert.equal(resolveThemePreference('light', systemPrefersDark), 'light')
    assert.equal(resolveThemePreference('dark', systemPrefersDark), 'dark')
  }
})

test('explicit choices persist only the theme key and preserve language and unrelated settings', () => {
  const values = new Map([
    ['personal-finance-sync.locale', 'he'],
    ['unrelated.setting', 'keep'],
  ])
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
  for (const preference of ['dark', 'light', 'system'] as const) {
    assert.equal(saveThemePreference(storage, preference), true)
    assert.equal(values.get(themeStorageKey), preference)
    assert.equal(getInitialThemePreference(storage), preference)
  }
  assert.deepEqual([...values.keys()].sort(), [
    'personal-finance-sync.locale', 'personal-finance-sync.theme', 'unrelated.setting',
  ])
  assert.equal(values.get('personal-finance-sync.locale'), 'he')
  assert.equal(values.get('unrelated.setting'), 'keep')
})

test('unavailable or unwritable storage is reported without throwing', () => {
  assert.equal(saveThemePreference(undefined, 'dark'), false)
  assert.equal(saveThemePreference({ setItem() { throw new Error('Quota exceeded') } }, 'dark'), false)
})

test('an unsupported runtime value is never written to settings', () => {
  let writes = 0
  const storage = { setItem() { writes++ } }
  assert.equal(saveThemePreference(storage, 'sepia' as ThemePreference), false)
  assert.equal(writes, 0)
})
