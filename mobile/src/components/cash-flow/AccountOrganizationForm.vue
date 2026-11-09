<script setup lang="ts">
import { onScopeDispose, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { updateAccountOrganization, type FlowAccount } from '../../api/cash-flow'

const props = defineProps<{ account: FlowAccount }>()
const emit = defineEmits<{ saved: [] }>()
const { t } = useI18n({ useScope: 'global' })
const name = shallowRef(props.account.displayName ?? '')
const group = shallowRef(props.account.group ?? '')
const saving = shallowRef(false)
const failed = shallowRef(false)
let request: AbortController | undefined

async function save() {
  if (saving.value) return
  saving.value = true
  failed.value = false
  const next = new AbortController()
  request = next
  try {
    await updateAccountOrganization(props.account.id, {
      name: name.value.trim() || null,
      group: group.value.trim() || null,
    }, next.signal)
    if (!next.signal.aborted) emit('saved')
  } catch {
    if (!next.signal.aborted) failed.value = true
  } finally {
    saving.value = false
  }
}

onScopeDispose(() => request?.abort())
</script>

<template>
  <form class="grid gap-3 pt-2 sm:grid-cols-2" @submit.prevent="save">
    <label class="grid min-w-0 gap-1 text-sm">
      {{ t('cashFlow.accountName') }}
      <input v-model="name" maxlength="80" type="text" dir="auto" :disabled="saving"
        class="min-h-12 min-w-0 rounded-md border border-solid border-input bg-background px-2 focus-visible:outline-2 focus-visible:outline-ring" />
    </label>
    <label class="grid min-w-0 gap-1 text-sm">
      {{ t('cashFlow.group') }}
      <input v-model="group" maxlength="80" type="text" dir="auto" :disabled="saving"
        class="min-h-12 min-w-0 rounded-md border border-solid border-input bg-background px-2 focus-visible:outline-2 focus-visible:outline-ring" />
    </label>
    <button type="submit" :disabled="saving"
      class="min-h-12 rounded-md border border-solid border-border px-3 font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 sm:col-span-2">
      {{ t(saving ? 'cashFlow.saving' : 'cashFlow.save') }}
    </button>
    <p v-if="failed" role="alert" class="text-sm text-destructive sm:col-span-2">{{ t('cashFlow.saveFailed') }}</p>
  </form>
</template>
