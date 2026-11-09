<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import MobileNav from './components/MobileNav.vue'
import { isHostedFinanceApp } from './api/host'

const { t } = useI18n({ useScope: 'global' })
const mainContent = ref<HTMLElement | null>(null)
const route = useRoute()
const hasFinancialDataView = computed(() =>
  (route.path === '/providers' && (import.meta.env.DEV || isHostedFinanceApp))
  || (isHostedFinanceApp && (
    route.path === '/dashboard'
    || route.path === '/transactions'
    || route.name === 'transaction-details'
  )),
)
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content" @click.prevent="mainContent?.focus()">{{ t('nav.skipToContent') }}</a>
    <!-- Original mobile app-shell: content first, without the desktop brand bar. -->
    <main id="main-content" ref="mainContent" class="app-content" tabindex="-1">
      <RouterView />
      <div v-if="!hasFinancialDataView" class="data-state" data-testid="financial-data-state">
        <span>{{ t('data.unloaded') }}</span>
      </div>
    </main>
    <MobileNav />
  </div>
</template>
