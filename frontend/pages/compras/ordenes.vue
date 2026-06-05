<script setup lang="ts">
import type {
  ErpCxcLine,
  ErpCxcLineWithOc,
  OcConsultEntry,
  OcLookupResult,
  OcResolvedHeader,
} from '~/types/erp-cxc'
import type { PurchaseOrderDetail, PurchaseOrderLine, PurchaseOrderSummary } from '~/types/purchases'

definePageMeta({ layout: 'app', hideGlobalSearch: true, pageTitle: 'Órdenes de compra' })

const { fetchApi } = useApi()
const router = useRouter()

type TabId = 'consulta' | 'abiertas'
const activeTab = ref<TabId>('consulta')

const orders = ref<PurchaseOrderSummary[]>([])
const ocDraft = ref('')
const ocEntries = ref<OcConsultEntry[]>([])

const loading = ref(true)
const loadingOc = ref(false)
const loadingErp = ref(false)
const error = ref<string | null>(null)
const successMsg = ref<string | null>(null)
const showErpPanel = ref(true)
let lookupSeq = 0

const headerMatchLabels: Record<string, string> = {
  purchase_order_db: 'OC registrada en el sistema',
  erp_warehouse: 'Bodega ERP (02, 10 u 11)',
  supplier_tax_id: 'Proveedor por NIT en catálogo',
  supplier_erp_created: 'Proveedor creado desde NIT del ERP',
  supplier_name: 'Proveedor por razón social',
  supplier_last_order: 'Bodega de la última OC del proveedor',
  products_policy: 'Bodega según tipo de productos (farmacia/almacén)',
  products_code_prefix: 'Bodega farmacia (códigos MD)',
  default_warehouse: 'Bodega central por defecto',
  none: 'Sin coincidencia en BD',
}

const poStatusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  APPROVED: 'Aprobada',
  PARTIAL: 'Recepción parcial',
  RECEIVED: 'Recibida',
  CANCELLED: 'Anulada',
}

const fulfillmentLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  PARTIAL: 'Parcial',
  COMPLETE: 'Completo',
  SURPLUS: 'Excedente',
  NOT_ARRIVED: 'No llegará',
}

function normalizeOc(v: string) {
  return v.trim().toUpperCase()
}

function normalizeNit(nit: string | undefined | null) {
  return (nit ?? '').replace(/\D/g, '')
}

function supplierKey(entry: OcConsultEntry): string {
  const r = entry.result
  if (!r) return ''
  const nit = normalizeNit(r.erp?.erpHeader?.nit)
  if (nit) return `nit:${nit}`
  const name = (
    r.header?.supplierName ??
    r.local?.supplierName ??
    r.erp?.erpHeader?.razonSocial ??
    ''
  )
    .trim()
    .toLowerCase()
  return `name:${name}`
}

function warehouseKeyFromResult(result: OcLookupResult): string {
  const id = result.header?.warehouseId ?? result.local?.warehouseId
  if (id) return `id:${id}`
  const code =
    result.header?.warehouseCode ??
    result.local?.warehouseCode ??
    result.erp?.erpHeader?.warehouse?.code
  const name =
    result.header?.warehouseName ??
    result.local?.warehouseName ??
    result.erp?.erpHeader?.warehouse?.name ??
    ''
  if (code) return `code:${String(code).toLowerCase()}`
  return `name:${String(name).toLowerCase()}`
}

function warehouseLabelFromResult(result: OcLookupResult): string {
  const loc = result.local
  if (loc?.warehouseName) {
    const code = loc.warehouseCode?.trim()
    return code ? `${loc.warehouseName} (${code})` : loc.warehouseName
  }
  const h = result.header
  if (h?.warehouseName) {
    const code = h.warehouseCode?.trim()
    return code ? `${h.warehouseName} (${code})` : h.warehouseName
  }
  const wh = result.erp?.erpHeader?.warehouse
  if (wh?.name) return wh.code ? `${wh.name} (${wh.code})` : wh.name
  return 'bodega desconocida'
}

function warehouseKey(entry: OcConsultEntry): string {
  const r = entry.result
  if (!r) return ''
  return warehouseKeyFromResult(r)
}

/** Bodega de referencia: primera OC consultada con éxito en la lista */
const referenceWarehouseKey = computed(() => {
  const e = ocEntries.value.find((x) => x.result?.found && !x.error && warehouseKey(x))
  return e ? warehouseKey(e) : ''
})

const referenceWarehouseLabel = computed(() => {
  const e = ocEntries.value.find((x) => x.result?.found && !x.error && warehouseKey(x))
  return e?.result ? warehouseLabelFromResult(e.result) : ''
})

const successfulEntries = computed(() =>
  ocEntries.value.filter((e) => e.result?.found && !e.error),
)

const localOrdersList = computed(() =>
  successfulEntries.value
    .filter((e) => e.result?.source === 'local' && e.result.local)
    .map((e) => ({
      number: e.number,
      order: e.result!.local!,
      header: e.result!.header,
    })),
)

const mergedErpLines = computed((): ErpCxcLineWithOc[] => {
  const rows: ErpCxcLineWithOc[] = []
  for (const entry of successfulEntries.value) {
    const lines = entry.result?.erp?.erpLines
    if (!lines?.length) continue
    for (const row of lines) {
      rows.push({ ...row, ocNumber: entry.number })
    }
  }
  return rows.sort((a, b) => a.ocNumber.localeCompare(b.ocNumber) || String(a.CODIGO).localeCompare(String(b.CODIGO)))
})

const hasMergedErp = computed(() => mergedErpLines.value.length > 0)

const singleErpEntry = computed(() => {
  if (ocEntries.value.length !== 1) return null
  const e = ocEntries.value[0]
  if (e.result?.source === 'erp' && e.result.erp?.erpLines?.length) return e
  return null
})

const remissionMismatch = computed(() => {
  const ok = successfulEntries.value
  if (ok.length < 2) return false
  const suppliers = new Set(ok.map(supplierKey).filter(Boolean))
  return suppliers.size > 1
})

const primaryHeader = computed((): OcResolvedHeader | null => {
  const first = successfulEntries.value[0]?.result
  return first?.header ?? null
})

const supplierDisplayText = computed(() => {
  const loc = localOrdersList.value[0]?.order
  if (loc?.supplierName) return loc.supplierName
  const h = primaryHeader.value
  if (h?.supplierName) return h.supplierName
  const erp = successfulEntries.value.find((e) => e.result?.erp?.erpHeader)?.result?.erp?.erpHeader
  return erp?.razonSocial ?? ''
})

const warehouseDisplayText = computed(() => {
  const loc = localOrdersList.value[0]?.order
  if (loc?.warehouseName) {
    const code = loc.warehouseCode?.trim()
    return code ? `${loc.warehouseName} (${code})` : loc.warehouseName
  }
  const h = primaryHeader.value
  if (h?.warehouseName) {
    const code = h.warehouseCode?.trim()
    return code ? `${h.warehouseName} (${code})` : h.warehouseName
  }
  return ''
})

const erpIntegrationName = computed(
  () => successfulEntries.value.find((e) => e.result?.erp?.integrationName)?.result?.erp?.integrationName ?? 'CXCQRYSTALOS',
)

const multiOcConsult = computed(() => ocEntries.value.length > 1)

const consultStatusLine = computed(() => {
  if (activeTab.value !== 'consulta') return ''
  if (successMsg.value) return successMsg.value
  const parts: string[] = []
  if (supplierDisplayText.value) parts.push(supplierDisplayText.value)
  if (warehouseDisplayText.value) parts.push(warehouseDisplayText.value)
  if (referenceWarehouseLabel.value && !warehouseDisplayText.value.includes(referenceWarehouseLabel.value)) {
    parts.push(referenceWarehouseLabel.value)
  }
  return parts.join(' · ')
})

type LocalFlatLine = PurchaseOrderLine & { ocNumber: string; orderStatus: string }

const mergedLocalLines = computed((): LocalFlatLine[] => {
  const rows: LocalFlatLine[] = []
  for (const { number, order } of localOrdersList.value) {
    for (const line of order.lines ?? []) {
      rows.push({ ...line, ocNumber: number, orderStatus: order.status })
    }
  }
  return rows
})

const localLinesTotal = computed(() =>
  mergedLocalLines.value.reduce(
    (s, l) => s + Number(l.lineTotal ?? (l.qtyOrdered || 0) * (l.unitPrice || 0)),
    0,
  ),
)

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
}

function formatQty(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 4 }).format(Number(n))
}

async function loadOrders() {
  loading.value = true
  error.value = null
  const { data } = await fetchApi<PurchaseOrderSummary[]>('/purchases/orders')
  if (data) orders.value = data
  loading.value = false
}

function enforceSameWarehouse(entries: OcConsultEntry[]): OcConsultEntry[] {
  let refKey: string | null = null
  let refLabel = ''
  return entries.map((entry) => {
    if (!entry.result?.found) return entry
    const wh = warehouseKeyFromResult(entry.result)
    if (!wh) return entry
    if (!refKey) {
      refKey = wh
      refLabel = warehouseLabelFromResult(entry.result)
      return { ...entry, error: null }
    }
    if (wh === refKey) return { ...entry, error: null }
    return {
      ...entry,
      error: `Bodega distinta (${warehouseLabelFromResult(entry.result)}). Solo se permite ${refLabel}`,
    }
  })
}

async function addOcFromDraft() {
  const n = normalizeOc(ocDraft.value)
  if (!n) return
  if (ocEntries.value.some((e) => e.number === n)) {
    ocDraft.value = ''
    return
  }

  const refKey = referenceWarehouseKey.value
  const refLabel = referenceWarehouseLabel.value

  if (!refKey) {
    ocEntries.value.push({ number: n })
    ocDraft.value = ''
    error.value = null
    return
  }

  loadingOc.value = true
  error.value = null
  const { data, error: err } = await fetchApi<OcLookupResult>(
    `/purchases/orders/lookup/${encodeURIComponent(n)}`,
  )
  loadingOc.value = false

  if (err || !data) {
    error.value = err ?? `No se pudo consultar la OC ${n}`
    return
  }
  if (!data.found) {
    error.value = data.message ?? `OC ${n} no encontrada`
    return
  }

  const wh = warehouseKeyFromResult(data)
  if (!wh || wh !== refKey) {
    error.value = `La OC ${n} tiene otra bodega destino (${warehouseLabelFromResult(data)}). Solo se permiten OC de ${refLabel}`
    return
  }

  ocEntries.value.push({ number: n, result: data, error: null, loading: false })
  ocDraft.value = ''
  successMsg.value = `OC ${n} añadida (${refLabel})`
}

async function ensureDraftInList() {
  const n = normalizeOc(ocDraft.value)
  if (!n || ocEntries.value.some((e) => e.number === n)) {
    if (n) ocDraft.value = ''
    return
  }
  if (referenceWarehouseKey.value) {
    await addOcFromDraft()
    return
  }
  ocEntries.value.push({ number: n })
  ocDraft.value = ''
}

function removeOc(number: string) {
  ocEntries.value = ocEntries.value.filter((e) => e.number !== number)
}

function clearAllOcs() {
  ocEntries.value = []
  ocDraft.value = ''
  error.value = null
  successMsg.value = null
}

async function lookupEntry(entry: OcConsultEntry): Promise<OcConsultEntry> {
  const { data, error: err } = await fetchApi<OcLookupResult>(
    `/purchases/orders/lookup/${encodeURIComponent(entry.number)}`,
  )
  if (err || !data) {
    return { ...entry, loading: false, error: err ?? 'Error al consultar', result: null }
  }
  return { ...entry, loading: false, error: data.found ? null : (data.message ?? 'No encontrada'), result: data }
}

async function lookupAll() {
  ensureDraftInList()
  if (!ocEntries.value.length) {
    error.value = 'Añada al menos una OC con +'
    return
  }

  const seq = ++lookupSeq
  loadingOc.value = true
  loadingErp.value = true
  error.value = null
  successMsg.value = null

  ocEntries.value = ocEntries.value.map((e) => ({ ...e, loading: true, error: null }))

  const updated = await Promise.all(ocEntries.value.map((e) => lookupEntry(e)))

  if (seq !== lookupSeq) return
  ocEntries.value = enforceSameWarehouse(updated)
  loadingOc.value = false
  loadingErp.value = false

  const ok = ocEntries.value.filter((e) => e.result?.found && !e.error)
  const failed = ocEntries.value.filter((e) => e.error || !e.result?.found)

  if (!ok.length) {
    error.value =
      failed[0]?.error ??
      failed[0]?.result?.message ??
      'Ninguna OC encontrada en el sistema local ni en el ERP.'
    return
  }

  const erpLineCount = mergedErpLines.value.length
  const localCount = localOrdersList.value.length
  const parts = [`${ok.length} OC consultada(s)`]
  if (erpLineCount) parts.push(`${erpLineCount} líneas ERP`)
  if (localCount) parts.push(`${localCount} en sistema local`)
  if (supplierDisplayText.value) parts.push(`Proveedor: ${supplierDisplayText.value}`)
  if (multiOcConsult.value) parts.push('Vista combinada (solo consulta)')
  successMsg.value = parts.join(' · ')

  if (failed.length) {
    error.value = `${failed.length} OC con error: ${failed.map((f) => f.number).join(', ')}`
  }
}

async function importToReception() {
  const entry = singleErpEntry.value
  const erp = entry?.result?.erp
  const rows = erp?.erpLines
  if (!entry || !rows?.length) return

  const wh = entry.result?.header?.warehouseId ?? ''
  const supplierId = entry.result?.header?.supplierId ?? ''
  const nit = erp?.erpHeader?.nit?.trim()
  if (!wh) {
    error.value = 'Complete la consulta de OC antes de importar'
    return
  }
  if (!supplierId && !nit) {
    error.value = 'No hay proveedor en el ERP (NIT). Busque la OC nuevamente.'
    return
  }

  loadingErp.value = true
  error.value = null

  const importLines = rows
    .map((row) => ({
      code: String(row.CODIGO ?? '').trim(),
      name: String(row.DESCRIPCION ?? row.CODIGO ?? '').trim(),
      qtyOrdered: Number(row.CANT_AUTO ?? 1),
      unitPrice: Number(row.VLR_UNITARIO ?? 0),
      lotNumber: String(row.NRO_LOTE ?? '').trim() || undefined,
    }))
    .filter((l) => l.code && l.name)

  const { data, error: err } = await fetchApi<{ ocNumber: string }>('/receptions/import-erp', {
    method: 'POST',
    body: {
      ocNumber: entry.number,
      supplierId: supplierId || undefined,
      supplierTaxId: erp?.erpHeader?.nit,
      supplierName: erp?.erpHeader?.razonSocial,
      warehouseId: wh,
      lines: importLines,
    },
  })

  loadingErp.value = false
  if (err || !data) {
    error.value = err ?? 'No se pudo importar a recepción'
    return
  }

  await router.push({ path: '/recepcion', query: { oc: data.ocNumber } })
}

function consultSingleOc(number: string) {
  ocEntries.value = [{ number: normalizeOc(number) }]
  ocDraft.value = ''
  lookupAll()
}

async function pickOrder(o: PurchaseOrderSummary) {
  activeTab.value = 'consulta'
  ocDraft.value = o.number
  if (referenceWarehouseKey.value) {
    await addOcFromDraft()
  } else if (!ocEntries.value.some((e) => e.number === normalizeOc(o.number))) {
    ocEntries.value.push({ number: normalizeOc(o.number) })
  }
  await lookupAll()
}

function receptionLink(num: string) {
  return { path: '/recepcion', query: { oc: num, from: 'ordenes' } }
}

function erpNum(v: unknown): string {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n)
    ? new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n)
    : String(v)
}

function erpWarehouseLabel(row: ErpCxcLine): string {
  const r = row as ErpCxcLine & Record<string, string | undefined>
  const name = r.NOMBODEGA ?? r.BODEGA_DESTINO ?? ''
  const code = r.CODBODEGA ?? ''
  const bodega = r.BODEGA ?? ''
  if (name && code) return `${name} (${code})`
  if (name) return name
  if (code) return code
  return bodega || '—'
}

onMounted(() => loadOrders())
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <nav class="flex gap-0.5 p-0.5 bg-slate-100 rounded-lg">
        <button
          type="button"
          class="px-3 py-1.5 rounded-md text-xs font-medium transition"
          :class="
            activeTab === 'consulta'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          "
          @click="activeTab = 'consulta'"
        >
          Consulta
        </button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5"
          :class="
            activeTab === 'abiertas'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          "
          @click="activeTab = 'abiertas'"
        >
          Abiertas
          <span
            v-if="orders.length"
            class="text-[10px] px-1 py-0.5 rounded-full bg-indigo-100 text-indigo-800 tabular-nums"
          >
            {{ orders.length }}
          </span>
        </button>
      </nav>
      <NuxtLink to="/recepcion" class="text-xs text-blue-600 hover:underline shrink-0">
        Ir a Recepción →
      </NuxtLink>
    </div>

    <p
      v-if="error"
      class="text-xs text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1.5"
    >
      {{ error }}
    </p>

    <div v-show="activeTab === 'consulta'" class="bg-white rounded-lg border border-slate-200 shadow-sm">
      <div class="px-3 py-2 border-b border-slate-100 space-y-2">
        <ComprasOcMultiSearchBar
          v-model:draft="ocDraft"
          :entries="ocEntries"
          :reference-warehouse="referenceWarehouseLabel"
          :loading="loadingOc || loadingErp"
          compact
          @add="addOcFromDraft"
          @search="lookupAll"
          @remove="removeOc"
          @clear="clearAllOcs"
        />
        <p
          v-if="consultStatusLine"
          class="text-[11px] text-slate-600 truncate"
          :title="consultStatusLine"
        >
          {{ consultStatusLine }}
        </p>
        <p
          v-if="referenceWarehouseLabel && !warehouseDisplayText"
          class="text-[10px] text-indigo-700"
        >
          Misma bodega en todas las OC: {{ referenceWarehouseLabel }}
        </p>
        <p v-if="remissionMismatch" class="text-[10px] text-amber-800">
          Proveedores distintos entre OC — revise la remisión.
        </p>
      </div>

      <!-- OC en BD local -->
      <template v-if="mergedLocalLines.length">
        <div class="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-slate-100 bg-slate-50/80">
          <span class="text-xs font-medium text-slate-700">
            Sistema local
            <span v-if="multiOcConsult" class="text-slate-500 font-normal">
              · {{ localOrdersList.length }} OC
            </span>
          </span>
          <NuxtLink
            v-if="!multiOcConsult && localOrdersList.length === 1"
            :to="receptionLink(localOrdersList[0].number)"
            class="text-xs text-green-700 font-medium hover:underline"
          >
            Recibir mercancía →
          </NuxtLink>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th v-if="multiOcConsult || localOrdersList.length > 1" class="p-2 text-left">OC</th>
                <th class="p-2 text-left">Código</th>
                <th class="p-2 text-left">Producto</th>
                <th class="p-2 text-right">Cant. OC</th>
                <th class="p-2 text-right">Cant. CXC</th>
                <th class="p-2 text-right">Recibido</th>
                <th class="p-2 text-right">V. unitario</th>
                <th class="p-2 text-center">Unidad</th>
                <th class="p-2 text-right">Subtotal</th>
                <th class="p-2 text-center">Estado</th>
                <th v-if="multiOcConsult || localOrdersList.length > 1" class="p-2 text-center" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="line in mergedLocalLines"
                :key="`${line.ocNumber}-${line.id ?? line.productId}`"
                class="border-t border-slate-100"
              >
                <td v-if="multiOcConsult || localOrdersList.length > 1" class="p-2 font-mono text-xs text-indigo-700">
                  {{ line.ocNumber }}
                </td>
                <td class="p-2 font-mono text-xs text-slate-600">
                  {{ line.erpCode || line.productCode }}
                </td>
                <td class="p-2 text-slate-800 max-w-[200px]">
                  <span class="block truncate" :title="line.productName">{{ line.productName }}</span>
                </td>
                <td class="p-2 text-right tabular-nums">{{ formatQty(line.qtyOrdered) }}</td>
                <td class="p-2 text-right tabular-nums">{{ formatQty(line.qtyErp ?? line.qtyOrdered) }}</td>
                <td class="p-2 text-right tabular-nums">
                  <span>{{ formatQty(Number(line.qtyAlreadyReceived ?? 0)) }}</span>
                  <span
                    v-if="line.fulfillmentStatus === 'PARTIAL'"
                    class="text-amber-700 text-[10px]"
                  >
                    / {{ formatQty(line.qtyErp ?? line.qtyOrdered) }}
                  </span>
                </td>
                <td class="p-2 text-right tabular-nums">{{ formatMoney(Number(line.unitPrice ?? 0)) }}</td>
                <td class="p-2 text-center text-slate-600">{{ line.unit }}</td>
                <td class="p-2 text-right tabular-nums font-medium">
                  {{ formatMoney(Number(line.lineTotal ?? line.qtyOrdered * (line.unitPrice ?? 0))) }}
                </td>
                <td class="p-2 text-center">
                  <span
                    v-if="line.fulfillmentStatus"
                    class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700"
                  >
                    {{ fulfillmentLabels[line.fulfillmentStatus] ?? line.fulfillmentStatus }}
                  </span>
                  <span v-else class="text-slate-400">—</span>
                </td>
                <td v-if="multiOcConsult || localOrdersList.length > 1" class="p-2 text-center">
                  <NuxtLink
                    :to="receptionLink(line.ocNumber)"
                    class="text-green-600 text-xs hover:underline whitespace-nowrap"
                  >
                    Recibir →
                  </NuxtLink>
                </td>
              </tr>
            </tbody>
            <tfoot v-if="!multiOcConsult && localOrdersList.length === 1" class="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colspan="7" class="p-3 text-right text-xs font-medium text-slate-500 uppercase">Total</td>
                <td class="p-3 text-right font-bold text-slate-800 tabular-nums">
                  $ {{ formatMoney(localLinesTotal) }}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </template>

      <!-- ERP combinado -->
      <template v-if="hasMergedErp">
        <div class="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-slate-100 bg-indigo-50/60">
          <span class="text-xs font-medium text-indigo-900">
            ERP {{ erpIntegrationName }}
            <span class="font-normal text-indigo-700">
              · {{ mergedErpLines.length }} líneas · {{ ocEntries.length }} OC
            </span>
          </span>
          <div class="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              class="text-[10px] text-indigo-700 hover:underline"
              @click="showErpPanel = !showErpPanel"
            >
              {{ showErpPanel ? 'Ocultar' : 'Detalle' }}
            </button>
            <button
              v-if="singleErpEntry"
              type="button"
              class="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-medium disabled:opacity-50"
              :disabled="loadingErp"
              @click="importToReception"
            >
              {{ loadingErp ? '…' : 'Importar' }}
            </button>
          </div>
        </div>
        <p v-if="multiOcConsult" class="text-[10px] text-amber-800 px-3 py-1 border-b border-indigo-100">
          Varias OC: solo consulta. Importe cada una por separado.
        </p>
        <div v-show="showErpPanel" class="overflow-x-auto max-h-[min(70vh,520px)]">
          <table class="w-full text-[11px] border-collapse bg-white">
            <thead class="bg-indigo-100 text-indigo-900 sticky top-0">
              <tr>
                <th class="p-1.5 text-left">OC</th>
                <th class="p-1.5 text-left">CODIGO</th>
                <th class="p-1.5 text-left">DESCRIPCION</th>
                <th class="p-1.5 text-left">BODEGA</th>
                <th class="p-1.5 text-right">CANT_AUTO</th>
                <th class="p-1.5 text-right">VLR_UNITARIO</th>
                <th class="p-1.5 text-right">VALOR_TOTAL</th>
                <th class="p-1.5 text-left">NRO_LOTE</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, idx) in mergedErpLines"
                :key="`${row.ocNumber}-${idx}`"
                class="border-t border-slate-100"
              >
                <td class="p-1.5 font-mono text-indigo-800">{{ row.ocNumber }}</td>
                <td class="p-1.5 font-mono">{{ row.CODIGO }}</td>
                <td class="p-1.5 max-w-[140px] truncate" :title="row.DESCRIPCION">{{ row.DESCRIPCION }}</td>
                <td class="p-1.5 max-w-[100px] truncate text-indigo-900">
                  {{ erpWarehouseLabel(row) }}
                </td>
                <td class="p-1.5 text-right tabular-nums">{{ erpNum(row.CANT_AUTO) }}</td>
                <td class="p-1.5 text-right tabular-nums">{{ erpNum(row.VLR_UNITARIO) }}</td>
                <td class="p-1.5 text-right tabular-nums font-medium">{{ erpNum(row.VALOR_TOTAL) }}</td>
                <td class="p-1.5">{{ row.NRO_LOTE || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <p
        v-if="ocEntries.some((e) => e.error && !e.loading)"
        class="text-[10px] text-red-700 px-3 py-2 border-t border-slate-100"
      >
        <span v-for="(e, i) in ocEntries.filter((x) => x.error)" :key="e.number">
          <span v-if="i > 0"> · </span>
          <span class="font-mono">{{ e.number }}</span>: {{ e.error }}
        </span>
      </p>

      <p
        v-if="!loadingOc && !mergedLocalLines.length && !hasMergedErp && ocEntries.length"
        class="text-xs text-slate-500 text-center py-8"
      >
        Sin líneas en las OC consultadas.
      </p>
      <p v-else-if="!loadingOc && !ocEntries.length" class="text-xs text-slate-500 text-center py-8">
        Añada OC con + y pulse Buscar.
      </p>
    </div>

    <ComprasOpenOrdersTable
      v-show="activeTab === 'abiertas'"
      :orders="orders"
      :loading="loading"
      accumulate
      @consult="pickOrder"
    />
  </div>
</template>
