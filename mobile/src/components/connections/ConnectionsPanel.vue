<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'
import { Plus, RefreshCw, Unplug } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { useConnections, useConnectionSync } from '../../composables/useConnections'
import EmptyState from '../EmptyState.vue'
import ConnectionCard from './ConnectionCard.vue'
import ConnectionsLoading from './ConnectionsLoading.vue'
import NewConnectionDialog from './NewConnectionDialog.vue'

defineProps<{ canManage: boolean }>()

const { t } = useI18n({ useScope: 'global' })
const { providers, status, hasLoaded, isLoading, errorCode, load, refresh } = useConnections()
const { activeProviderId, result: syncResult, sync } = useConnectionSync(() => { void refresh() })
const showAdd = shallowRef(false)
const wasSaved = shallowRef(false)

function openAdd(): void {
  wasSaved.value = false
  showAdd.value = true
}

function onSaved(): void {
  showAdd.value = false
  wasSaved.value = true
  void refresh()
}

function startSync(providerId: number): void {
  wasSaved.value = false
  void sync(providerId)
}

onMounted(() => { void load() })
</script>

<template>
  <div class="flex flex-col gap-6" :aria-busy="isLoading" data-testid="connections-panel">
    <div v-if="canManage" class="flex justify-end">
      <button
        type="button"
        class="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        :disabled="activeProviderId !== null"
        @click="openAdd"
      >
        <Plus :size="16" aria-hidden="true" />
        {{ t('accounts.manage.add') }}
      </button>
    </div>

    <p v-if="wasSaved" role="status" class="text-sm text-muted-foreground">{{ t('accounts.manage.saved') }}</p>
    <p
      v-else-if="syncResult"
      :role="syncResult === 'success' ? 'status' : 'alert'"
      class="text-sm"
      :class="syncResult === 'success' ? 'text-muted-foreground' : 'text-destructive'"
    >
      {{ t('accounts.manage.syncResult.' + syncResult) }}
    </p>

    <div v-if="errorCode" role="alert" class="rounded-md border border-solid border-destructive/50 bg-destructive/10 p-4" data-testid="connections-error">
      <p class="text-sm text-destructive">{{ t('accounts.errors.' + errorCode) }}</p>
      <button
        type="button"
        class="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-solid border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-50"
        :disabled="isLoading"
        @click="load"
      >
        <RefreshCw :size="16" aria-hidden="true" />
        {{ t('accounts.retry') }}
      </button>
    </div>

    <ConnectionsLoading v-if="!hasLoaded && (status === 'idle' || isLoading)" />
    <template v-else-if="hasLoaded">
      <EmptyState
        v-if="providers.length === 0"
        :icon="Unplug"
        :title="t('accounts.loadedEmptyTitle')"
        :description="t('accounts.loadedEmptyDescription')"
        data-testid="connections-loaded-empty"
      />
      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="connections-list">
        <ConnectionCard
          v-for="provider in providers"
          :key="provider.id"
          :provider="provider"
          :show-sync="canManage && provider.hasCredentials"
          :syncing="activeProviderId === provider.id"
          :sync-disabled="activeProviderId !== null"
          @sync="startSync"
        />
      </div>

      <div v-if="!errorCode" class="flex justify-end">
        <button
          type="button"
          class="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-solid border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-50"
          :disabled="isLoading"
          @click="load"
        >
          <RefreshCw :size="16" :class="{ 'motion-safe:animate-spin': isLoading }" aria-hidden="true" />
          {{ t(isLoading ? 'accounts.loading' : 'accounts.reload') }}
        </button>
      </div>
    </template>

    <NewConnectionDialog
      v-if="canManage && showAdd"
      @close="showAdd = false"
      @saved="onSaved"
      @uncertain="refresh"
    />
  </div>
</template>
