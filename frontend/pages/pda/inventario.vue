<script setup lang="ts">
definePageMeta({ layout: 'pda' })

const { fetchApi } = useApi()

interface WarehouseRow {
  id: string
  code: string
  name: string
}

interface ResolveProduct {
  id: string
  code: string
  name: string
  requiresLote: boolean
}

interface BalanceRow {
  warehouseCode: string
  warehouseName: string
  lotNumber: string | null
  expiresAt: string | null
  qty: number
}

const warehouses = ref<WarehouseRow[]>([])
const warehouseCode = ref('')
const product = ref<ResolveProduct | null>(null)
const balances = ref<BalanceRow[]>([])
const loading = ref(false)
const message = ref('')
const error = ref('')

onMounted(async () => {
  const { data } = await fetchApi<WarehouseRow[]>('/inventory/warehouses')
  if (data) warehouses.value = data
})

async function onScan(code: string) {
  loading.value = true
  error.value = ''
  message.value = ''
  const wh = warehouseCode.value ? `?warehouse=${encodeURIComponent(warehouseCode.value)}` : ''
  const { data, error: err } = await fetchApi<{
    product: ResolveProduct | null
    balances: BalanceRow[]
  }>(`/inventory/resolve-scan/${encodeURIComponent(code.trim())}${wh}`)
  loading.value = false
  if (err) {
    error.value = err
    product.value = null
    balances.value = []
    return
  }
  if (!data?.product) {
    error.value = `Producto no encontrado: ${code}`
    product.value = null
    balances.value = []
    return
  }
  product.value = data.product
  balances.value = data.balances
  const total = data.balances.reduce((s, b) => s + b.qty, 0)
  message.value = `${data.product.code} — stock total: ${total}`
}
</script>

<template>
  <div class="space-y-4">
    <PdaBackLink />
    <h2 class="font-bold text-base">Consulta inventario</h2>

    <select
      v-model="warehouseCode"
      class="w-full p-3 rounded-lg bg-slate-800 border border-slate-600 text-sm"
    >
      <option value="">Todas las bodegas</option>
      <option v-for="w in warehouses" :key="w.id" :value="w.code">
        {{ w.name }}
      </option>
    </select>

    <PdaScanField placeholder="Escanear producto" :disabled="loading" @scan="onScan" />

    <PdaStatusMessage :message="message" :error="error" />

    <div v-if="product" class="border border-slate-700 rounded-lg p-3 text-sm">
      <p class="font-mono text-blue-300">{{ product.code }}</p>
      <p class="text-slate-300">{{ product.name }}</p>
    </div>

    <ul v-if="balances.length" class="space-y-2 text-sm max-h-[45vh] overflow-y-auto">
      <li
        v-for="(b, i) in balances"
        :key="i"
        class="p-2 border border-slate-700 rounded-lg"
      >
        <p class="text-slate-300">{{ b.warehouseName }}</p>
        <p class="text-xs text-slate-500">
          Lote {{ b.lotNumber ?? '—' }}
          <span v-if="b.expiresAt"> · Vence {{ b.expiresAt }}</span>
        </p>
        <p class="font-medium text-emerald-400 mt-1">Cant: {{ b.qty }}</p>
      </li>
    </ul>
    <p v-else-if="product" class="text-sm text-slate-500">Sin saldo en la bodega seleccionada</p>
  </div>
</template>
