<script setup lang="ts">
import type { AlertVariant } from '~/components/ui/UiAlertModal.vue'
import type { ReceptionOrder } from '~/types/reception'
import type { PurchaseOrderSummary } from '~/types/purchases'

definePageMeta({ layout: 'app' })

const { fetchApi, base } = useApi()

const loading = ref(false)
const saving = ref(false)
const scanMessage = ref('')
const order = ref<ReceptionOrder | null>(null)

const alertOpen = ref(false)
const alertTitle = ref('Atención')
const alertMessage = ref('')
const alertVariant = ref<AlertVariant>('error')

function showAlert(message: string, options?: { title?: string; variant?: AlertVariant }) {
  alertMessage.value = message
  alertTitle.value = options?.title ?? (options?.variant === 'success' ? 'Listo' : 'Atención')
  alertVariant.value = options?.variant ?? 'error'
  alertOpen.value = true
}

const openOrders = ref<PurchaseOrderSummary[]>([])

const ocNumber = ref('')
const supplierId = ref('')
const warehouseId = ref('')

const ocLocked = computed(() => !!order.value?.purchaseOrderId)

const isFarmaciaWarehouse = computed(() => order.value?.catalogFarmacia === true)

const allLinesReceived = computed(
  () =>
    !!order.value?.purchaseOrderId &&
    !order.value.lines.some(isActionableLine),
)

const hasActionableLines = computed(() => order.value?.lines.some(isActionableLine) ?? false)

const supplierDisplayText = computed(() => {
  if (order.value?.supplier?.trim()) return order.value.supplier
  return ''
})

const warehouseDisplayText = computed(() => {
  const o = order.value
  if (!o?.selectedWarehouse?.trim()) return ''
  const code = o.warehouseCode?.trim()
  return code ? `${o.selectedWarehouse} (${code})` : o.selectedWarehouse
})

function isActionableLine(l: {
  fulfillmentStatus?: string
  qtyErp: number
  qtyAlreadyReceived?: number
  lineAction?: string
}) {
  if (l.lineAction === 'complete') return false
  if (l.fulfillmentStatus === 'COMPLETE' || l.fulfillmentStatus === 'SURPLUS') return false
  return Math.max(0, l.qtyErp - (l.qtyAlreadyReceived ?? 0)) > 0
}

function applyOrder(data: ReceptionOrder) {
  order.value = {
    ...data,
    lines: data.lines.map((l) => ({
      ...l,
      lineAction:
        l.lineAction ??
        (l.fulfillmentStatus === 'COMPLETE' || l.fulfillmentStatus === 'SURPLUS'
          ? 'complete'
          : 'defer'),
      qtyReceived:
        l.lineAction === 'receive' ? l.qtyReceived : 0,
    })),
  }
  ocNumber.value = data.ocNumber
  supplierId.value = data.supplierId ?? ''
  warehouseId.value = data.selectedWarehouseId || data.warehouseId
}

async function loadMasters() {
  const ordRes = await fetchApi<PurchaseOrderSummary[]>('/purchases/orders')
  if (ordRes.data) openOrders.value = ordRes.data
}

async function loadOrder(oc?: string) {
  const num = (oc ?? ocNumber.value).trim().toUpperCase()
  if (!num) {
    showAlert('Ingrese o escanee un número de OC')
    return
  }
  loading.value = true
  const { data, error: err } = await fetchApi<ReceptionOrder>(
    `/receptions/order/${encodeURIComponent(num)}`,
  )
  loading.value = false
  if (err || !data) {
    showAlert(err ?? 'Orden no encontrada')
    order.value = null
    return
  }
  applyOrder(data)
  const pending = data.lines.filter(isActionableLine).length
  const complete = data.lines.length - pending
  scanMessage.value =
    pending > 0
      ? `OC ${data.ocNumber}: ${pending} artículo(s) pendientes${complete > 0 ? `, ${complete} ya recibidos` : ''}`
      : `OC ${data.ocNumber}: todos los artículos ya fueron recibidos`
}

async function onScan(code: string) {
  scanMessage.value = `Código: ${code}`
  ocNumber.value = code.trim().toUpperCase()
  loading.value = true
  const { data, error: err } = await fetchApi<ReceptionOrder>(
    `/receptions/scan/${encodeURIComponent(code.trim())}`,
  )
  loading.value = false
  if (data) {
    applyOrder(data)
    return
  }
  if (code.toUpperCase().includes('OC')) {
    await loadOrder(code)
    return
  }
  showAlert(err ?? 'Código no reconocido')
}

function onPrintSticker(lineId: string) {
  window.open(`${base}/printing/label/${lineId}`, '_blank')
}

async function savePartial() {
  await confirmReception(true)
}

async function confirmReception(isPartial = false) {
  if (!order.value?.purchaseOrderId) {
    showAlert('Cargue una orden de compra primero')
    return
  }
  const wh = warehouseId.value || order.value.selectedWarehouseId || order.value.warehouseId
  if (!wh) {
    showAlert('La OC no tiene bodega destino asignada')
    return
  }

  const receiveLines = order.value.lines.filter((l) => l.lineAction === 'receive')
  const notArrivedLines = order.value.lines.filter((l) => l.lineAction === 'not_arrived')

  const receiveWithQty = receiveLines.filter((l) => l.qtyReceived > 0)
  if (!receiveWithQty.length) {
    showAlert(
      'Marque Recibir en al menos un artículo con cantidad mayor a cero. Los demás quedan pendientes para otra entrega.',
    )
    return
  }

  const missingLot = receiveWithQty.filter(
    (l) =>
      isFarmaciaWarehouse.value &&
      l.requiresLot &&
      (!l.lotNumber?.trim() || l.lotNumber.trim() === '0' || !l.expiresAt),
  )
  if (missingLot.length) {
    showAlert(`Complete lote y vencimiento en: ${missingLot.map((l) => l.code).join(', ')}`)
    return
  }

  const invalidQty = receiveWithQty.filter((l) => {
    const max = Math.max(0, l.qtyErp - (l.qtyAlreadyReceived ?? 0))
    return l.qtyReceived > max
  })
  if (invalidQty.length) {
    showAlert(`Cantidad a recibir supera el pendiente en: ${invalidQty.map((l) => l.code).join(', ')}`)
    return
  }

  const payloadLines = receiveWithQty.map((l) => ({
    purchaseOrderLineId: l.id,
    productId: l.productId,
    disposition: 'receive' as const,
    qtyReceived: l.qtyReceived,
    lotNumber: l.lotNumber || undefined,
    expiresAt: l.expiresAt || undefined,
  }))

  const hasPendingAfterSave = order.value.lines.some((l) => {
    if (!isActionableLine(l)) return false
    if (l.lineAction === 'receive' && l.qtyReceived > 0) {
      const max = Math.max(0, l.qtyErp - (l.qtyAlreadyReceived ?? 0))
      return l.qtyReceived < max
    }
    return l.lineAction !== 'receive' || l.qtyReceived <= 0
  })

  saving.value = true
  const { data, error: err } = await fetchApi<{ receptionNumber: string; status?: string }>(
    '/receptions/confirm',
    {
      method: 'POST',
      body: {
        purchaseOrderId: order.value.purchaseOrderId,
        warehouseId: wh,
        isPartial: isPartial || hasPendingAfterSave || notArrivedLines.length > 0,
        lines: payloadLines,
      },
    },
  )
  saving.value = false
  if (err || !data) {
    showAlert(err ?? 'No se pudo guardar la recepción')
    return
  }
  showAlert(`Recepción ${data.receptionNumber} registrada correctamente`, {
    title: 'Recepción guardada',
    variant: 'success',
  })
  const oc = order.value!.ocNumber
  if (data.status === 'RECEIVED') {
    order.value = null
    ocNumber.value = ''
    supplierId.value = ''
    warehouseId.value = ''
    scanMessage.value = `OC ${oc} recibida por completo`
  } else {
    await loadOrder(oc)
    scanMessage.value = `Recepción parcial ${data.receptionNumber} — faltantes siguen pendientes en la OC`
  }
  await loadMasters()
}

const route = useRoute()

async function loadFromRouteQuery() {
  const oc = route.query.oc as string | undefined
  if (!oc?.trim()) return
  ocNumber.value = oc.trim().toUpperCase()
  await loadOrder(oc)
}

watch(
  () => route.query.oc,
  (oc) => {
    if (typeof oc === 'string' && oc.trim()) loadFromRouteQuery()
  },
)

onMounted(async () => {
  await loadMasters()
  await loadFromRouteQuery()
})
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">Recepción de Mercancía</h2>
        <p class="text-slate-500 text-sm">
          OC cargada desde
          <NuxtLink to="/compras/ordenes" class="text-blue-600 hover:underline">Órdenes de compra</NuxtLink>
          ; complete lote/vencimiento (farmacia) y confirme la recepción.
        </p>
        <p v-if="scanMessage" class="text-xs text-blue-600 mt-1">{{ scanMessage }}</p>
      </div>
      <RecepcionReceptionScanBar :disabled="loading" @scan="onScan" />
    </div>

    <RecepcionReceptionOrderForm
      v-model:oc-number="ocNumber"
      :supplier-display="supplierDisplayText"
      :warehouse-display="warehouseDisplayText"
      :open-orders="openOrders"
      :oc-locked="ocLocked"
      :loading="loading"
      @load="loadOrder()"
    />

    <p
      v-if="order?.importStatus === 'INCOMPLETE'"
      class="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 mb-4"
    >
      OC importada incompleta: {{ order.linkedLinesCount }} de {{ order.erpLinesCount }} líneas CXC
      vinculadas al catálogo. Revise los productos no importados abajo.
    </p>

    <div
      v-if="order?.missingErpLines?.length"
      class="mb-4 border border-amber-200 rounded-lg overflow-hidden"
    >
      <p class="text-xs font-semibold text-amber-900 bg-amber-100 px-3 py-2">
        Líneas CXC no importadas ({{ order.missingErpLines.length }})
      </p>
      <div class="overflow-x-auto">
        <table class="w-full text-xs text-left">
          <thead class="text-slate-500 bg-slate-50">
            <tr>
              <th class="px-3 py-2">Código CXC</th>
              <th class="px-3 py-2">Descripción</th>
              <th class="px-3 py-2 text-center">Cant.</th>
              <th class="px-3 py-2">Motivo</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in order.missingErpLines"
              :key="row.erpCode"
              class="border-t border-amber-100"
            >
              <td class="px-3 py-2 font-mono">{{ row.erpCode }}</td>
              <td class="px-3 py-2">{{ row.erpDescription }}</td>
              <td class="px-3 py-2 text-center tabular-nums">{{ row.qtyErp }}</td>
              <td class="px-3 py-2">
                {{
                  row.reason === 'WRONG_CATALOG'
                    ? 'Catálogo incorrecto (farmacia/almacén)'
                    : 'Producto no encontrado'
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p
      v-if="isFarmaciaWarehouse && order?.lines?.some((l) => l.requiresLot && l.qtyReceived > 0)"
      class="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4"
    >
      Bodega farmacia ({{ order?.warehouseCode ?? 'BC-FARM' }}): indique lote y vencimiento en cada
      producto antes de confirmar (FEFO).
    </p>

    <p
      v-if="allLinesReceived"
      class="text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4"
    >
      Esta OC ya tiene todos sus artículos recibidos en bodega.
    </p>

    <template v-if="order?.ocNumber && order.lines.length">
      <RecepcionReceptionLinesTable
        :lines="order.lines"
        :is-farmacia-warehouse="isFarmaciaWarehouse"
        @update:lines="order.lines = $event"
        @print-sticker="onPrintSticker"
      />

      <div v-if="hasActionableLines" class="mt-6 flex justify-end gap-3">
        <button
          type="button"
          class="px-4 py-2 border border-slate-300 text-slate-600 rounded hover:bg-slate-50 transition font-medium disabled:opacity-50"
          :disabled="saving"
          @click="savePartial"
        >
          Guardar Parcial
        </button>
        <button
          type="button"
          class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition font-medium flex items-center gap-2 disabled:opacity-50"
          :disabled="saving"
          @click="confirmReception(false)"
        >
          <UiIcon name="check-circle" :size="18" />
          {{ saving ? 'Guardando...' : 'Confirmar Recepción' }}
        </button>
      </div>
    </template>

    <p v-else-if="!loading" class="text-slate-500 text-sm py-4 text-center border-t border-slate-100 mt-4">
      Ingrese el número de OC y pulse <strong>Cargar Detalles</strong>, o cree una nueva en Compras.
    </p>

    <UiAlertModal
      v-model:open="alertOpen"
      :title="alertTitle"
      :message="alertMessage"
      :variant="alertVariant"
    />
  </div>
</template>
