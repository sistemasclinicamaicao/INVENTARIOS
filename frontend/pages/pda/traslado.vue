<script setup lang="ts">
definePageMeta({ layout: 'pda' })

const { fetchApi } = useApi()
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
    message.value = `Traslado ${code.trim()} recibido en satélite`
  }
}
</script>

<template>
  <div class="space-y-4">
    <PdaBackLink />
    <h2 class="font-bold text-base">Recibir traslado (satélite)</h2>

    <PdaScanField placeholder="Escanear TRF-…" @scan="onReceive" />

    <p class="text-xs text-slate-400">Confirma ingreso a bodega periférica</p>

    <PdaStatusMessage :message="message" :error="error" />
  </div>
</template>
