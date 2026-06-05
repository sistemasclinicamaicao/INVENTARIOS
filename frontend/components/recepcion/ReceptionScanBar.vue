<script setup lang="ts">

import { useScanner } from '~/composables/useScanner'



const { disabled } = defineProps<{ disabled?: boolean }>()



const emit = defineEmits<{

  scan: [code: string]

}>()



const { scanInput, handleKeydown } = useScanner((code) => emit('scan', code))



const inputRef = ref<HTMLInputElement | null>(null)



onMounted(() => {

  inputRef.value?.focus()

})

</script>



<template>

  <div class="relative">

    <UiIcon

      name="barcode"

      :size="20"

      class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"

    />

    <input

      ref="inputRef"

      v-model="scanInput"

      type="text"

      placeholder="Escanear Código..."

      class="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 w-64 disabled:opacity-50"

      :disabled="disabled"

      @keydown="handleKeydown"

    />

  </div>

</template>

