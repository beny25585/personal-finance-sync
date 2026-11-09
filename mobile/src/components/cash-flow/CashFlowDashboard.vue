<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { currentMonth, useCashFlow } from '../../composables/useCashFlow'
import type { FlowFilter } from '../../api/cash-flow'
import AccountOrganizationForm from './AccountOrganizationForm.vue'
import CashFlowAmounts from './CashFlowAmounts.vue'
import CashFlowFilters from './CashFlowFilters.vue'

const { t, locale } = useI18n({ useScope: 'global' })
const initial = currentMonth()
const requested = shallowRef<FlowFilter>(initial)
const editingId = shallowRef<number>()
const filterRevision = shallowRef(0)
const { report, applied, loading, failed, load } = useCashFlow()
const accounts = computed(() => report.value?.accounts ?? [])
const accountsById = computed(() => new Map(accounts.value.map((account) => [account.id, account])))
const breakdown = computed(() => (report.value?.breakdown ?? []).flatMap((row) => {
  const account = accountsById.value.get(row.accountId)
  return account ? [{ account, totals: row.totals }] : []
}))
const shownScope = computed(() => {
  const scope = applied.value?.scope ?? ''
  if (scope.startsWith('g:')) return scope.slice(2)
  if (scope.startsWith('a:')) return accountsById.value.get(Number(scope.slice(2)))?.name ?? ''
  return t('cashFlow.all')
})
const shownRange = computed(() => {
  if (!applied.value) return ''
  const { from, to } = applied.value
  const formatter = new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeZone: 'UTC' })
  return formatter.formatRange(new Date(from), new Date(to))
})

function apply(filter: FlowFilter) {
  editingId.value = undefined
  requested.value = filter
  void load(filter)
}

function afterSave() {
  editingId.value = undefined
  const scope = requested.value.scope
  if (scope.startsWith('g:')) {
    requested.value = { ...requested.value, scope: '' }
    filterRevision.value++
  }
  void load(requested.value)
}

onMounted(() => load(initial))
</script>

<template>
  <div class="grid min-w-0 gap-4" :aria-busy="loading">
    <CashFlowFilters :key="filterRevision" :initial="requested" :accounts="accounts" :loading="loading" @apply="apply" />
    <p v-if="loading" role="status" class="text-sm text-muted-foreground">{{ t('cashFlow.loading') }}</p>
    <div v-if="failed" role="alert" class="rounded-lg border border-solid border-border p-3">
      <p class="text-sm text-destructive">{{ t('cashFlow.loadFailed') }}</p>
      <button type="button" class="min-h-12 rounded-md px-3 underline focus-visible:outline-2 focus-visible:outline-ring"
        @click="load(requested)">{{ t('accounts.retry') }}</button>
    </div>
    <section v-if="report && accounts.length === 0" class="grid gap-2 rounded-lg border border-solid border-border p-3">
      <p>{{ t('cashFlow.noAccounts') }}</p>
      <RouterLink class="inline-flex min-h-12 items-center underline focus-visible:outline-2 focus-visible:outline-ring"
        to="/providers">{{ t('overview.viewConnections') }}</RouterLink>
    </section>
    <template v-else-if="report">
      <section class="grid min-w-0 gap-2 rounded-lg border border-solid border-border bg-card p-3">
        <h2 class="break-words text-base font-semibold"><bdi>{{ shownScope }}</bdi></h2>
        <p class="text-sm text-muted-foreground"><bdi>{{ shownRange }}</bdi></p>
        <CashFlowAmounts :totals="report.totals" />
        <p v-if="!applied?.scope.startsWith('a:') && report.totals.length"
          class="text-sm text-muted-foreground">{{ t('cashFlow.adjustments') }}</p>
      </section>
      <section v-if="breakdown.length" class="grid min-w-0 gap-2">
        <h2 class="text-base font-semibold">{{ t('cashFlow.byAccount') }}</h2>
        <article v-for="row in breakdown" :key="row.account.id" class="grid min-w-0 gap-2 rounded-lg border border-solid border-border bg-card p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0">
              <h3 class="break-words font-medium"><bdi>{{ row.account.name }}</bdi></h3>
              <p v-if="row.account.group" class="break-words text-sm text-muted-foreground"><bdi>{{ row.account.group }}</bdi></p>
            </div>
            <button type="button" :aria-expanded="editingId === row.account.id" :disabled="loading"
              class="min-h-12 rounded-md px-3 text-sm underline hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
              @click="editingId = editingId === row.account.id ? undefined : row.account.id">
              {{ t(editingId === row.account.id ? 'cashFlow.closeEdit' : 'cashFlow.edit') }}
            </button>
          </div>
          <AccountOrganizationForm v-if="editingId === row.account.id" :account="row.account" @saved="afterSave" />
          <CashFlowAmounts :totals="row.totals" />
        </article>
      </section>
    </template>
  </div>
</template>
