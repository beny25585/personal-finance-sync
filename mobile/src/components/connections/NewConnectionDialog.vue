<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ConnectionType } from '../../api/connections'
import { useConnectionForm } from '../../composables/useConnectionForm'

const emit = defineEmits<{ close: []; saved: []; uncertain: [] }>()
const { t, te } = useI18n({ useScope: 'global' })
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const {
  type, companyId, fields, issue, loadingCatalog, loadingFields, saving, matchingInstitutions,
  setType, loadInstitutions, loadFields, save,
} = useConnectionForm(() => emit('saved'), () => emit('uncertain'))

const institutions = computed(() => matchingInstitutions.value.map((institution) => {
  const labelKey = 'accounts.manage.institutions.' + institution.companyId
  return { ...institution, label: te(labelKey) ? t(labelKey) : institution.displayName }
}))

function changeType(event: Event): void {
  if (event.target instanceof HTMLSelectElement) setType(event.target.value as ConnectionType | '')
}

function fieldLabel(field: string): string {
  const key = 'accounts.manage.fields.' + field
  return te(key) ? t(key) : t('accounts.manage.field', { name: field })
}

function fieldType(field: string): 'password' | 'email' | 'text' {
  if (field === 'email') return 'email'
  return field === 'username' || field === 'userCode' ? 'text' : 'password'
}

function inputMode(field: string): 'numeric' | undefined {
  return ['id', 'nationalID', 'num', 'card5Digits', 'card6Digits'].includes(field) ? 'numeric' : undefined
}

function submit(event: SubmitEvent): void {
  if (event.currentTarget instanceof HTMLFormElement) void save(event.currentTarget)
}

function close(): void {
  if (!saving.value) emit('close')
}

onMounted(() => {
  dialog.value?.showModal()
  void loadInstitutions()
})

onBeforeUnmount(() => dialog.value?.close())
</script>

<template>
  <dialog
    ref="dialog"
    class="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-xl border border-solid border-border bg-card p-5 text-card-foreground shadow-xl backdrop:bg-black/60"
    aria-labelledby="new-connection-title"
    @cancel.prevent="close"
  >
    <h2 id="new-connection-title" class="mb-4 text-lg font-semibold">{{ t('accounts.manage.add') }}</h2>

    <p v-if="loadingCatalog" role="status" class="text-sm text-muted-foreground">
      {{ t('accounts.manage.loadingInstitutions') }}
    </p>
    <form autocomplete="off" class="space-y-4" @submit.prevent="submit">
      <div v-if="issue" role="alert" class="rounded-md border border-solid border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        <p>{{ t('accounts.manage.' + issue) }}</p>
        <button
          v-if="issue === 'catalogError' || issue === 'fieldsError'"
          type="button"
          class="mt-2 min-h-12 rounded-md border border-solid border-input bg-background px-3 text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          @click="issue === 'catalogError' ? loadInstitutions() : loadFields()"
        >{{ t('accounts.retry') }}</button>
      </div>

      <fieldset class="min-w-0 space-y-4 disabled:opacity-70" :disabled="saving">
        <label class="block space-y-1 text-sm font-medium">
          <span>{{ t('accounts.manage.institutionType') }}</span>
          <select
            :value="type"
            class="block min-h-12 w-full rounded-md border border-solid border-input bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
            :disabled="loadingCatalog || issue === 'catalogError'"
            autofocus
            @change="changeType"
          >
            <option value="">{{ t('accounts.manage.chooseType') }}</option>
            <option value="bank">{{ t('accounts.manage.bank') }}</option>
            <option value="credit_card">{{ t('accounts.manage.card') }}</option>
          </select>
        </label>

        <label v-if="type && institutions.length" class="block space-y-1 text-sm font-medium">
          <span>{{ t('accounts.manage.institution') }}</span>
          <select
            v-model="companyId"
            class="block min-h-12 w-full rounded-md border border-solid border-input bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <option value="">{{ t('accounts.manage.chooseInstitution') }}</option>
            <option v-for="institution in institutions" :key="institution.companyId" :value="institution.companyId">
              {{ institution.label }}
            </option>
          </select>
        </label>
        <p v-else-if="type && !loadingCatalog" class="text-sm text-muted-foreground">{{ t('accounts.manage.noInstitutions') }}</p>

        <p v-if="loadingFields" role="status" class="text-sm text-muted-foreground">{{ t('accounts.manage.loadingFields') }}</p>
        <template v-if="fields">
          <label v-for="field in fields.loginFields" :key="fields.companyId + '-' + field" class="block space-y-1 text-sm font-medium">
            <span>{{ fieldLabel(field) }}</span>
            <input
              :name="field"
              :type="fieldType(field)"
              :inputmode="inputMode(field)"
              :required="field !== 'otpLongTermToken'"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              dir="auto"
              class="block min-h-12 w-full rounded-md border border-solid border-input bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring"
            >
          </label>
          <label class="block space-y-1 text-sm font-medium">
            <span>{{ t('accounts.manage.alias') }}</span>
            <input
              name="alias"
              dir="ltr"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              pattern="[A-Za-z0-9_\-]+"
              maxlength="64"
              aria-describedby="connection-alias-help"
              class="block min-h-12 w-full rounded-md border border-solid border-input bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring"
            >
            <span id="connection-alias-help" class="block text-xs font-normal text-muted-foreground">{{ t('accounts.manage.aliasHint') }}</span>
          </label>
        </template>
      </fieldset>

      <div class="flex flex-wrap justify-end gap-2 pt-2">
        <button
          type="button"
          :disabled="saving"
          class="min-h-12 rounded-md border border-solid border-input bg-background px-4 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          @click="close"
        >{{ t('accounts.manage.cancel') }}</button>
        <button
          type="submit"
          :disabled="saving || !fields || issue === 'saveUnknown'"
          class="min-h-12 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        >{{ t(saving ? 'accounts.manage.saving' : 'accounts.manage.save') }}</button>
      </div>
    </form>
  </dialog>
</template>
