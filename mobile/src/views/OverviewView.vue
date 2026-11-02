<script setup lang="ts">
import { ArrowDownLeft, ArrowUpRight, Building2, ChevronRight, ReceiptText, Wallet } from '@lucide/vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import EmptyState from '../components/EmptyState.vue'

const { t } = useI18n({ useScope: 'global' })
const metrics = [
  { label: 'overview.balance', icon: Wallet },
  { label: 'overview.income', icon: ArrowDownLeft },
  { label: 'overview.expenses', icon: ArrowUpRight },
]
</script>

<template>
  <section class="view-stack" data-testid="overview-page">
    <header class="page-heading">
      <h1 data-testid="page-heading">{{ t('overview.title') }}</h1>
      <p>{{ t('overview.subtitle') }}</p>
    </header>

    <section class="summary-grid" :aria-label="t('overview.summary')">
      <article v-for="metric in metrics" :key="metric.label" class="panel summary-card">
        <div class="summary-label">
          <span>{{ t(metric.label) }}</span>
          <component :is="metric.icon" :size="18" aria-hidden="true" />
        </div>
        <p class="summary-value" :aria-label="t('data.unloaded')">—</p>
      </article>
    </section>

    <section class="panel" aria-labelledby="overview-accounts-title">
      <header class="panel-header panel-header-row">
        <h2 id="overview-accounts-title">{{ t('overview.accounts') }}</h2>
        <RouterLink class="text-link" to="/accounts">
          {{ t('overview.viewAccounts') }}
          <ChevronRight class="forward-icon" :size="16" aria-hidden="true" />
        </RouterLink>
      </header>
      <div class="panel-body">
        <EmptyState
          :icon="Building2"
          :title="t('accounts.emptyTitle')"
          :description="t('accounts.emptyDescription')"
        />
      </div>
    </section>

    <section class="panel" aria-labelledby="overview-transactions-title">
      <header class="panel-header panel-header-row">
        <h2 id="overview-transactions-title">{{ t('overview.activity') }}</h2>
        <RouterLink class="text-link" to="/transactions">
          {{ t('overview.viewTransactions') }}
          <ChevronRight class="forward-icon" :size="16" aria-hidden="true" />
        </RouterLink>
      </header>
      <div class="panel-body">
        <EmptyState
          :icon="ReceiptText"
          :title="t('transactions.emptyTitle')"
          :description="t('transactions.emptyDescription')"
        />
      </div>
    </section>
  </section>
</template>
