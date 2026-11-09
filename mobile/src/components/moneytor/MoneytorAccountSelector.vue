<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { MoneytorAccount } from '../../api/moneytor'

defineProps<{
  accounts: ReadonlyArray<Readonly<MoneytorAccount>>
  selectedIds: ReadonlySet<string>
  selectionChanged: boolean
  rangeValid: boolean
  maxRangeDays: number
  busy: boolean
  discovering: boolean
  saving: boolean
  syncing: boolean
}>()
const from = defineModel<string>('from', { required: true })
const to = defineModel<string>('to', { required: true })
const emit = defineEmits<{
  discover: []
  select: [id: string, checked: boolean]
  save: []
  discard: []
  sync: []
}>()
const { t } = useI18n({ useScope: 'global' })

function select(id: string, event: Event): void {
  if (event.target instanceof HTMLInputElement) emit('select', id, event.target.checked)
}
</script>

<template>
  <section aria-labelledby="moneytor-accounts-title" class="space-y-4 border-t border-solid border-border pt-5">
    <h3 id="moneytor-accounts-title" class="text-sm font-semibold">{{ t('moneytor.accountsTitle') }}</h3>
    <p class="text-sm text-muted-foreground">{{ t('moneytor.rangeHelp', { days: maxRangeDays }) }}</p>
    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block min-w-0 space-y-1 text-sm font-medium">
        <span>{{ t('moneytor.from') }}</span>
        <input
          v-model="from"
          type="date"
          :max="to || undefined"
          :disabled="busy"
          class="block min-h-12 w-full min-w-0 rounded-md border border-solid border-input bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        >
      </label>
      <label class="block min-w-0 space-y-1 text-sm font-medium">
        <span>{{ t('moneytor.to') }}</span>
        <input
          v-model="to"
          type="date"
          :min="from || undefined"
          :disabled="busy"
          class="block min-h-12 w-full min-w-0 rounded-md border border-solid border-input bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        >
      </label>
    </div>
    <p v-if="!rangeValid" role="status" class="text-sm text-destructive">
      {{ t('moneytor.errors.invalidDate', { days: maxRangeDays }) }}
    </p>
    <button
      type="button"
      :disabled="busy || !rangeValid || selectionChanged"
      class="min-h-12 rounded-md border border-solid border-input bg-background px-4 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
      @click="emit('discover')"
    >{{ t(discovering ? 'moneytor.discovering' : 'moneytor.discover') }}</button>

    <p v-if="!accounts.length" class="text-sm text-muted-foreground">{{ t('moneytor.emptyAccounts') }}</p>
    <fieldset v-else class="min-w-0 space-y-2" :disabled="busy">
      <legend class="mb-1 text-sm font-semibold">{{ t('moneytor.selectTitle') }}</legend>
      <p class="text-sm text-muted-foreground">{{ t('moneytor.selectHelp') }}</p>
      <label
        v-for="account in accounts"
        :key="account.id"
        class="flex min-h-12 items-center gap-3 rounded-md border border-solid border-border px-3 py-2 text-sm"
      >
        <input
          type="checkbox"
          :checked="selectedIds.has(account.id)"
          class="size-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          @change="select(account.id, $event)"
        >
        <span class="min-w-0 wrap-break-word">
          <bdi>{{ account.label }}</bdi>
          <bdi v-if="account.bank && account.bank !== account.label" class="block text-xs text-muted-foreground">{{ account.bank }}</bdi>
        </span>
      </label>
    </fieldset>

    <div v-if="accounts.length" class="flex flex-wrap gap-2">
      <button
        type="button"
        :disabled="busy || !selectionChanged"
        class="min-h-12 rounded-md border border-solid border-input bg-background px-4 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        @click="emit('save')"
      >{{ t(saving ? 'moneytor.savingSelection' : 'moneytor.saveSelection') }}</button>
      <button
        v-if="selectionChanged"
        type="button"
        :disabled="busy"
        class="min-h-12 rounded-md border border-solid border-input bg-background px-4 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        @click="emit('discard')"
      >{{ t('moneytor.discardSelection') }}</button>
    </div>
    <p v-if="selectionChanged" class="text-sm text-muted-foreground">{{ t('moneytor.unsavedSelection') }}</p>

    <button
      v-if="accounts.length"
      type="button"
      :disabled="busy || !rangeValid || selectionChanged || !selectedIds.size"
      class="min-h-12 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
      @click="emit('sync')"
    >{{ t(syncing ? 'moneytor.syncing' : 'moneytor.sync') }}</button>
  </section>
</template>
