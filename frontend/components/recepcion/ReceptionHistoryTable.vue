<script setup lang="ts">
import type { ReceptionHistoryDetail, ReceptionHistoryLine, ReceptionHistoryRow } from '~/types/reception-history'
import { formatDateLatAm, formatDateTimeLatAm, formatInteger, formatQty } from '~/utils/locale-format'

const props = defineProps<{
  rows: ReceptionHistoryRow[]
  loading?: boolean
  page: number
  total: number
  totalPages: number
}>()

const emit = defineEmits<{
  'page-change': [page: number]
  print: [detail: ReceptionHistoryDetail]
}>()

const { fetchApi } = useApi()

const expandedId = ref<string | null>(null)
const detailLoading = ref(false)
const detailCache = ref<Record<string, ReceptionHistoryDetail>>({})
const detailError = ref('')

const totalPagesSafe = computed(() => Math.max(1, props.totalPages))

async function toggleExpand(row: ReceptionHistoryRow) {
  if (expandedId.value === row.id) {
    expandedId.value = null
    return
  }
  expandedId.value = row.id
  detailError.value = ''
  if (detailCache.value[row.id]) return

  detailLoading.value = true
  const { data, error } = await fetchApi<ReceptionHistoryDetail>(
    `/receptions/history/${row.id}`,
  )
  detailLoading.value = false
  if (error || !data) {
    detailError.value = error ?? 'No se pudo cargar el detalle'
    return
  }
  detailCache.value[row.id] = data
}

async function onPrint(row: ReceptionHistoryRow) {
  let detail = detailCache.value[row.id]
  if (!detail) {
    detailLoading.value = true
    const { data, error } = await fetchApi<ReceptionHistoryDetail>(
      `/receptions/history/${row.id}`,
    )
    detailLoading.value = false
    if (error || !data) {
      detailError.value = error ?? 'No se pudo cargar el detalle para imprimir'
      return
    }
    detailCache.value[row.id] = data
    detail = data
  }
  emit('print', detail)
}

function lineLot(line: ReceptionHistoryLine) {
  if (!line.lotNumber) return '—'
  const exp = line.expiresAt ? formatDateLatAm(line.expiresAt) : ''
  return exp ? `${line.lotNumber} / ${exp}` : line.lotNumber
}
</script>

<template>
  <div class="border border-slate-200 rounded-lg overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm text-left">
        <thead class="bg-slate-800 text-slate-200 text-xs uppercase tracking-wider">
          <tr>
            <th class="px-3 py-3 w-8" />
            <th class="px-3 py-3 whitespace-nowrap">Nº recepción</th>
            <th class="px-3 py-3 whitespace-nowrap">Fecha</th>
            <th class="px-3 py-3 whitespace-nowrap">OC</th>
            <th class="px-3 py-3">Proveedor</th>
            <th class="px-3 py-3 whitespace-nowrap">Bodega</th>
            <th class="px-3 py-3 whitespace-nowrap">Recibió</th>
            <th class="px-3 py-3 text-right whitespace-nowrap">Líneas</th>
            <th class="px-3 py-3 text-right whitespace-nowrap">Cant. total</th>
            <th class="px-3 py-3 text-right whitespace-nowrap">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading && !rows.length">
            <td colspan="10" class="px-4 py-10 text-center text-slate-400">
              Cargando historial…
            </td>
          </tr>
          <tr v-else-if="!rows.length">
            <td colspan="10" class="px-4 py-10 text-center text-slate-400">
              No hay recepciones con los filtros aplicados.
            </td>
          </tr>
          <template v-for="row in rows" :key="row.id">
            <tr class="hover:bg-slate-50 transition-colors">
              <td class="px-3 py-3">
                <button
                  type="button"
                  class="text-slate-500 hover:text-blue-600"
                  :title="expandedId === row.id ? 'Ocultar detalle' : 'Ver artículos'"
                  @click="toggleExpand(row)"
                >
                  {{ expandedId === row.id ? '▼' : '▶' }}
                </button>
              </td>
              <td class="px-3 py-3 font-mono text-xs whitespace-nowrap">{{ row.number }}</td>
              <td class="px-3 py-3 whitespace-nowrap text-slate-700">
                {{ formatDateTimeLatAm(row.receivedAt) }}
              </td>
              <td class="px-3 py-3 font-mono text-xs whitespace-nowrap">{{ row.ocNumber }}</td>
              <td class="px-3 py-3 text-slate-700 max-w-[12rem] truncate" :title="row.supplierName">
                {{ row.supplierName }}
              </td>
              <td class="px-3 py-3 whitespace-nowrap text-slate-700">
                <span class="font-mono text-xs">{{ row.warehouseCode }}</span>
                <span class="text-slate-500 text-xs ml-1 hidden lg:inline">{{ row.warehouseName }}</span>
              </td>
              <td class="px-3 py-3 whitespace-nowrap">
                <span :class="row.receivedByName === 'No registrado' ? 'text-slate-400 italic' : 'text-slate-800'">
                  {{ row.receivedByName }}
                </span>
              </td>
              <td class="px-3 py-3 text-right tabular-nums">{{ row.lineCount }}</td>
              <td class="px-3 py-3 text-right tabular-nums">{{ formatQty(row.totalQtyReceived) }}</td>
              <td class="px-3 py-3 text-right whitespace-nowrap">
                <button
                  type="button"
                  class="text-xs text-blue-600 hover:underline mr-2"
                  @click="toggleExpand(row)"
                >
                  Detalle
                </button>
                <button
                  type="button"
                  class="text-xs text-emerald-700 hover:underline font-medium"
                  @click="onPrint(row)"
                >
                  Imprimir
                </button>
              </td>
            </tr>
            <tr v-if="expandedId === row.id">
              <td colspan="10" class="px-0 py-0 bg-slate-50">
                <div v-if="detailLoading && !detailCache[row.id]" class="px-6 py-4 text-sm text-slate-500">
                  Cargando artículos…
                </div>
                <p v-else-if="detailError && !detailCache[row.id]" class="px-6 py-4 text-sm text-red-600">
                  {{ detailError }}
                </p>
                <div v-else-if="detailCache[row.id]" class="px-4 py-3">
                  <div class="flex flex-wrap items-center gap-2 mb-2 text-xs text-slate-600">
                    <span
                      v-if="detailCache[row.id].isPartial"
                      class="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium"
                    >
                      Recepción parcial
                    </span>
                    <span>{{ detailCache[row.id].lines.length }} artículo(s)</span>
                  </div>
                  <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <thead class="bg-slate-100 text-slate-600">
                      <tr>
                        <th class="px-3 py-2 text-left">Código</th>
                        <th class="px-3 py-2 text-left">Artículo</th>
                        <th class="px-3 py-2 text-right">Recibido</th>
                        <th class="px-3 py-2 text-right">Pedido OC</th>
                        <th class="px-3 py-2 text-left">Lote / Vence</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      <tr
                        v-for="line in detailCache[row.id].lines"
                        :key="line.id"
                        class="hover:bg-blue-50/30"
                      >
                        <td class="px-3 py-2 font-mono">{{ line.productCode }}</td>
                        <td class="px-3 py-2">{{ line.productName }}</td>
                        <td class="px-3 py-2 text-right tabular-nums">
                          {{ formatQty(line.qtyReceived) }} {{ line.unit }}
                        </td>
                        <td class="px-3 py-2 text-right tabular-nums text-slate-500">
                          {{ line.ocLineQty != null ? formatQty(line.ocLineQty) : '—' }}
                        </td>
                        <td class="px-3 py-2 text-slate-600">{{ lineLot(line) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div
      v-if="total > 0"
      class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 bg-white text-sm text-slate-600"
    >
      <span>{{ formatInteger(total) }} recepción{{ total === 1 ? '' : 'es' }}</span>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="px-3 py-1 rounded border border-slate-200 disabled:opacity-40"
          :disabled="page <= 1 || loading"
          @click="emit('page-change', page - 1)"
        >
          Anterior
        </button>
        <span class="tabular-nums">{{ page }} / {{ totalPagesSafe }}</span>
        <button
          type="button"
          class="px-3 py-1 rounded border border-slate-200 disabled:opacity-40"
          :disabled="page >= totalPagesSafe || loading"
          @click="emit('page-change', page + 1)"
        >
          Siguiente
        </button>
      </div>
    </div>
  </div>
</template>
