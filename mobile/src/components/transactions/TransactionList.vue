<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { LedgerPage } from '../../api/transactions'
import { formatTransactionAccount, formatTransactionAmount, formatTransactionDate } from '../../lib/transaction-format'

const props = defineProps<{
  page: LedgerPage & { offset: number }
  canGoBack: boolean
  canGoForward: boolean
  disabled: boolean
}>()
const emit = defineEmits<{ page: [direction: -1 | 1] }>()
const { t, n, locale } = useI18n({ useScope: 'global' })

const rows = computed(() => props.page.transactions.map((transaction) => ({
  id: transaction.id,
  description: transaction.description || transaction.providerDisplayName,
  account: formatTransactionAccount(transaction),
  date: transaction.date,
  dateLabel: formatTransactionDate(transaction.date, locale.value),
  amountLabel: formatTransactionAmount(transaction, locale.value),
})))

const range = computed(() => t('transactions.pageRange', {
  from: n(props.page.offset + 1),
  to: n(props.page.offset + rows.value.length),
  total: n(props.page.total),
}))
</script>

<template>
  <div class="grid gap-3">
    <ul class="m-0 grid list-none divide-y divide-border rounded-lg border border-border bg-card p-0">
      <li v-for="row in rows" :key="row.id" class="min-w-0" data-testid="transaction-row">
        <RouterLink
          :to="{ name: 'transaction-details', query: { id: String(row.id) } }"
          class="grid min-h-14 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-card-foreground no-underline hover:bg-muted focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
        >
          <span class="min-w-0">
            <bdi class="block break-words text-sm font-semibold">{{ row.description }}</bdi>
            <span class="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              <time :datetime="row.date">{{ row.dateLabel }}</time>
              <bdi>{{ row.account }}</bdi>
            </span>
          </span>
          <bdi class="text-end text-sm font-semibold tabular-nums">{{ row.amountLabel }}</bdi>
        </RouterLink>
      </li>
    </ul>

    <div v-if="canGoBack || canGoForward" class="flex flex-wrap items-center justify-between gap-2">
      <span class="text-sm text-muted-foreground">{{ range }}</span>
      <div class="flex flex-wrap gap-2">
        <button
          class="button button-secondary min-h-11"
          type="button"
          :disabled="disabled || !canGoBack"
          @click="emit('page', -1)"
        >
          {{ t('transactions.previousPage') }}
        </button>
        <button
          class="button button-secondary min-h-11"
          type="button"
          :disabled="disabled || !canGoForward"
          @click="emit('page', 1)"
        >
          {{ t('transactions.nextPage') }}
        </button>
      </div>
    </div>
  </div>
</template>
