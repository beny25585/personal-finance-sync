<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { X } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { isHostedFinanceApp } from '../api/host'
import { getLedgerTransaction, type LedgerTransaction } from '../api/transactions'
import { formatTransactionAccount, formatTransactionAmount, formatTransactionDate } from '../lib/transaction-format'

const { t, locale } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const sheet = shallowRef<HTMLDialogElement | null>(null)
const transaction = shallowRef<LedgerTransaction | null>(null)
const loading = shallowRef(false)
const failed = shallowRef(false)
const retries = shallowRef(0)
let previousOverflow = ''

const transactionId = computed(() => {
  const raw = route.query.id
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
})

const details = computed(() => {
  const movement = transaction.value
  if (!movement) return []
  return [
    { label: 'detail.amount', value: formatTransactionAmount(movement, locale.value) },
    { label: 'detail.date', value: formatTransactionDate(movement.date, locale.value) },
    { label: 'detail.bookingDate', value: formatTransactionDate(movement.processedDate, locale.value) },
    { label: 'cashFlow.accountName', value: formatTransactionAccount(movement) },
    { label: 'transactions.category', value: movement.category },
    { label: 'transactions.status', value: t('transactions.' + movement.status) },
  ].filter(({ value }) => value)
})

if (isHostedFinanceApp) {
  watch([transactionId, retries], async ([id], _previous, onCleanup) => {
    transaction.value = null
    failed.value = false
    loading.value = id !== null
    if (id === null) return

    const controller = new AbortController()
    onCleanup(() => controller.abort())
    try {
      const movement = await getLedgerTransaction(id, controller.signal)
      if (!controller.signal.aborted) transaction.value = movement
    } catch {
      if (!controller.signal.aborted) failed.value = true
    } finally {
      if (!controller.signal.aborted) loading.value = false
    }
  }, { immediate: true })
}

function closeDetails(): void {
  void router.replace('/transactions')
}

function onBackdropClick(event: MouseEvent): void {
  if (event.target !== sheet.value || !sheet.value) return
  const rect = sheet.value.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right
    || event.clientY < rect.top || event.clientY > rect.bottom) closeDetails()
}

onMounted(() => {
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  sheet.value?.showModal()
})

onBeforeUnmount(() => {
  sheet.value?.close()
  document.body.style.overflow = previousOverflow
})
</script>

<template>
  <dialog
    ref="sheet"
    class="transaction-detail-sheet"
    aria-labelledby="transaction-details-title"
    :aria-describedby="failed ? undefined : 'transaction-details-description'"
    @cancel.prevent="closeDetails"
    @click="onBackdropClick"
  >
    <header class="transaction-detail-header">
      <div class="page-heading">
        <h1 id="transaction-details-title" data-testid="page-heading">{{ t('detail.title') }}</h1>
        <p v-if="transaction" id="transaction-details-description" class="break-words">
          <bdi>{{ transaction.description || transaction.providerDisplayName }}</bdi>
        </p>
        <p v-else-if="loading" id="transaction-details-description" role="status">
          {{ t('transactions.loading') }}
        </p>
        <p v-else-if="!failed" id="transaction-details-description" data-testid="transaction-details-empty">
          {{ t(isHostedFinanceApp && route.query.id !== undefined ? 'detail.notFound' : 'detail.emptyTitle') }}
        </p>
      </div>
      <button
        data-testid="transaction-details-close"
        class="transaction-detail-close"
        type="button"
        autofocus
        :aria-label="t('detail.close')"
        @click="closeDetails"
      >
        <X :size="16" aria-hidden="true" />
      </button>
    </header>

    <div v-if="failed" class="grid justify-items-start gap-2">
      <p role="alert" class="text-sm text-destructive">{{ t('detail.loadFailed') }}</p>
      <button type="button" class="button button-secondary min-h-11" @click="retries += 1">
        {{ t('accounts.retry') }}
      </button>
    </div>

    <dl v-if="details.length" class="m-0 grid gap-3 rounded-lg border border-border bg-card p-4">
      <div v-for="field in details" :key="field.label" class="grid min-w-0 gap-0.5">
        <dt class="text-xs text-muted-foreground">{{ t(field.label) }}</dt>
        <dd class="m-0 break-words text-sm font-medium tabular-nums"><bdi>{{ field.value }}</bdi></dd>
      </div>
    </dl>
  </dialog>
</template>
