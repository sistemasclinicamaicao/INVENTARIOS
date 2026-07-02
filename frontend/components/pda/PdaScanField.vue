<script setup lang="ts">
import { useScanner } from '~/composables/useScanner'

const props = defineProps<{
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  scan: [code: string]
}>()

const { scanInput, handleKeydown } = useScanner((code) => {
  if (!props.disabled) emit('scan', code)
})

const inputRef = ref<HTMLInputElement | null>(null)

onMounted(() => {
  nextTick(() => inputRef.value?.focus())
})

defineExpose({
  focus: () => inputRef.value?.focus(),
  clear: () => {
    scanInput.value = ''
  },
})
</script>

<template>
  <input
    ref="inputRef"
    v-model="scanInput"
    type="text"
    :placeholder="placeholder ?? 'Escanear código'"
    :disabled="disabled"
    autocomplete="off"
    autocorrect="off"
    class="w-full p-3 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 disabled:opacity-50"
    @keydown="handleKeydown"
  />
</template>
