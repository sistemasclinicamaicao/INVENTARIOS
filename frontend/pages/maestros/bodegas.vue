<script setup lang="ts">
definePageMeta({ layout: 'app' })

const { fetchApi } = useApi()

type Warehouse = {
  id: string
  code: string
  name: string
  type: string
  policy: string
}

type InventoryLine = {
  productId: string
  productCode: string
  productName: string
  unit: string
  minStock: number
  locationCode: string | null
  lotNumber: string | null
  expiresAt: string | null
  qty: number
  lowStock: boolean
}

const warehouses = ref<Warehouse[]>([])
const selected = ref<Warehouse | null>(null)
const rightTab = ref<'locations' | 'inventory'>('inventory')
const locations = ref<{ id: string; code: string }[]>([])
const inventory = ref<{
  summary: { lineCount: number; productCount: number; totalQty: number }
  lines: InventoryLine[]
} | null>(null)
const invSearch = ref('')
const loading = ref(true)
const loadingDetail = ref(false)

async function load() {
  loading.value = true
  const { data } = await fetchApi<Warehouse[]>('/masters/warehouses')
  if (data) warehouses.value = data
  loading.value = false
}

async function selectWarehouse(w: Warehouse) {
  selected.value = w
  loadingDetail.value = true
  inventory.value = null
  locations.value = []

  const [locRes, invRes] = await Promise.all([
    fetchApi<{ id: string; code: string }[]>(`/masters/warehouses/${w.id}/locations`),
    fetchApi<{
      warehouse: Warehouse
      summary: { lineCount: number; productCount: number; totalQty: number }
      lines: InventoryLine[]
    }>(`/masters/warehouses/${w.id}/inventory`),
  ])

  if (locRes.data) locations.value = locRes.data
  if (invRes.data) {
    inventory.value = {
      summary: invRes.data.summary,
      lines: invRes.data.lines,
    }
  }
  loadingDetail.value = false
}

const filteredInventory = computed(() => {
  const q = invSearch.value.trim().toLowerCase()
  const lines = inventory.value?.lines ?? []
  if (!q) return lines
  return lines.filter(
    (l) =>
      l.productCode.toLowerCase().includes(q)
      || l.productName.toLowerCase().includes(q)
      || (l.lotNumber ?? '').toLowerCase().includes(q),
  )
})

onMounted(() => load())
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <UiIcon name="marker" :size="28" class="text-teal-600" />
        Bodegas y ubicaciones
      </h2>
      <p class="text-slate-500 text-sm">
        Maestro de bodegas, ubicaciones e inventario por bodega (tabla
        <code class="text-xs bg-slate-100 px-1 rounded">inventory_balances</code>).
      </p>
    </div>

    <div v-if="loading" class="text-slate-500">Cargando...</div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div class="lg:col-span-4 bg-white rounded-xl border border-slate-100 divide-y max-h-[70vh] overflow-y-auto">
        <button
          v-for="w in warehouses"
          :key="w.id"
          type="button"
          class="w-full text-left p-4 hover:bg-slate-50"
          :class="selected?.id === w.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''"
          @click="selectWarehouse(w)"
        >
          <div class="font-medium text-slate-800">{{ w.name }}</div>
          <div class="text-xs text-slate-400">{{ w.code }} · {{ w.type }} · {{ w.policy }}</div>
        </button>
      </div>

      <div class="lg:col-span-8 bg-white rounded-xl border border-slate-100 min-h-[320px]">
        <template v-if="!selected">
          <p class="p-8 text-center text-slate-400">Seleccione una bodega</p>
        </template>

        <template v-else>
          <div class="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 class="font-semibold text-slate-800">{{ selected.name }}</h3>
              <p class="text-xs text-slate-500">{{ selected.code }} · {{ selected.policy }}</p>
            </div>
            <div class="flex gap-1 bg-slate-100 p-1 rounded-lg text-sm">
              <button
                type="button"
                class="px-3 py-1 rounded-md"
                :class="rightTab === 'inventory' ? 'bg-white shadow text-slate-800' : 'text-slate-600'"
                @click="rightTab = 'inventory'"
              >
                Inventario
              </button>
              <button
                type="button"
                class="px-3 py-1 rounded-md"
                :class="rightTab === 'locations' ? 'bg-white shadow text-slate-800' : 'text-slate-600'"
                @click="rightTab = 'locations'"
              >
                Ubicaciones
              </button>
            </div>
          </div>

          <div v-if="loadingDetail" class="p-8 text-center text-slate-500">Cargando detalle…</div>

          <template v-else-if="rightTab === 'locations'">
            <ul v-if="locations.length" class="p-4 space-y-1 text-sm max-h-[50vh] overflow-y-auto">
              <li v-for="loc in locations" :key="loc.id" class="font-mono text-slate-600 py-1">
                {{ loc.code }}
              </li>
            </ul>
            <p v-else class="p-8 text-slate-400 text-sm text-center">Sin ubicaciones registradas</p>
          </template>

          <template v-else>
            <div
              v-if="inventory"
              class="px-4 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-4 text-sm"
            >
              <span><strong>{{ inventory.summary.productCount }}</strong> productos</span>
              <span><strong>{{ inventory.summary.lineCount }}</strong> líneas (lote/ubicación)</span>
              <span><strong>{{ inventory.summary.totalQty.toLocaleString() }}</strong> unidades</span>
            </div>

            <div class="p-4 border-b border-slate-100">
              <input
                v-model="invSearch"
                type="search"
                placeholder="Buscar código, producto o lote..."
                class="w-full p-2 border rounded-lg text-sm"
              />
            </div>

            <div v-if="!filteredInventory.length" class="p-8 text-center text-slate-400 text-sm space-y-2">
              <p>No hay saldos en esta bodega.</p>
              <p>
                Registre productos en
                <NuxtLink to="/maestros/productos" class="text-blue-600 hover:underline">Maestros → Productos</NuxtLink>
                o impórtelos desde
                <NuxtLink to="/compras/ordenes" class="text-blue-600 hover:underline">OC / ERP</NuxtLink>
                y recepcione mercancía.
              </p>
            </div>

            <div v-else class="overflow-x-auto max-h-[50vh]">
              <table class="w-full text-sm">
                <thead class="bg-slate-50 text-slate-600 text-left sticky top-0">
                  <tr>
                    <th class="px-3 py-2 font-medium">Código</th>
                    <th class="px-3 py-2 font-medium">Producto</th>
                    <th class="px-3 py-2 font-medium">Ubicación</th>
                    <th class="px-3 py-2 font-medium">Lote</th>
                    <th class="px-3 py-2 font-medium">Vence</th>
                    <th class="px-3 py-2 font-medium text-right">Cantidad</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr
                    v-for="(row, i) in filteredInventory"
                    :key="`${row.productId}-${row.lotNumber}-${i}`"
                    class="hover:bg-slate-50"
                  >
                    <td class="px-3 py-2 font-mono text-xs">{{ row.productCode }}</td>
                    <td class="px-3 py-2">
                      <span class="text-slate-800">{{ row.productName }}</span>
                      <span
                        v-if="row.lowStock"
                        class="block text-[10px] text-amber-700"
                      >Bajo mínimo</span>
                    </td>
                    <td class="px-3 py-2 text-slate-500">{{ row.locationCode ?? '—' }}</td>
                    <td class="px-3 py-2">{{ row.lotNumber ?? '—' }}</td>
                    <td class="px-3 py-2">{{ row.expiresAt ?? '—' }}</td>
                    <td class="px-3 py-2 text-right font-medium tabular-nums">
                      {{ row.qty.toLocaleString() }} {{ row.unit }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p class="p-3 text-xs text-slate-400 border-t">
              Vista consolidada:
              <NuxtLink to="/inventario" class="text-blue-600 hover:underline">Inventario central</NuxtLink>
            </p>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>
