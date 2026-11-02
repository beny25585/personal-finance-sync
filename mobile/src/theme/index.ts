import { computed, ref, watchEffect } from 'vue'
import {
  getInitialThemePreference,
  isThemePreference,
  resolveThemePreference,
  saveThemePreference,
  type ThemePreference,
  type ThemeStorage,
} from './preferences'

export { isThemePreference } from './preferences'
export type { EffectiveTheme, ThemePreference } from './preferences'

function getStorage(): ThemeStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

const systemPrefersDark = ref(false)

function observeSystemTheme(): () => void {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    systemPrefersDark.value = media.matches
    const onChange = (event: MediaQueryListEvent) => {
      systemPrefersDark.value = event.matches
    }

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    }
    // Older WebViews can expose only the legacy MediaQueryList listener API.
    if (typeof media.addListener === 'function') {
      media.addListener(onChange)
      return () => media.removeListener(onChange)
    }
  } catch {
    // Explicit light/dark choices remain usable without a working media API.
  }
  return () => {}
}

const stopObservingSystem = observeSystemTheme()

export const themePreference = ref<ThemePreference>(getInitialThemePreference(getStorage()))
export const effectiveTheme = computed(() =>
  resolveThemePreference(themePreference.value, systemPrefersDark.value),
)

const stopApplyingTheme = watchEffect(() => {
  const theme = effectiveTheme.value
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  root.dataset.theme = theme
}, { flush: 'sync' })

export function setThemePreference(value: ThemePreference): void {
  if (!isThemePreference(value)) return
  themePreference.value = value
  // Device-theme changes and initial detection never write a preference.
  saveThemePreference(getStorage(), value)
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopApplyingTheme()
    stopObservingSystem()
  })
}
