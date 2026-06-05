<script setup lang="ts">
import type { InventoryBalanceRow, InventoryWarehouseRow } from '~/types/inventory'
import { formatCop, formatDateLatAm, formatDateTimeLatAm, formatQty } from '~/utils/locale-format'

definePageMeta({ layout: 'app', hideGlobalSearch: true, pageTitle: 'Inventario Central' })

type MainTab = 'saldos' | 'movimientos'

interface MovementRow {
  type: string
  qty: number
  productName: string
  productCode?: string
  warehouseName: string
  lotNumber?: string | null
  createdAt: string
}

const { fetchApi } = useApi()

const loading = ref(true)
const error = ref<string | null>(null)
const warehouses = ref<InventoryWarehouseRow[]>([])
const balances = ref<InventoryBalanceRow[]>([])
const movements = ref<MovementRow[]>([])

const activeTab = ref<MainTab>('saldos')
const filterCode = ref('')
const search = ref('')
const movementSearch = ref('')

const detailOpen = ref(false)
const selectedRow = ref<InventoryBalanceRow | null>(null)

const movementTypeLabels: Record<string, string> = {
  RECEPTION: 'Recepción',
  PICKING: 'Despacho',
  TRANSFER: 'Traslado',
  ADJUSTMENT: 'Ajuste',
  CYCLE_COUNT: 'Conteo cíclico',
}

function openDetail(row: InventoryBalanceRow) {
  selectedRow.value = row
  detailOpen.value = true
}

function warehouseByCode(code: string) {
  return warehouses.value.find((w) => w.code === code)
}

async function loadBalances() {
  const whParam = filterCode.value ? `?warehouse=${encodeURIComponent(filterCode.value)}` : ''
  const balRes = await fetchApi<InventoryBalanceRow[]>(`/inventory/balances${whParam}`)
  if (balRes.error) error.value = balRes.error
  else if (balRes.data) {
    error.value = null
    balances.value = balRes.data
  }
}

async function loadWarehouses() {
  const whRes = await fetchApi<InventoryWarehouseRow[]>('/inventory/warehouses')
  if (whRes.data) warehouses.value = whRes.data
}

async function loadMovements() {
  const { data } = await fetchApi<MovementRow[]>('/inventory/movements?limit=50')
  if (data) movements.value = data
}

async function load() {
  loading.value = true
  error.value = null
  await Promise.all([loadWarehouses(), loadBalances(), loadMovements()])
  loading.value = false
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return balances.value
  return balances.value.filter(
    (b) =>
      b.productName.toLowerCase().includes(q)
      || b.productCode.toLowerCase().includes(q)
      || (b.lotNumber ?? '').toLowerCase().includes(q)
      || (b.locationCode ?? '').toLowerCase().includes(q)
      || b.warehouseCode.toLowerCase().includes(q),
  )
})

const filteredMovements = computed(() => {
  let list = movements.value
  if (filterCode.value) {
    const wh = warehouseByCode(filterCode.value)
    if (wh) list = list.filter((m) => m.warehouseName === wh.name)
  }
  const q = movementSearch.value.trim().toLowerCase()
  if (!q) return list
  return list.filter(
    (m) =>
      m.productName.toLowerCase().includes(q)
      || (m.productCode ?? '').toLowerCase().includes(q)
      || (m.lotNumber ?? '').toLowerCase().includes(q)
      || m.warehouseName.toLowerCase().includes(q)
      || (movementTypeLabels[m.type] ?? m.type).toLowerCase().includes(q),
  )
})

function movementLabel(type: string) {
  return movementTypeLabels[type] ?? type
}

watch(filterCode, () => loadBalances())

onMounted(load)
</script>

<template>
  <div class="space-y-3">
    <div>
      <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
        <UiIcon name="apps" :size="24" class="text-blue-600" />
        Inventario Central
      </h2>
      <p class="text-slate-500 text-xs mt-0.5">
        Saldos y movimientos por bodega. Pulse una fila de saldo para ver el detalle completo.
      </p>
    </div>

    <div v-if="loading" class="text-center py-12 text-slate-500 text-sm">Cargando inventario…</div>

    <template v-else>
      <p
        v-if="error"
        class="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
      >
        {{ error }}
      </p>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <nav class="flex gap-0.5 p-0.5 bg-slate-100 rounded-lg">
          <button
            type="button"
            class="px-3 py-1.5 rounded-md text-xs font-medium transition"
            :class="
              activeTab === 'saldos'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            "
            @click="activeTab = 'saldos'"
          >
            Saldos
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5"
            :class="
              activeTab === 'movimientos'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            "
            @click="activeTab = 'movimientos'"
          >
            Movimientos
            <span
              v-if="movements.length"
              class="text-[10px] px-1 py-0.5 rounded-full bg-blue-100 text-blue-800 tabular-nums"
            >
              {{ movements.length }}
            </span>
          </button>
        </nav>
      </div>

      <!-- Subpestañas bodega -->
      <div class="overflow-x-auto pb-0.5">
        <nav class="flex gap-1 min-w-max">
          <button
            type="button"
            class="px-2.5 py-1 rounded-md text-[11px] font-medium border transition whitespace-nowrap"
            :class="
              !filterCode
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            "
            @click="filterCode = ''"
          >
            Todas
          </button>
          <button
            v-for="w in warehouses"
            :key="w.code"
            type="button"
            class="px-2.5 py-1 rounded-md text-[11px] font-medium border transition whitespace-nowrap flex items-center gap-1"
            :class="
              filterCode === w.code
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            "
            :title="w.name"
            @click="filterCode = w.code"
          >
            {{ w.code }}
            <span
              class="text-[9px] px-1 py-0.5 rounded-full tabular-nums"
              :class="filterCode === w.code ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'"
            >
              {{ w.productCount }}
            </span>
          </button>
        </nav>
      </div>

      <!-- Tab Saldos -->
      <div
        v-show="activeTab === 'saldos'"
        class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
      >
        <div class="px-3 py-2 border-b border-slate-100 flex flex-wrap gap-2 items-center justify-between">
          <div class="relative flex-1 min-w-[160px] max-w-sm">
            <UiIcon name="search" :size="16" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              v-model="search"
              type="search"
              placeholder="Código, producto, lote, ubicación…"
              class="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span class="text-[11px] text-slate-500 tabular-nums">{{ filtered.length }} líneas</span>
        </div>

        <div v-if="!filtered.length" class="p-10 text-center text-slate-400 text-sm">
          No hay saldos
          <template v-if="filterCode"> en {{ filterCode }}</template>.
          Importe stock desde
          <NuxtLink to="/maestros/importar" class="text-blue-600 hover:underline">Maestros</NuxtLink>.
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead class="bg-slate-50 text-slate-500 uppercase sticky top-0">
              <tr>
                <th class="px-2 py-2 text-left font-medium">Código</th>
                <th class="px-2 py-2 text-left font-medium min-w-[140px]">Producto</th>
                <th v-if="!filterCode" class="px-2 py-2 text-left font-medium">Bodega</th>
                <th class="px-2 py-2 text-left font-medium">Ubicación</th>
                <th class="px-2 py-2 text-left font-medium">Lote</th>
                <th class="px-2 py-2 text-left font-medium">Vence</th>
                <th class="px-2 py-2 text-right font-medium">Cantidad</th>
                <th class="px-2 py-2 text-right font-medium">V. unit.</th>
                <th class="px-2 py-2 text-right font-medium">Valor</th>
                <th class="px-2 py-2 text-center font-medium">Estado</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="row in filtered"
                :key="row.balanceId"
                class="hover:bg-blue-50/60 cursor-pointer transition"
                title="Ver detalle completo"
                @click="openDetail(row)"
              >
                <td class="px-2 py-2 font-mono text-indigo-700 whitespace-nowrap">{{ row.productCode }}</td>
                <td class="px-2 py-2 max-w-[200px]">
                  <span class="block truncate font-medium text-slate-800" :title="row.productName">
                    {{ row.productName }}
                  </span>
                </td>
                <td v-if="!filterCode" class="px-2 py-2 whitespace-nowrap">
                  <span class="font-mono text-slate-600">{{ row.warehouseCode }}</span>
                </td>
                <td class="px-2 py-2 text-slate-600 whitespace-nowrap">{{ row.locationCode ?? '—' }}</td>
                <td class="px-2 py-2 font-mono whitespace-nowrap">{{ row.lotNumber ?? '—' }}</td>
                <td class="px-2 py-2 whitespace-nowrap tabular-nums">
                  {{ formatDateLatAm(row.expiresAt) }}
                </td>
                <td class="px-2 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                  {{ formatQty(row.qty) }} {{ row.unit }}
                </td>
                <td class="px-2 py-2 text-right tabular-nums whitespace-nowrap text-slate-600">
                  {{ formatCop(row.unitPrice) }}
                </td>
                <td class="px-2 py-2 text-right tabular-nums whitespace-nowrap font-medium text-slate-800">
                  {{ formatCop(row.lineValue) }}
                </td>
                <td class="px-2 py-2 text-center">
                  <span
                    v-if="row.lowStock"
                    class="inline-flex items-center gap-0.5 text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-full"
                  >
                    <UiIcon name="triangle-warning" :size="10" />
                    Bajo mín.
                  </span>
                  <span v-else class="text-[10px] text-green-700">OK</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tab Movimientos -->
      <div
        v-show="activeTab === 'movimientos'"
        class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
      >
        <div class="px-3 py-2 border-b border-slate-100 flex flex-wrap gap-2 items-center justify-between">
          <div class="relative flex-1 min-w-[160px] max-w-sm">
            <UiIcon name="search" :size="16" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              v-model="movementSearch"
              type="search"
              placeholder="Producto, bodega, tipo…"
              class="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span class="text-[11px] text-slate-500 tabular-nums">{{ filteredMovements.length }} movimientos</span>
        </div>

        <div v-if="!filteredMovements.length" class="p-10 text-center text-slate-400 text-sm">
          No hay movimientos registrados
          <template v-if="filterCode"> en {{ filterCode }}</template>.
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead class="bg-slate-50 text-slate-500 uppercase sticky top-0">
              <tr>
                <th class="px-2 py-2 text-left font-medium">Fecha</th>
                <th class="px-2 py-2 text-left font-medium">Tipo</th>
                <th class="px-2 py-2 text-left font-medium min-w-[140px]">Producto</th>
                <th v-if="!filterCode" class="px-2 py-2 text-left font-medium">Bodega</th>
                <th class="px-2 py-2 text-left font-medium">Lote</th>
                <th class="px-2 py-2 text-right font-medium">Cantidad</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="(m, i) in filteredMovements"
                :key="`${m.createdAt}-${m.productName}-${i}`"
                class="hover:bg-slate-50"
              >
                <td class="px-2 py-2 whitespace-nowrap tabular-nums text-slate-600">
                  {{ formatDateTimeLatAm(m.createdAt) }}
                </td>
                <td class="px-2 py-2 whitespace-nowrap">
                  <span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                    {{ movementLabel(m.type) }}
                  </span>
                </td>
                <td class="px-2 py-2 max-w-[220px]">
                  <span class="block truncate font-medium text-slate-800" :title="m.productName">
                    {{ m.productName }}
                  </span>
                  <span v-if="m.productCode" class="text-[10px] font-mono text-slate-400">{{ m.productCode }}</span>
                </td>
                <td v-if="!filterCode" class="px-2 py-2 text-slate-600 whitespace-nowrap truncate max-w-[120px]">
                  {{ m.warehouseName }}
                </td>
                <td class="px-2 py-2 font-mono whitespace-nowrap">{{ m.lotNumber ?? '—' }}</td>
                <td class="px-2 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                  {{ formatQty(m.qty) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <InventarioBalanceDetailModal v-model:open="detailOpen" :row="selectedRow" />
  </div>
</template>
