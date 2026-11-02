<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown, ChevronUp, Receipt, Search, SlidersHorizontal, X } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '../components/EmptyState.vue'

withDefaults(defineProps<{ inertBackground?: boolean }>(), { inertBackground: false })

const { t } = useI18n({ useScope: 'global' })
const search = ref('')
const fromDate = ref('')
const toDate = ref('')
const status = ref('all')
const minAmount = ref<string | number>('')
const maxAmount = ref<string | number>('')
const filtersOpen = ref(false)

type FilterKey = 'from' | 'to' | 'status' | 'minAmount' | 'maxAmount' | 'search'
interface ActiveFilter {
  key: FilterKey
  label: string
  value: string
}

const activeFilters = computed<ActiveFilter[]>(() => {
  const filters: ActiveFilter[] = []

  if (fromDate.value) {
    filters.push({ key: 'from', label: t('transactions.from'), value: fromDate.value })
  }
  if (toDate.value) {
    filters.push({ key: 'to', label: t('transactions.to'), value: toDate.value })
  }
  if (status.value !== 'all') {
    filters.push({
      key: 'status',
      label: t('transactions.status'),
      value: t('transactions.' + status.value),
    })
  }
  if (minAmount.value !== '') {
    filters.push({ key: 'minAmount', label: t('transactions.min'), value: String(minAmount.value) })
  }
  if (maxAmount.value !== '') {
    filters.push({ key: 'maxAmount', label: t('transactions.max'), value: String(maxAmount.value) })
  }
  if (search.value) {
    filters.push({ key: 'search', label: t('transactions.searchLabel'), value: search.value })
  }

  return filters
})

function removeFilter(key: FilterKey): void {
  switch (key) {
    case 'from': fromDate.value = ''; break
    case 'to': toDate.value = ''; break
    case 'status': status.value = 'all'; break
    case 'minAmount': minAmount.value = ''; break
    case 'maxAmount': maxAmount.value = ''; break
    case 'search': search.value = ''; break
  }
}

function clearFilters(): void {
  search.value = ''
  fromDate.value = ''
  toDate.value = ''
  status.value = 'all'
  minAmount.value = ''
  maxAmount.value = ''
}
</script>

<template>
  <section
    class="view-stack transactions-page"
    data-testid="transactions-page"
    :inert="inertBackground"
    :aria-hidden="inertBackground ? 'true' : undefined"
  >
    <header class="page-heading">
      <h1 :data-testid="inertBackground ? undefined : 'page-heading'">
        {{ t('transactions.title') }}
      </h1>
    </header>

    <div class="transaction-filter-panel">
      <div v-if="activeFilters.length" class="filter-chips">
        <span v-for="filter in activeFilters" :key="filter.key" class="filter-chip">
          <span class="muted">{{ filter.label }}:</span>
          <span>{{ filter.value }}</span>
          <button
            class="filter-chip-remove"
            type="button"
            :aria-label="t('transactions.removeFilter', { label: filter.label })"
            @click="removeFilter(filter.key)"
          >
            <X :size="12" aria-hidden="true" />
          </button>
        </span>
        <button
          id="clear-filters"
          class="button button-ghost"
          type="button"
          @click="clearFilters"
        >
          {{ t('transactions.clearFilters') }}
        </button>
      </div>

      <div class="transactions-toolbar">
        <div class="field transaction-search-field">
          <label class="sr-only" for="transaction-search">{{ t('transactions.searchLabel') }}</label>
          <div class="input-shell">
            <Search :size="16" aria-hidden="true" />
            <input
              id="transaction-search"
              v-model="search"
              type="text"
              autocomplete="off"
              :placeholder="t('transactions.searchPlaceholder')"
            />
          </div>
        </div>
        <button
          id="toggle-filters"
          class="button button-secondary"
          :class="{ 'has-active-filters': activeFilters.length > 0 }"
          type="button"
          :aria-expanded="filtersOpen"
          aria-controls="transaction-filters"
          @click="filtersOpen = !filtersOpen"
        >
          <SlidersHorizontal :size="16" aria-hidden="true" />
          <span>{{ t('transactions.filters') }}</span>
          <component :is="filtersOpen ? ChevronUp : ChevronDown" :size="14" aria-hidden="true" />
        </button>
      </div>

      <div v-show="filtersOpen" id="transaction-filters" class="filters-panel">
        <div class="field">
          <label class="field-label" for="filter-from">{{ t('transactions.from') }}</label>
          <input id="filter-from" v-model="fromDate" type="date" />
        </div>
        <div class="field">
          <label class="field-label" for="filter-to">{{ t('transactions.to') }}</label>
          <input id="filter-to" v-model="toDate" type="date" />
        </div>
        <div class="field">
          <label class="field-label" for="filter-provider">{{ t('transactions.provider') }}</label>
          <select id="filter-provider" disabled>
            <option>{{ t('transactions.allProviders') }}</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label" for="filter-category">{{ t('transactions.category') }}</label>
          <select id="filter-category" disabled>
            <option>{{ t('transactions.allCategories') }}</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label" for="transaction-status">{{ t('transactions.status') }}</label>
          <select id="transaction-status" v-model="status">
            <option value="all">{{ t('transactions.all') }}</option>
            <option value="completed">{{ t('transactions.completed') }}</option>
            <option value="pending">{{ t('transactions.pending') }}</option>
          </select>
        </div>
        <div class="field">
          <span id="filter-amount-label" class="field-label">{{ t('transactions.amountRange') }}</span>
          <div class="filter-amount-range" role="group" aria-labelledby="filter-amount-label">
            <label class="sr-only" for="filter-min">{{ t('transactions.min') }}</label>
            <input
              id="filter-min"
              v-model="minAmount"
              type="number"
              :placeholder="t('transactions.min')"
            />
            <span class="muted" aria-hidden="true">-</span>
            <label class="sr-only" for="filter-max">{{ t('transactions.max') }}</label>
            <input
              id="filter-max"
              v-model="maxAmount"
              type="number"
              :placeholder="t('transactions.max')"
            />
          </div>
        </div>
      </div>
    </div>

    <EmptyState
      data-testid="transactions-empty"
      :icon="Receipt"
      :title="t('transactions.emptyTitle')"
      :description="t('transactions.emptyDescription')"
    />
  </section>
</template>
