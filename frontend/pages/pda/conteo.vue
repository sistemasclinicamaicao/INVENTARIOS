<script setup lang="ts">
import { useScanner } from '~/composables/useScanner'

definePageMeta({ layout: 'pda' })

const { fetchApi } = useApi()
const warehouses = ref<{ id: string; name: string }[]>([])
const warehouseId = ref('')
const productCode = ref('')
const countedQty = ref(1)
const message = ref('')
const error = ref('')

const { scanInput, handleKeydown } = useScanner((code) => {
  productCode.value = code
})

onMounted(async () => {
  const { data } = await fetchApi<{ id: string; name: string }[]>('/receptions/warehouses')
  if (data) warehouses.value = data
})

async function submit() {
  error.value = ''
  message.value = ''
  const { data: products } = await fetchApi<{ id: string; code: string }[]>('/masters/products')
  const p = products?.find((x) => x.code === productCode.value.trim())
  if (!p || !warehouseId.value) {
    error.value = 'Bodega y código de producto requeridos'
    return
  }
  const { data, error: err } = await fetchApi<{ adjusted: boolean; newQty: number }>(
    '/inventory/cycle-count',
    {
      method: 'POST',
      body: {
        warehouseId: warehouseId.value,
        productId: p.id,
        countedQty: countedQty.value,
      },
    },
  )
  if (err) error.value = err
  else if (data) {
    message.value = data.adjusted
      ? `Ajustado a ${data.newQty}`
      : `Sin cambio (${data.newQty})`
    productCode.value = ''
    scanInput.value = ''
  }
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="font-bold">Conteo cíclico</h2>
    <select v-model="warehouseId" class="w-full p-3 rounded bg-slate-800 border border-slate-600 text-sm">
      <option value="">Bodega</option>
      <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
    </select>
    <input
      v-model="scanInput"
      type="text"
      placeholder="Escanear producto"
      class="w-full p-3 rounded bg-slate-800 border border-slate-600"
      @keydown="handleKeydown"
    />
    <input
      v-model.number="countedQty"
      type="number"
      min="0"
      class="w-full p-3 rounded bg-slate-800 border border-slate-600"
      placeholder="Cantidad contada"
    />
    <button
      type="button"
      class="w-full py-3 bg-blue-600 rounded-lg font-medium"
      @click="submit"
    >
      Registrar conteo
    </button>
    <p v-if="message" class="text-green-400 text-sm">{{ message }}</p>
    <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
  </div>
</template>
