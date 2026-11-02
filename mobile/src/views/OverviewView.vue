<script setup lang="ts">
import { LayoutDashboard } from '@lucide/vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import EmptyState from '../components/EmptyState.vue'

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <!-- Port of dashboard-page.tsx's standalone empty layout, without a data fetch. -->
  <section class="view-stack" data-testid="overview-page">
    <header class="page-heading">
      <h1 data-testid="page-heading">{{ t('overview.title') }}</h1>
    </header>
    <EmptyState
      data-testid="dashboard-empty"
      :icon="LayoutDashboard"
      :title="t('overview.emptyTitle')"
      :description="t('overview.emptyDescription')"
    >
      <RouterLink class="button button-primary" to="/providers">
        {{ t('overview.viewConnections') }}
      </RouterLink>
    </EmptyState>
  </section>
</template>
