<script setup lang="ts">
import type { PurchaseOrderSummary } from '~/types/purchases'

const props = defineProps<{
  orders: PurchaseOrderSummary[]
  loading?: boolean
  /** Si true, Consultar añade la OC a la lista de consulta múltiple */
  accumulate?: boolean
}>()

const emit = defineEmits<{
  consult: [order: PurchaseOrderSummary]
}>()

const filter = ref('')

const poStatusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  APPROVED: 'Aprobada',
  PARTIAL: 'Recepción parcial',
  RECEIVED: 'Recibida',
  CANCELLED: 'Anulada',
}

const filteredOrders = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return props.orders
  return props.orders.filter((o) => {
    const hay = [
      o.number,
      o.supplierName,
      o.warehouseName,
      o.warehouseCode,
      poStatusLabels[o.status] ?? o.status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
})

function receptionLink(num: string) {
  return { path: '/recepcion', query: { oc: num, from: 'ordenes' } }
}
</script>

<template>
  <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
    <div class="px-3 py-2 border-b border-slate-100 flex flex-wrap items-center gap-2">
      <span class="text-xs font-medium text-slate-700 shrink-0">OC abiertas</span>
      <div
        class="flex items-center flex-1 min-w-[140px] max-w-xs gap-1.5 px-2 py-1 border border-slate-200 rounded bg-slate-50/80 focus-within:bg-white focus-within:border-indigo-300 transition"
      >
        <UiIcon name="search" :size="14" class="text-slate-400 shrink-0" />
        <input
          v-model="filter"
          type="text"
          placeholder="OC, proveedor, bodega…"
          class="flex-1 min-w-0 bg-transparent border-none outline-none text-xs text-slate-800 placeholder:text-slate-400"
        />
        <button
          v-if="filter"
          type="button"
          class="text-slate-400 hover:text-slate-600 text-xs leading-none"
          title="Limpiar"
          @click="filter = ''"
        >
          ×
        </button>
      </div>
      <span v-if="!loading && orders.length" class="text-[10px] text-slate-500 tabular-nums shrink-0">
        <template v-if="filter.trim()">
          {{ filteredOrders.length }} / {{ orders.length }}
        </template>
        <template v-else>
          {{ orders.length }}
        </template>
      </span>
    </div>

    <div v-if="loading" class="py-6 text-center text-xs text-slate-500">Cargando…</div>

    <div v-else-if="filteredOrders.length" class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs text-slate-500 uppercase">
          <tr>
            <th class="px-3 py-2 text-left font-medium">OC</th>
            <th class="px-3 py-2 text-left font-medium">Proveedor</th>
            <th class="px-3 py-2 text-left font-medium">Bodega</th>
            <th class="px-3 py-2 text-left font-medium">Estado</th>
            <th class="px-3 py-2 text-left font-medium">Líneas</th>
            <th class="px-3 py-2" />
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr
            v-for="o in filteredOrders"
            :key="o.id"
            class="hover:bg-slate-50 cursor-pointer"
            @click="emit('consult', o)"
          >
            <td class="px-3 py-2 font-mono text-xs font-medium text-indigo-700">{{ o.number }}</td>
            <td class="px-3 py-2 text-slate-800">{{ o.supplierName }}</td>
            <td class="px-3 py-2 text-slate-700">{{ o.warehouseName }}</td>
            <td class="px-3 py-2">
              <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {{ poStatusLabels[o.status] ?? o.status }}
              </span>
            </td>
            <td class="px-3 py-2 tabular-nums">{{ o.lineCount }}</td>
            <td class="px-3 py-2 text-right whitespace-nowrap">
              <button
                type="button"
                class="text-blue-600 hover:underline text-xs mr-2"
                @click.stop="emit('consult', o)"
              >
                Consultar
              </button>
              <NuxtLink
                :to="receptionLink(o.number)"
                class="text-green-600 hover:underline text-xs font-medium"
                @click.stop
              >
                Recibir →
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-else-if="orders.length" class="py-6 text-center text-xs text-slate-500">
      Ninguna OC coincide con «{{ filter.trim() }}».
    </p>
    <p v-else class="py-6 text-center text-xs text-slate-400">No hay órdenes abiertas.</p>
  </div>
</template>
