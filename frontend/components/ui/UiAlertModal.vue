<script setup lang="ts">
export type AlertVariant = 'error' | 'success' | 'warning' | 'info'

const open = defineModel<boolean>('open', { default: false })

withDefaults(
  defineProps<{
    title?: string
    message?: string
    variant?: AlertVariant
    confirmLabel?: string
  }>(),
  {
    title: 'Atención',
    message: '',
    variant: 'error',
    confirmLabel: 'Entendido',
  },
)

const headerClasses: Record<AlertVariant, string> = {
  error: 'bg-red-50 border-red-100',
  success: 'bg-green-50 border-green-100',
  warning: 'bg-amber-50 border-amber-100',
  info: 'bg-blue-50 border-blue-100',
}

const iconWrapClasses: Record<AlertVariant, string> = {
  error: 'bg-red-100 text-red-600',
  success: 'bg-green-100 text-green-600',
  warning: 'bg-amber-100 text-amber-600',
  info: 'bg-blue-100 text-blue-600',
}

const titleClasses: Record<AlertVariant, string> = {
  error: 'text-red-900',
  success: 'text-green-900',
  warning: 'text-amber-900',
  info: 'text-blue-900',
}

const messageClasses: Record<AlertVariant, string> = {
  error: 'text-red-800',
  success: 'text-green-800',
  warning: 'text-amber-800',
  info: 'text-blue-800',
}

const buttonClasses: Record<AlertVariant, string> = {
  error: 'bg-red-600 hover:bg-red-700',
  success: 'bg-green-600 hover:bg-green-700',
  warning: 'bg-amber-600 hover:bg-amber-700',
  info: 'bg-blue-600 hover:bg-blue-700',
}

const iconNames: Record<AlertVariant, string> = {
  error: 'triangle-warning',
  success: 'check-circle',
  warning: 'triangle-warning',
  info: 'bell',
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      @click.self="open = false"
    >
      <div
        class="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ui-alert-title"
      >
        <div class="px-5 py-4 border-b flex gap-3 items-start" :class="headerClasses[variant]">
          <div class="p-2 rounded-lg shrink-0" :class="iconWrapClasses[variant]">
            <UiIcon :name="iconNames[variant]" :size="22" />
          </div>
          <div class="min-w-0">
            <h3 id="ui-alert-title" class="font-bold text-lg" :class="titleClasses[variant]">
              {{ title }}
            </h3>
            <p class="text-sm mt-1 whitespace-pre-wrap" :class="messageClasses[variant]">
              {{ message }}
            </p>
          </div>
        </div>
        <div class="px-5 py-4 flex justify-end">
          <button
            type="button"
            class="px-4 py-2 text-white rounded-lg text-sm font-medium transition"
            :class="buttonClasses[variant]"
            @click="open = false"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
