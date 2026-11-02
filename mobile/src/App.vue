<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { setAppLocale } from './i18n'
import { isAppLocale } from './i18n/locale'

const { t, locale } = useI18n({ useScope: 'global' })

function changeLanguage(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (isAppLocale(value)) setAppLocale(value)
}
</script>

<template>
  <main>
    <h1>{{ t('app.title') }}</h1>
    <p>{{ t('app.ready') }}</p>
    <div class="language-picker">
      <label for="app-language">{{ t('language.label') }}</label>
      <select id="app-language" :value="locale" @change="changeLanguage">
        <option value="he" lang="he" dir="rtl">{{ t('language.hebrew') }}</option>
        <option value="en" lang="en" dir="ltr">{{ t('language.english') }}</option>
      </select>
    </div>
  </main>
</template>

<style>
:root {
  font-family: system-ui, sans-serif;
  color: #18181b;
  background: #fafafa;
  text-align: start;
}

body {
  margin: 0;
}

main {
  box-sizing: border-box;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right))
    max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left));
}

h1 {
  margin: 0;
  font-size: 24px;
  color: #4f46e5;
}

p {
  margin-block: 12px 0;
  margin-inline: 0;
  color: #52525b;
}

.language-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-inline-size: 288px;
  margin-block-start: 24px;
}

select {
  min-block-size: 48px;
  padding-block: 10px;
  padding-inline: 12px;
  border: 1px solid #d4d4d8;
  border-radius: 10px;
  font: inherit;
  color: inherit;
  background: #ffffff;
  text-align: start;
}

select:focus-visible {
  outline: 2px solid #4f46e5;
  outline-offset: 3px;
}
</style>
