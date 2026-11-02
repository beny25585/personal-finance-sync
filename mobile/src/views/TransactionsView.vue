<script setup lang="ts">
import { ref } from 'vue'
import { ArrowLeftRight, Search, SlidersHorizontal, X } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '../components/EmptyState.vue'

const { t } = useI18n({ useScope: 'global' })
const search = ref('')
const status = ref('all')
const filtersOpen = ref(false)

function clearFilters(): void {
  search.value = ''
  status.value = 'all'
}
</script>

<template>
  <section class="view-stack" data-testid="transactions-page">
    <header class="page-heading">
      <h1 data-testid="page-heading">{{ t('transactions.title') }}</h1>
      <p>{{ t('transactions.subtitle') }}</p>
    </header>

    <section class="panel" :aria-label="t('transactions.title')">
      <div class="panel-body">
        <div class="transactions-toolbar">
          <div class="field transaction-search-field">
            <label class="sr-only" for="transaction-search">
              {{ t('transactions.searchLabel') }}
            </label>
            <div class="input-shell">
              <Search :size="18" aria-hidden="true" />
              <input
                id="transaction-search"
                v-model="search"
                type="search"
                autocomplete="off"
                :placeholder="t('transactions.searchPlaceholder')"
              />
            </div>
          </div>

          <div class="transactions-actions">
            <button
              id="toggle-filters"
              class="button button-secondary"
              type="button"
              :aria-expanded="filtersOpen"
              aria-controls="transaction-filters"
              @click="filtersOpen = !filtersOpen"
            >
              <SlidersHorizontal :size="18" aria-hidden="true" />
              <span>{{ t('transactions.filters') }}</span>
            </button>
            <button
              id="clear-filters"
              class="button button-secondary"
              type="button"
              :disabled="!search && status === 'all'"
              @click="clearFilters"
            >
              <X :size="18" aria-hidden="true" />
              <span>{{ t('transactions.clearFilters') }}</span>
            </button>
          </div>
        </div>

        <div v-show="filtersOpen" id="transaction-filters" class="filters-panel">
          <div class="field">
            <label class="field-label" for="transaction-status">
              {{ t('transactions.status') }}
            </label>
            <select id="transaction-status" v-model="status">
              <option value="all">{{ t('transactions.all') }}</option>
              <option value="pending">{{ t('transactions.pending') }}</option>
              <option value="completed">{{ t('transactions.completed') }}</option>
            </select>
          </div>
        </div>

        <EmptyState
          data-testid="transactions-empty"
          :icon="ArrowLeftRight"
          :title="t('transactions.emptyTitle')"
          :description="t('transactions.emptyDescription')"
        />
      </div>
    </section>
  </section>
</template>

<style scoped>
.transactions-toolbar,
.transactions-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.transactions-toolbar {
  flex-wrap: wrap;
}

.transaction-search-field {
  flex: 1 1 16rem;
  min-width: 0;
}

.transactions-actions {
  flex-wrap: wrap;
}
</style>
