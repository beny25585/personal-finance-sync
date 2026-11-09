export type AppLocale = 'en' | 'he' | 'ru'

export interface LocaleStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const localeStorageKey = 'personal-finance-sync.locale'

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'en' || value === 'he' || value === 'ru'
}

export function getInitialLocale(
  storage: Pick<LocaleStorage, 'getItem'> | undefined,
  languages: readonly string[],
): AppLocale {
  try {
    const saved = storage?.getItem(localeStorageKey)
    if (isAppLocale(saved)) return saved
  } catch {
    // A blocked settings store must not prevent the app from opening.
  }

  for (const language of languages) {
    const code = language.toLowerCase().split('-')[0]
    if (code === 'iw') return 'he'
    if (isAppLocale(code)) return code
  }
  return 'en'
}

export function saveLocale(
  storage: Pick<LocaleStorage, 'setItem'> | undefined,
  locale: AppLocale,
): boolean {
  if (!storage) return false
  try {
    storage.setItem(localeStorageKey, locale)
    return true
  } catch {
    // Switching still works for this session when persistence is unavailable.
    return false
  }
}

export function getDirection(locale: AppLocale): 'rtl' | 'ltr' {
  return locale === 'he' ? 'rtl' : 'ltr'
}
