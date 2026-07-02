<script setup lang="ts">
import type { ReceptionOrder } from '~/types/reception'
import {
  applyReceptionOrder,
  buildReceptionConfirmBody,
  isActionableReceptionLine,
  matchReceptionLineByScan,
  validateReceptionConfirm,
} from '~/composables/reception/useReceptionConfirm'

definePageMeta({ layout: 'pda' })

const { fetchApi } = useApi()

const order = ref<ReceptionOrder | null>(null)
const warehouseId = ref('')
const loading = ref(false)
const saving = ref(false)
const message = ref('')
const error = ref('')
const selectedLineId = ref<string | null>(null)

const isFarmaciaWarehouse = computed(() => order.value?.catalogFarmacia === true)

const pendingLines = computed(() =>
  order.value?.lines.filter(isActionableReceptionLine) ?? [],
)

const selectedLine = computed(() =>
  order.value?.lines.find((l) => l.id === selectedLineId.value) ?? null,
)

async function loadOrder(oc: string) {
  loading.value = true
  error.value = ''
  const num = oc.trim().toUpperCase()
  const { data, error: err } = await fetchApi<ReceptionOrder>(
    `/receptions/order/${encodeURIComponent(num)}`,
  )
  loading.value = false
  if (err || !data) {
    error.value = err ?? 'Orden no encontrada'
    order.value = null
    return
  }
  order.value = applyReceptionOrder(data)
  warehouseId.value = data.selectedWarehouseId || data.warehouseId
  message.value = `OC ${data.ocNumber} — ${pendingLines.value.length} línea(s) pendiente(s)`
}

async function onScanOc(code: string) {
  error.value = ''
  loading.value = true
  const { data, error: err } = await fetchApi<ReceptionOrder>(
    `/receptions/scan/${encodeURIComponent(code.trim())}`,
  )
  loading.value = false
  if (data) {
    order.value = applyReceptionOrder(data)
    warehouseId.value = data.selectedWarehouseId || data.warehouseId
    message.value = `OC ${data.ocNumber} cargada`
    return
  }
  if (code.toUpperCase().includes('OC') || /^\d+$/.test(code.trim())) {
    await loadOrder(code)
    return
  }
  if (order.value) {
    onScanProduct(code)
    return
  }
  error.value = err ?? 'Código no reconocido'
}

function onScanProduct(code: string) {
  if (!order.value) return
  const line = matchReceptionLineByScan(order.value.lines, code)
  if (!line || !isActionableReceptionLine(line)) {
    error.value = `Producto no pendiente: ${code}`
    return
  }
  selectedLineId.value = line.id
  line.lineAction = 'receive'
  const max = Math.max(0, line.qtyErp - (line.qtyAlreadyReceived ?? 0))
  if (line.qtyReceived < max) line.qtyReceived += 1
  error.value = ''
  message.value = `${line.code}: ${line.qtyReceived}/${max}`
}

function markNotArrived(lineId: string) {
  const line = order.value?.lines.find((l) => l.id === lineId)
  if (!line) return
  line.lineAction = 'not_arrived'
  line.qtyReceived = 0
}

async function confirm() {
  if (!order.value) return
  const validation = validateReceptionConfirm(
    order.value,
    warehouseId.value,
    isFarmaciaWarehouse.value,
  )
  if (validation) {
    error.value = validation
    return
  }

  saving.value = true
  error.value = ''
  const body = buildReceptionConfirmBody(order.value, warehouseId.value, true)
  const { data, error: err } = await fetchApi<{ receptionNumber: string; status?: string }>(
    '/receptions/confirm',
    { method: 'POST', body },
  )
  saving.value = false
  if (err || !data) {
    error.value = err ?? 'No se pudo guardar'
    return
  }
  message.value = `Recepción ${data.receptionNumber} registrada`
  if (data.status === 'RECEIVED') {
    order.value = null
    selectedLineId.value = null
  } else {
    await loadOrder(order.value.ocNumber)
  }
}
</script>

<template>
  <div class="space-y-4">
    <PdaBackLink />
    <h2 class="font-bold text-base">Recepción rápida</h2>

    <PdaScanField
      :placeholder="order ? 'Escanear producto u OC' : 'Escanear OC o código'"
      :disabled="loading || saving"
      @scan="onScanOc"
    />

    <PdaStatusMessage :message="message" :error="error" />

    <template v-if="order">
      <div class="text-xs text-slate-400 border border-slate-700 rounded-lg p-2">
        <p><strong class="text-slate-200">{{ order.ocNumber }}</strong> — {{ order.supplier }}</p>
        <p>{{ order.selectedWarehouse || order.warehouseCode }}</p>
      </div>

      <ul class="space-y-2 max-h-[45vh] overflow-y-auto">
        <li
          v-for="line in pendingLines"
          :key="line.id"
          class="p-2 rounded-lg border text-sm"
          :class="selectedLineId === line.id ? 'border-blue-500 bg-slate-800' : 'border-slate-700'"
        >
          <p class="font-mono text-xs text-blue-300">{{ line.code }}</p>
          <p class="text-slate-300 truncate">{{ line.name }}</p>
          <p class="text-xs text-slate-500 mt-1">
            Pendiente: {{ Math.max(0, line.qtyErp - (line.qtyAlreadyReceived ?? 0)) }}
            · Recibir: {{ line.qtyReceived }}
          </p>
          <div v-if="selectedLineId === line.id && isFarmaciaWarehouse && line.requiresLot" class="mt-2 space-y-1">
            <input
              v-model="line.lotNumber"
              placeholder="Lote"
              class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-xs"
            />
            <input
              v-model="line.expiresAt"
              type="date"
              class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-xs"
            />
          </div>
          <div class="flex gap-2 mt-2">
            <button
              type="button"
              class="text-xs px-2 py-1 rounded bg-blue-600"
              @click="onScanProduct(line.code)"
            >
              +1
            </button>
            <button
              type="button"
              class="text-xs px-2 py-1 rounded border border-slate-600 text-slate-400"
              @click="markNotArrived(line.id)"
            >
              No llegó
            </button>
          </div>
        </li>
      </ul>

      <button
        type="button"
        class="w-full py-3 bg-emerald-600 rounded-lg font-medium disabled:opacity-50"
        :disabled="saving"
        @click="confirm"
      >
        {{ saving ? 'Guardando…' : 'Confirmar recepción' }}
      </button>
    </template>
  </div>
</template>
