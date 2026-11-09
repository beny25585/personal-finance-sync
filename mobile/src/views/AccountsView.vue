<script setup lang="ts">
import { Unplug } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { isHostedFinanceApp } from '../api/host'
import EmptyState from '../components/EmptyState.vue'
import ConnectionsPanel from '../components/connections/ConnectionsPanel.vue'
import MoneytorPanel from '../components/moneytor/MoneytorPanel.vue'

const { t } = useI18n({ useScope: 'global' })
const hasConnectionApi = import.meta.env.DEV || isHostedFinanceApp
</script>

<template>
  <section class="view-stack" data-testid="accounts-page">
    <header class="page-heading">
      <h1 data-testid="page-heading">{{ t('accounts.title') }}</h1>
      <p>{{ t('accounts.subtitle') }}</p>
    </header>

    <MoneytorPanel v-if="isHostedFinanceApp" />
    <ConnectionsPanel v-if="hasConnectionApi" :can-manage="isHostedFinanceApp" />
    <EmptyState
      v-else
      data-testid="accounts-empty"
      :icon="Unplug"
      :title="t('accounts.emptyTitle')"
      :description="t('accounts.emptyDescription')"
    />
  </section>
</template>
