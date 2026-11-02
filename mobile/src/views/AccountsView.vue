<script setup lang="ts">
import { Building2 } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '../components/EmptyState.vue'

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <section class="view-stack" data-testid="accounts-page">
    <header class="page-heading">
      <h1 data-testid="page-heading">{{ t('accounts.title') }}</h1>
      <p>{{ t('accounts.subtitle') }}</p>
    </header>

    <section class="panel" :aria-label="t('accounts.title')">
      <div class="panel-body">
        <EmptyState
          data-testid="accounts-empty"
          :icon="Building2"
          :title="t('accounts.emptyTitle')"
          :description="t('accounts.emptyDescription')"
        />
      </div>
    </section>
  </section>
</template>
