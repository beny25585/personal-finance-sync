<script setup lang="ts">
// Vue port of src/web/app/components/layout/mobile-nav.tsx.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowLeftRight, Building2, LayoutDashboard, Menu, Monitor, Moon, PieChart, Settings2, Sun, Tags, X } from '@lucide/vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { setThemePreference, themePreference } from '../theme'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const sheet = ref<HTMLDialogElement | null>(null)
const moreButton = ref<HTMLButtonElement | null>(null)
const moreOpen = ref(false)
let previousOverflow: string | undefined

const tabs = [
  { path: '/dashboard', label: 'nav.overview', icon: LayoutDashboard },
  { path: '/transactions', label: 'nav.transactions', icon: ArrowLeftRight },
]
const unavailableTabs = [
  { label: 'nav.spending', icon: PieChart },
  { label: 'nav.categories', icon: Tags },
]
const moreItems = [
  ...tabs,
  { path: '/providers', label: 'nav.connections', icon: Building2 },
  { path: '/settings', label: 'nav.settings', icon: Settings2 },
]
const themes = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
] as const

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`)
}
const isMoreActive = computed(() => !tabs.some((tab) => isActive(tab.path)))

function finishClose(): void {
  moreOpen.value = false
  if (previousOverflow !== undefined) {
    document.body.style.overflow = previousOverflow
    previousOverflow = undefined
  }
}

function openMore(): void {
  if (!sheet.value || sheet.value.open) return
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  sheet.value.showModal()
  moreOpen.value = true
}

function closeMore(): void {
  if (!sheet.value?.open && !moreOpen.value) return
  sheet.value?.close()
  finishClose()
  moreButton.value?.focus({ preventScroll: true })
}

function onNativeClose(): void {
  if (!sheet.value?.open) finishClose()
}

function onBackdropClick(event: MouseEvent): void {
  if (event.target !== sheet.value || !sheet.value) return
  const rect = sheet.value.getBoundingClientRect()
  // Dialog padding is inside the sheet; only the actual backdrop dismisses it.
  if (event.clientX < rect.left || event.clientX > rect.right
    || event.clientY < rect.top || event.clientY > rect.bottom) closeMore()
}

watch(() => route.fullPath, () => closeMore())
onBeforeUnmount(() => {
  sheet.value?.close()
  finishClose()
})
</script>

<template>
  <nav class="bottom-nav" :aria-label="t('nav.main')" data-testid="bottom-nav">
    <div class="bottom-nav-inner">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="nav-item"
        :class="{ 'is-active': isActive(tab.path) }"
        :aria-current="isActive(tab.path) ? 'page' : undefined"
      >
        <component :is="tab.icon" :size="20" aria-hidden="true" />
        <span>{{ t(tab.label) }}</span>
      </RouterLink>
      <button
        v-for="tab in unavailableTabs"
        :key="tab.label"
        class="nav-item"
        type="button"
        disabled
        aria-describedby="nav-unavailable"
      >
        <component :is="tab.icon" :size="20" aria-hidden="true" />
        <span>{{ t(tab.label) }}</span>
      </button>
      <button
        id="more-navigation"
        ref="moreButton"
        class="nav-item"
        :class="{ 'is-active': isMoreActive }"
        type="button"
        aria-haspopup="dialog"
        aria-controls="more-sheet"
        :aria-expanded="moreOpen"
        :aria-label="t('nav.moreLabel')"
        @click="openMore"
      >
        <Menu :size="20" aria-hidden="true" />
        <span>{{ t('nav.more') }}</span>
      </button>
    </div>
  </nav>

  <dialog
    id="more-sheet"
    ref="sheet"
    class="more-sheet"
    data-testid="more-sheet"
    aria-labelledby="more-sheet-title"
    aria-describedby="more-sheet-description"
    @cancel.prevent="closeMore"
    @close="onNativeClose"
    @click="onBackdropClick"
  >
    <header class="more-sheet-header">
      <h2 id="more-sheet-title" class="more-sheet-title">{{ t('nav.navigation') }}</h2>
      <p id="more-sheet-description" class="more-sheet-description">{{ t('nav.description') }}</p>
      <button class="sheet-close" type="button" :aria-label="t('nav.close')" autofocus @click="closeMore">
        <X :size="16" aria-hidden="true" />
      </button>
    </header>
    <div class="more-sheet-body">
      <nav class="more-nav" :aria-label="t('nav.navigation')">
        <RouterLink
          v-for="item in moreItems"
          :key="item.path"
          :to="item.path"
          class="more-nav-link"
          :class="{ 'is-active': isActive(item.path) }"
          :aria-current="isActive(item.path) ? 'page' : undefined"
          @click="closeMore"
        >
          <component :is="item.icon" :size="16" aria-hidden="true" />
          <span>{{ t(item.label) }}</span>
        </RouterLink>
      </nav>
      <section class="more-theme" aria-labelledby="more-theme-title">
        <h3 id="more-theme-title">{{ t('nav.theme') }}</h3>
        <div class="more-theme-options" role="group" aria-labelledby="more-theme-title">
          <button
            v-for="theme in themes"
            :key="theme.value"
            class="more-theme-choice"
            :data-more-theme-choice="theme.value"
            :aria-pressed="themePreference === theme.value"
            type="button"
            @click="setThemePreference(theme.value)"
          >
            <component :is="theme.icon" :size="16" aria-hidden="true" />
            <span>{{ t(`theme.${theme.value}`) }}</span>
          </button>
        </div>
      </section>
      <p id="nav-unavailable" class="more-unavailable">{{ t('nav.unavailable') }}</p>
    </div>
  </dialog>
</template>
