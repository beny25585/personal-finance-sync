<script setup lang="ts">
import { computed, type DeepReadonly } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, Building2, CheckCircle2, Clock, CreditCard, RefreshCw, XCircle } from '@lucide/vue'
import type { ConnectionProvider } from '../../api/connections'

const props = defineProps<{
  provider: DeepReadonly<ConnectionProvider>
  showSync?: boolean
  syncing?: boolean
  syncDisabled?: boolean
}>()

const emit = defineEmits<{ sync: [providerId: number] }>()
const { t, te, locale } = useI18n({ useScope: 'global' })
const institutionName = computed(() => {
  const labelKey = 'accounts.manage.institutions.' + props.provider.companyId
  return te(labelKey) ? t(labelKey) : props.provider.displayName
})
const numberFormatter = computed(() => new Intl.NumberFormat(locale.value))
const institutionIcon = computed(() => props.provider.type === 'bank' ? Building2 : CreditCard)
const institutionClasses = computed(() => props.provider.type === 'bank'
  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
  : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300')

const status = computed(() => {
  switch (props.provider.authStatus) {
    case 'connected':
      return { icon: CheckCircle2, label: 'accounts.statusConnected', iconClass: 'text-green-500', textClass: 'text-muted-foreground' }
    case 'pending':
      return { icon: Clock, label: 'accounts.statusPending', iconClass: 'text-yellow-500', textClass: 'text-yellow-600 dark:text-yellow-400' }
    case 'expired':
      return { icon: AlertTriangle, label: 'accounts.statusExpired', iconClass: 'text-orange-500', textClass: 'text-orange-600 dark:text-orange-400' }
    case 'no':
      return { icon: XCircle, label: 'accounts.statusNoCredentials', iconClass: 'text-destructive', textClass: 'text-destructive' }
  }
})

function formatBalance(balance: number, currency: string): string {
  try {
    return new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(balance)
  } catch {
    // Keep the returned amount visible without inventing a currency for invalid metadata.
    return numberFormatter.value.format(balance)
  }
}

const accounts = computed(() => props.provider.accounts.map((account) => ({
  id: account.id,
  name: account.displayName,
  number: account.accountNumber.length <= 4 ? account.accountNumber : `****${account.accountNumber.slice(-4)}`,
  balance: account.balance === null ? null : formatBalance(account.balance, account.currency),
  excluded: account.excluded,
})))

const syncLabel = computed(() => {
  if (!props.provider.lastSyncedAt) return t('accounts.neverSynced')
  const date = new Date(props.provider.lastSyncedAt)
  const timestamp = date.getTime()
  if (!Number.isFinite(timestamp)) return t('accounts.syncTimeUnavailable')
  const elapsed = Date.now() - timestamp
  if (elapsed < 0) {
    return t('accounts.lastSynced', {
      time: new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(date),
    })
  }
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return t('accounts.lastSynced', { time: t('accounts.syncedJustNow') })
  if (minutes < 60) return t('accounts.lastSynced', { time: t('accounts.syncedMinutes', { count: numberFormatter.value.format(minutes) }) })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('accounts.lastSynced', { time: t('accounts.syncedHours', { count: numberFormatter.value.format(hours) }) })
  return t('accounts.lastSynced', { time: t('accounts.syncedDays', { count: numberFormatter.value.format(Math.floor(hours / 24)) }) })
})
</script>

<template>
  <article
    class="rounded-xl border border-solid border-border/60 bg-card text-card-foreground transition-colors duration-200 motion-reduce:transition-none"
    data-testid="connection-card"
  >
    <header class="flex flex-col gap-1 px-5 pt-5 pb-3">
      <div class="flex items-start justify-between">
        <div class="flex min-w-0 items-center gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" :class="institutionClasses" aria-hidden="true">
            <component :is="institutionIcon" class="h-5 w-5" />
          </div>
          <div class="min-w-0">
            <h2 class="break-words text-base leading-none font-semibold tracking-tight">{{ institutionName }}</h2>
            <p v-if="provider.alias && provider.alias !== provider.displayName" class="break-words text-sm text-muted-foreground">
              {{ provider.alias }}
            </p>
          </div>
        </div>
      </div>
    </header>

    <div class="space-y-3 px-5 pt-4 pb-5">
      <div class="flex items-center gap-2 text-sm">
        <component :is="status.icon" class="h-4 w-4" :class="status.iconClass" aria-hidden="true" />
        <span :class="status.textClass">{{ t(status.label) }}</span>
      </div>

      <div v-if="accounts.length" class="space-y-0.5">
        <p class="mb-1 text-xs font-medium text-muted-foreground">{{ t('accounts.accounts') }}</p>
        <div
          v-for="account in accounts"
          :key="account.id"
          class="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[13px]"
          :class="{ 'opacity-50': account.excluded }"
        >
          <div class="min-w-0">
            <p v-if="account.name" class="truncate font-medium" dir="auto">{{ account.name }}</p>
            <bdi class="truncate text-muted-foreground" dir="ltr">{{ account.number }}</bdi>
          </div>
          <span
            v-if="account.balance !== null"
            class="shrink-0 text-xs tabular-nums"
            :class="{ 'line-through': account.excluded }"
          >{{ account.balance }}</span>
        </div>
      </div>
      <div v-else class="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p class="text-muted-foreground">{{ t('accounts.accounts') }}</p>
          <p class="font-medium tabular-nums">{{ numberFormatter.format(provider.accountCount) }}</p>
        </div>
        <div>
          <p class="text-muted-foreground">{{ t('accounts.transactions') }}</p>
          <p class="font-medium tabular-nums">{{ numberFormatter.format(provider.transactionCount) }}</p>
        </div>
      </div>

      <p v-if="accounts.length" class="text-sm text-muted-foreground">
        {{ t('accounts.transactionCount', { count: numberFormatter.format(provider.transactionCount) }) }}
      </p>
    </div>

    <footer class="flex flex-wrap items-center justify-between gap-2 px-5 pt-0 pb-4 text-xs text-muted-foreground">
      <span>{{ syncLabel }}</span>
      <button
        v-if="showSync"
        type="button"
        :disabled="syncDisabled"
        :aria-label="t(syncing ? 'accounts.manage.syncing' : 'accounts.manage.syncNamed', { name: provider.alias || institutionName })"
        class="inline-flex min-h-12 items-center gap-2 rounded-md border border-solid border-input bg-background px-3 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        @click="emit('sync', provider.id)"
      >
        <RefreshCw :size="16" :class="{ 'motion-safe:animate-spin': syncing }" aria-hidden="true" />
        {{ t(syncing ? 'accounts.manage.syncing' : 'accounts.manage.sync') }}
      </button>
    </footer>
  </article>
</template>
