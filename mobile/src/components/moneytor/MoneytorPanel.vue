<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMoneytor } from '../../composables/useMoneytor'
import MoneytorAccountSelector from './MoneytorAccountSelector.vue'
import MoneytorTokenForm from './MoneytorTokenForm.vue'

const { t, locale } = useI18n({ useScope: 'global' })
const {
  from, to, maxRangeDays, status, operation, issue, notice, result, selectedIds, selectionChanged,
  rangeValid, load, saveToken, disconnect, discover, setSelected, saveSelection, discardSelection, sync,
} = useMoneytor()

const busy = computed(() => operation.value !== null)
const lastSync = computed(() => status.value?.lastSync
  ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(status.value.lastSync))
  : null)
const syncReport = computed(() => {
  const summary = result.value
  if (!summary) return ''
  const number = new Intl.NumberFormat(locale.value)
  return t('moneytor.syncReport', {
    imported: number.format(summary.imported),
    updated: number.format(summary.updated),
    skipped: number.format(summary.skipped),
  })
})

onMounted(load)
</script>

<template>
  <article aria-labelledby="moneytor-heading" class="space-y-5 rounded-xl border border-solid border-border/60 bg-card p-5 text-card-foreground">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0 space-y-1">
        <h2 id="moneytor-heading" class="text-base font-semibold">{{ t('moneytor.title') }}</h2>
        <p class="text-sm text-muted-foreground">{{ t('moneytor.description') }}</p>
      </div>
      <button
        v-if="status || issue"
        type="button"
        :disabled="busy || selectionChanged"
        class="min-h-12 rounded-md border border-solid border-input bg-background px-3 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        @click="load"
      >{{ t(operation === 'load' ? 'moneytor.loading' : 'moneytor.refresh') }}</button>
    </header>

    <p v-if="!status && operation === 'load'" role="status" class="text-sm text-muted-foreground">{{ t('moneytor.loading') }}</p>
    <p v-if="issue" role="alert" class="rounded-md border border-solid border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
      {{ t('moneytor.errors.' + issue, { days: maxRangeDays }) }}
    </p>
    <p v-else-if="syncReport || notice || operation === 'sync'" role="status" class="rounded-md border border-solid border-border bg-muted p-3 text-sm">
      {{ syncReport || (notice ? t('moneytor.notices.' + notice) : t('moneytor.syncing')) }}
    </p>

    <template v-if="status">
      <p v-if="notice !== 'token'" class="text-sm text-muted-foreground">{{ t(status.configured ? 'moneytor.configured' : 'moneytor.notConfigured') }}</p>
      <p v-if="lastSync" class="text-sm text-muted-foreground">{{ t('moneytor.lastSync', { time: lastSync }) }}</p>

      <MoneytorTokenForm
        :configured="status.configured"
        :disabled="busy || selectionChanged"
        :saving="operation === 'token'"
        :disconnecting="operation === 'disconnect'"
        @save="saveToken"
        @disconnect="disconnect"
      />
      <MoneytorAccountSelector
        v-if="status.configured"
        v-model:from="from"
        v-model:to="to"
        :accounts="status.accounts"
        :selected-ids="selectedIds"
        :selection-changed="selectionChanged"
        :range-valid="rangeValid"
        :max-range-days="maxRangeDays"
        :busy="busy"
        :discovering="operation === 'discover'"
        :saving="operation === 'selection'"
        :syncing="operation === 'sync'"
        @discover="discover"
        @select="setSelected"
        @save="saveSelection"
        @discard="discardSelection"
        @sync="sync"
      />
    </template>
  </article>
</template>
