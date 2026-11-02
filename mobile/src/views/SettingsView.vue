<script setup lang="ts">
import { Monitor, Moon, Sun } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import LanguagePicker from '../components/LanguagePicker.vue'
import { isThemePreference, setThemePreference, themePreference } from '../theme'

const { t } = useI18n({ useScope: 'global' })
const themes = [
  { value: 'system', icon: Monitor },
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
] as const

function changeTheme(value: string): void {
  if (isThemePreference(value)) {
    setThemePreference(value)
  }
}
</script>

<template>
  <section class="view-stack" data-testid="settings-page">
    <header class="page-heading">
      <h1 data-testid="page-heading">{{ t('settings.title') }}</h1>
      <p>{{ t('settings.subtitle') }}</p>
    </header>

    <section class="panel settings-section" aria-labelledby="settings-language-title">
      <header class="panel-header">
        <h2 id="settings-language-title">{{ t('settings.languageTitle') }}</h2>
        <p class="muted">{{ t('settings.languageDescription') }}</p>
      </header>
      <div class="panel-body">
        <LanguagePicker />
      </div>
    </section>

    <section class="panel settings-section" aria-labelledby="settings-appearance-title">
      <header class="panel-header">
        <h2 id="settings-appearance-title">{{ t('settings.appearanceTitle') }}</h2>
        <p class="muted">{{ t('settings.appearanceDescription') }}</p>
      </header>
      <div class="panel-body">
        <div class="appearance-grid" role="group" aria-labelledby="settings-appearance-title">
          <button
            v-for="theme in themes"
            :key="theme.value"
            class="theme-choice"
            :data-theme-choice="theme.value"
            :aria-pressed="themePreference === theme.value"
            type="button"
            @click="changeTheme(theme.value)"
          >
            <component :is="theme.icon" :size="22" aria-hidden="true" />
            <span>{{ t(`theme.${theme.value}`) }}</span>
          </button>
        </div>
      </div>
    </section>

    <section class="panel settings-section" aria-labelledby="settings-about-title">
      <header class="panel-header">
        <h2 id="settings-about-title">{{ t('settings.aboutTitle') }}</h2>
      </header>
      <div class="panel-body">
        <p class="muted">{{ t('settings.aboutDescription') }}</p>
      </div>
    </section>
  </section>
</template>
