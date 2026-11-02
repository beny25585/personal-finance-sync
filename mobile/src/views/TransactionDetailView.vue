<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { X } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import TransactionsView from './TransactionsView.vue'

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()
const sheet = ref<HTMLDialogElement | null>(null)
let previousOverflow = ''

function closeDetails(): void {
  void router.replace('/transactions')
}

function onBackdropClick(event: MouseEvent): void {
  if (event.target !== sheet.value || !sheet.value) return
  const rect = sheet.value.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right
    || event.clientY < rect.top || event.clientY > rect.bottom) closeDetails()
}

onMounted(() => {
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  sheet.value?.showModal()
})

onBeforeUnmount(() => {
  sheet.value?.close()
  document.body.style.overflow = previousOverflow
})
</script>

<template>
  <div class="transaction-details-page" data-testid="transaction-details-page">
    <TransactionsView inert-background />

    <dialog
      ref="sheet"
      class="transaction-detail-sheet"
      aria-labelledby="transaction-details-title"
      aria-describedby="transaction-details-description"
      @cancel.prevent="closeDetails"
      @click="onBackdropClick"
    >
      <header class="transaction-detail-header">
        <div class="page-heading">
          <h1 id="transaction-details-title" data-testid="page-heading">{{ t('detail.title') }}</h1>
          <p id="transaction-details-description" data-testid="transaction-details-empty">
            {{ t('detail.emptyTitle') }}
          </p>
        </div>
        <button
          data-testid="transaction-details-close"
          class="transaction-detail-close"
          type="button"
          autofocus
          :aria-label="t('detail.close')"
          @click="closeDetails"
        >
          <X :size="16" aria-hidden="true" />
        </button>
      </header>
    </dialog>
  </div>
</template>
