<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <div role="status" :aria-label="t('accounts.loading')" data-testid="connections-loading">
    <span class="sr-only">{{ t('accounts.loading') }}</span>
    <!-- Original providers-page skeleton: three cards, no fabricated account records. -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      <div v-for="index in 3" :key="index" class="space-y-3 rounded-xl border border-solid border-border p-6">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-lg bg-muted motion-safe:animate-pulse" />
          <div class="space-y-1.5">
            <div class="h-4 w-28 rounded-md bg-muted motion-safe:animate-pulse" />
            <div class="h-3 w-20 rounded-md bg-muted motion-safe:animate-pulse" />
          </div>
        </div>
        <div class="h-4 w-32 rounded-md bg-muted motion-safe:animate-pulse" />
        <div class="grid grid-cols-2 gap-2">
          <div class="h-8 w-full rounded-md bg-muted motion-safe:animate-pulse" />
          <div class="h-8 w-full rounded-md bg-muted motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
  </div>
</template>
