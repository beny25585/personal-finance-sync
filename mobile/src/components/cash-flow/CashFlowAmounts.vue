<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FlowTotal } from '../../api/cash-flow'

const props = defineProps<{ totals: FlowTotal[] }>()
const { t, locale } = useI18n({ useScope: 'global' })

function money(amount: number, currency: string): string {
  if (!/^[A-Z]{3}$/.test(currency)) return new Intl.NumberFormat(locale.value).format(amount) + ' ' + currency
  return new Intl.NumberFormat(locale.value, { style: 'currency', currency }).format(amount)
}

const rows = computed(() => props.totals.map((total) => ({
  currency: total.currency,
  entries: (['income', 'expenses', 'net'] as const).map((key) => ({
    key,
    value: money(total[key], total.currency),
  })),
})))
</script>

<template>
  <p v-if="rows.length === 0" class="text-sm text-muted-foreground">{{ t('cashFlow.noTransactions') }}</p>
  <dl v-for="row in rows" :key="row.currency" class="grid gap-2 sm:grid-cols-3">
    <div v-for="entry in row.entries" :key="entry.key" class="min-w-0 rounded-md bg-muted p-2">
      <dt class="text-sm text-muted-foreground">{{ t('cashFlow.' + entry.key) }}</dt>
      <dd class="m-0 break-words text-lg font-semibold tabular-nums"><bdi>{{ entry.value }}</bdi></dd>
    </div>
  </dl>
</template>
