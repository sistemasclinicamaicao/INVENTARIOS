<script setup lang="ts">
definePageMeta({ layout: 'pda' })

const { fetchApi } = useApi()

const warehouses = ref<{ id: string; name: string; code: string }[]>([])
const warehouseId = ref('')
const productLabel = ref('')
const productId = ref('')
const countedQty = ref(1)
const message = ref('')
const error = ref('')

onMounted(async () => {
  const { data } = await fetchApi<{ id: string; name: string; code: string }[]>(
    '/inventory/warehouses',
  )
  if (data) warehouses.value = data
})

const selectedWarehouse = computed(() =>
  warehouses.value.find((w) => w.id === warehouseId.value),
)

async function onScan(code: string) {
  error.value = ''
  message.value = ''
  const wh = selectedWarehouse.value?.code
    ? `?warehouse=${encodeURIComponent(selectedWarehouse.value.code)}`
    : ''
  const { data, error: err } = await fetchApi<{
    product: { id: string; code: string; name: string } | null
    balances: { qty: number }[]
  }>(`/inventory/resolve-scan/${encodeURIComponent(code.trim())}${wh}`)
  if (err || !data?.product) {
    error.value = err ?? `Producto no encontrado: ${code}`
    productId.value = ''
    productLabel.value = ''
    return
  }
  productId.value = data.product.id
  productLabel.value = `${data.product.code} — ${data.product.name}`
  const current = data.balances.reduce((s, b) => s + b.qty, 0)
  if (current > 0) countedQty.value = current
}

async function submit() {
  error.value = ''
  message.value = ''
  if (!productId.value || !warehouseId.value) {
    error.value = 'Bodega y producto requeridos'
    return
  }
  const { data, error: err } = await fetchApi<{
    adjusted: boolean
    newQty: number
  }>('/inventory/cycle-count', {
    method: 'POST',
    body: {
      warehouseId: warehouseId.value,
      productId: productId.value,
      countedQty: countedQty.value,
    },
  })
  if (err) error.value = err
  else if (data) {
    message.value = data.adjusted
      ? `Ajustado a ${data.newQty}`
      : `Sin cambio (${data.newQty})`
    productId.value = ''
    productLabel.value = ''
  }
}
</script>

<template>
  <div class="space-y-4">
    <PdaBackLink />
    <h2 class="font-bold text-base">Conteo cíclico</h2>

    <select
      v-model="warehouseId"
      class="w-full p-3 rounded-lg bg-slate-800 border border-slate-600 text-sm"
    >
      <option value="">Bodega</option>
      <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
    </select>

    <PdaScanField placeholder="Escanear producto" @scan="onScan" />

    <p v-if="productLabel" class="text-sm text-slate-300">{{ productLabel }}</p>

    <input
      v-model.number="countedQty"
      type="number"
      min="0"
      class="w-full p-3 rounded-lg bg-slate-800 border border-slate-600"
      placeholder="Cantidad contada"
    />

    <button
      type="button"
      class="w-full py-3 bg-blue-600 rounded-lg font-medium"
      @click="submit"
    >
      Registrar conteo
    </button>

    <PdaStatusMessage :message="message" :error="error" />
  </div>
</template>
