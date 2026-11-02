<script setup lang="ts">
import { ArrowLeftRight, Building2, LayoutDashboard, Settings2, WalletCards } from '@lucide/vue'
import { ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const mainContent = ref<HTMLElement | null>(null)
const navigation = [
  { path: '/overview', label: 'nav.overview', icon: LayoutDashboard },
  { path: '/accounts', label: 'nav.accounts', icon: Building2 },
  { path: '/transactions', label: 'nav.transactions', icon: ArrowLeftRight },
  { path: '/settings', label: 'nav.settings', icon: Settings2 },
]

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`)
}
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content" @click.prevent="mainContent?.focus()">{{ t('nav.skipToContent') }}</a>
    <header class="app-header">
      <div class="app-header-inner">
        <RouterLink class="brand" to="/overview" data-testid="app-brand">
          <span class="brand-icon" aria-hidden="true"><WalletCards :size="21" /></span>
          <span>{{ t('app.title') }}</span>
        </RouterLink>
      </div>
    </header>

    <main id="main-content" ref="mainContent" class="app-content" tabindex="-1">
      <div class="data-state" data-testid="financial-data-state">
        <span class="data-state-dot" aria-hidden="true" />
        <span>{{ t('data.unloaded') }}</span>
      </div>
      <RouterView />
    </main>

    <nav class="bottom-nav" :aria-label="t('nav.main')" data-testid="bottom-nav">
      <div class="bottom-nav-inner">
        <RouterLink
          v-for="item in navigation"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ 'is-active': isActive(item.path) }"
          :aria-current="isActive(item.path) ? 'page' : undefined"
        >
          <span class="nav-icon"><component :is="item.icon" :size="21" aria-hidden="true" /></span>
          <span>{{ t(item.label) }}</span>
        </RouterLink>
      </div>
    </nav>
  </div>
</template>
