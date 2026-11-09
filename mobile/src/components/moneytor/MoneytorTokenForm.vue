<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ configured: boolean; disabled: boolean; saving: boolean; disconnecting: boolean }>()
const emit = defineEmits<{ save: [token: string]; disconnect: [] }>()
const { t } = useI18n({ useScope: 'global' })
const input = useTemplateRef<HTMLInputElement>('token')

function submit(): void {
  if (props.disabled || !input.value) return
  const token = input.value.value.trim()
  input.value.value = ''
  if (token) emit('save', token)
}
</script>

<template>
  <section aria-labelledby="moneytor-token-title" class="space-y-3">
    <h3 id="moneytor-token-title" class="text-sm font-semibold">{{ t('moneytor.tokenTitle') }}</h3>
    <p class="text-sm text-muted-foreground">{{ t('moneytor.tokenHelp') }}</p>
    <div class="flex flex-wrap gap-x-4 gap-y-1">
      <a
        href="https://app.moneytor.co.il/"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex min-h-12 items-center rounded-sm text-sm font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
      >{{ t('moneytor.openPortal') }}</a>
      <a
        href="https://app.moneytor.co.il/settings#api"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex min-h-12 items-center rounded-sm text-sm font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
      >{{ t('moneytor.openSettings') }}</a>
    </div>
    <form autocomplete="off" class="space-y-3" @submit.prevent="submit">
      <label class="block space-y-1 text-sm font-medium">
        <span>{{ t('moneytor.tokenLabel') }}</span>
        <input
          ref="token"
          type="password"
          dir="ltr"
          required
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :disabled="disabled"
          class="block min-h-12 w-full rounded-md border border-solid border-input bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        >
      </label>
      <div class="flex flex-wrap gap-2">
        <button
          type="submit"
          :disabled="disabled"
          class="min-h-12 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        >{{ t(saving ? 'moneytor.savingToken' : configured ? 'moneytor.replaceToken' : 'moneytor.saveToken') }}</button>
        <button
          v-if="configured"
          type="button"
          :disabled="disabled"
          class="min-h-12 rounded-md border border-solid border-input bg-background px-4 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          @click="emit('disconnect')"
        >{{ t(disconnecting ? 'moneytor.disconnecting' : 'moneytor.disconnect') }}</button>
      </div>
    </form>
  </section>
</template>
