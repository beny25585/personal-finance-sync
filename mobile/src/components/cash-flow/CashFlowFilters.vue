<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FlowAccount, FlowFilter } from '../../api/cash-flow'

const props = defineProps<{ initial: FlowFilter; accounts: FlowAccount[]; loading: boolean }>()
const emit = defineEmits<{ apply: [filter: FlowFilter] }>()
const { t } = useI18n({ useScope: 'global' })
const draft = reactive({ ...props.initial })
const groups = computed(() => [...new Set(props.accounts.flatMap(({ group }) => group ? [group] : []))])
const valid = computed(() => Boolean(draft.from && draft.to && draft.from <= draft.to))

function submit() {
  if (valid.value) emit('apply', { ...draft })
}
</script>

<template>
  <form class="grid min-w-0 gap-3 rounded-lg border border-solid border-border bg-card p-3 sm:grid-cols-2" @submit.prevent="submit">
    <label class="grid min-w-0 gap-1 text-sm sm:col-span-2">
      {{ t('cashFlow.scope') }}
      <select v-model="draft.scope" class="min-h-12 min-w-0 rounded-md border border-solid border-input bg-background px-2 focus-visible:outline-2 focus-visible:outline-ring">
        <option value="">{{ t('cashFlow.all') }}</option>
        <optgroup v-if="groups.length" :label="t('cashFlow.groups')">
          <option v-for="group in groups" :key="group" :value="'g:' + group">{{ group }}</option>
        </optgroup>
        <optgroup v-if="accounts.length" :label="t('accounts.accounts')">
          <option v-for="account in accounts" :key="account.id" :value="'a:' + account.id">{{ account.name }}</option>
        </optgroup>
      </select>
    </label>
    <label class="grid min-w-0 gap-1 text-sm">
      {{ t('transactions.from') }}
      <input v-model="draft.from" type="date" required :max="draft.to || undefined"
        class="min-h-12 min-w-0 rounded-md border border-solid border-input bg-background px-2 focus-visible:outline-2 focus-visible:outline-ring" />
    </label>
    <label class="grid min-w-0 gap-1 text-sm">
      {{ t('transactions.to') }}
      <input v-model="draft.to" type="date" required :min="draft.from || undefined"
        class="min-h-12 min-w-0 rounded-md border border-solid border-input bg-background px-2 focus-visible:outline-2 focus-visible:outline-ring" />
    </label>
    <button type="submit" :disabled="!valid || loading"
      class="min-h-12 rounded-md bg-primary px-3 font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 sm:col-span-2">
      {{ t('cashFlow.apply') }}
    </button>
  </form>
</template>
