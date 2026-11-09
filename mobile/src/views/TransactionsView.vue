<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { Receipt } from '@lucide/vue'
import { RouterView, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import EmptyState from '../components/EmptyState.vue'
import TransactionFilters from '../components/transactions/TransactionFilters.vue'
import TransactionList from '../components/transactions/TransactionList.vue'
import { useTransactionList } from '../composables/useTransactionList'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const query = shallowRef('')
const detailOpen = computed(() => route.name === 'transaction-details')
const { loaded, loading, failed, canGoBack, canGoForward, changePage, retry } = useTransactionList(query)
</script>

<template>
  <div :data-testid="detailOpen ? 'transaction-details-page' : undefined">
    <section
      class="view-stack transactions-page"
      data-testid="transactions-page"
      :inert="detailOpen"
      :aria-hidden="detailOpen ? 'true' : undefined"
    >
      <header class="page-heading">
        <h1 :data-testid="detailOpen ? undefined : 'page-heading'">
          {{ t('transactions.title') }}
        </h1>
      </header>

      <TransactionFilters @update="query = $event" />

      <p v-if="loading" role="status" class="text-sm text-muted-foreground">
        {{ t('transactions.loading') }}
      </p>
      <div v-if="failed" class="flex flex-wrap items-center gap-2">
        <p role="alert" class="text-sm text-destructive">{{ t('transactions.loadFailed') }}</p>
        <button type="button" class="button button-secondary min-h-11" @click="retry">
          {{ t('accounts.retry') }}
        </button>
      </div>

      <TransactionList
        v-if="loaded && loaded.transactions.length"
        :page="loaded"
        :can-go-back="canGoBack"
        :can-go-forward="canGoForward"
        :disabled="loading || failed"
        @page="changePage"
      />
      <template v-else-if="!loading && !failed">
        <p v-if="loaded && query" role="status" class="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          {{ t('transactions.noMatches') }}
        </p>
        <EmptyState
          v-else
          data-testid="transactions-empty"
          :icon="Receipt"
          :title="t('transactions.emptyTitle')"
          :description="t('transactions.emptyDescription')"
        />
      </template>
    </section>

    <RouterView />
  </div>
</template>
