<script setup lang="ts">
import { useScanner } from '~/composables/useScanner'

definePageMeta({ layout: 'pda' })

const { fetchApi } = useApi()
const { scanInput, handleKeydown } = useScanner(onReceive)
const message = ref('')
const error = ref('')

async function onReceive(code: string) {
  error.value = ''
  message.value = ''
  const { data, error: err } = await fetchApi<{ success: boolean }>(
    `/picking/transfers/${encodeURIComponent(code.trim())}/receive`,
    { method: 'POST' },
  )
  if (err) error.value = err
  else if (data?.success) {
    message.value = `Traslado ${code} recibido en satélite`
    scanInput.value = ''
  }
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="font-bold">Recibir traslado (satélite)</h2>
    <input
      v-model="scanInput"
      type="text"
      placeholder="Escanear TRF-..."
      class="w-full p-3 rounded bg-slate-800 border border-slate-600"
      @keydown="handleKeydown"
    />
    <p class="text-xs text-slate-400">Confirma ingreso a bodega periférica</p>
    <p v-if="message" class="text-green-400 text-sm">{{ message }}</p>
    <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
  </div>
</template>
