import type { LocaleStorage } from '../i18n/locale'

export type ThemePreference = 'system' | 'light' | 'dark'
export type EffectiveTheme = 'light' | 'dark'
export type ThemeStorage = LocaleStorage

export const themeStorageKey = 'personal-finance-sync.theme'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function getInitialThemePreference(
  storage: Pick<ThemeStorage, 'getItem'> | undefined,
): ThemePreference {
  try {
    const saved = storage?.getItem(themeStorageKey)
    if (isThemePreference(saved)) return saved
  } catch {
    // A blocked settings store must not prevent the app from opening.
  }
  return 'system'
}

export function saveThemePreference(
  storage: Pick<ThemeStorage, 'setItem'> | undefined,
  preference: ThemePreference,
): boolean {
  if (!storage || !isThemePreference(preference)) return false
  try {
    storage.setItem(themeStorageKey, preference)
    return true
  } catch {
    // An explicit selection still applies for this session if saving fails.
    return false
  }
}

export function resolveThemePreference(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): EffectiveTheme {
  return preference === 'system' ? systemPrefersDark ? 'dark' : 'light' : preference
}
