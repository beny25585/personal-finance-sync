<script setup lang="ts">
import { LayoutDashboard } from '@lucide/vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import EmptyState from '../components/EmptyState.vue'
import CashFlowDashboard from '../components/cash-flow/CashFlowDashboard.vue'
import { isHostedFinanceApp } from '../api/host'

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <section class="view-stack" data-testid="overview-page">
    <header class="page-heading">
      <h1 data-testid="page-heading">{{ t('overview.title') }}</h1>
    </header>
    <CashFlowDashboard v-if="isHostedFinanceApp" />
    <EmptyState
      v-else
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
