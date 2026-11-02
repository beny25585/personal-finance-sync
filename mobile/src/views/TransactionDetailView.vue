<script setup lang="ts">
import { ArrowLeft, ReceiptText } from '@lucide/vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import EmptyState from '../components/EmptyState.vue'

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <section class="view-stack" data-testid="transaction-details-page">
    <header class="page-heading">
      <h1 data-testid="page-heading">{{ t('detail.title') }}</h1>
      <p>{{ t('detail.subtitle') }}</p>
    </header>

    <section class="panel" :aria-label="t('detail.title')">
      <div class="panel-body">
        <EmptyState
          data-testid="transaction-details-empty"
          :icon="ReceiptText"
          :title="t('detail.emptyTitle')"
          :description="t('detail.emptyDescription')"
        >
          <RouterLink class="button button-secondary" to="/transactions">
            <ArrowLeft class="directional-icon" :size="18" aria-hidden="true" />
            <span>{{ t('detail.back') }}</span>
          </RouterLink>
        </EmptyState>
      </div>
    </section>
  </section>
</template>
