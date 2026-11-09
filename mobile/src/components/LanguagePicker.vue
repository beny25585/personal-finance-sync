<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { setAppLocale } from '../i18n'
import { isAppLocale } from '../i18n/locale'

const { t, locale } = useI18n({ useScope: 'global' })

function changeLanguage(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (isAppLocale(value)) setAppLocale(value)
}
</script>

<template>
  <div class="field language-picker">
    <label class="field-label" for="app-language">{{ t('language.label') }}</label>
    <select id="app-language" :value="locale" @change="changeLanguage">
      <option value="he" lang="he" dir="rtl">{{ t('language.hebrew') }}</option>
      <option value="en" lang="en" dir="ltr">{{ t('language.english') }}</option>
      <option value="ru" lang="ru" dir="ltr">{{ t('language.russian') }}</option>
    </select>
  </div>
</template>
