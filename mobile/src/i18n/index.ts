import { watchEffect } from 'vue'
import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import he from './locales/he.json'
import ru from './locales/ru.json'
import {
  getDirection,
  getInitialLocale,
  saveLocale,
  type AppLocale,
  type LocaleStorage,
} from './locale'

const messages = { en, he, ru } satisfies Record<AppLocale, typeof en>

function getStorage(): LocaleStorage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

const languages = typeof navigator === 'undefined'
  ? []
  : navigator.languages.length ? navigator.languages : [navigator.language]

export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(getStorage(), languages),
  fallbackLocale: 'en',
  messages,
})

watchEffect(() => {
  if (typeof document === 'undefined') return
  const locale = i18n.global.locale.value
  document.documentElement.lang = locale
  document.documentElement.dir = getDirection(locale)
  document.title = i18n.global.t('app.title')
})

export function setAppLocale(locale: AppLocale): void {
  i18n.global.locale.value = locale
  // Persist only an explicit selection, not automatic device-language detection.
  saveLocale(getStorage(), locale)
}
