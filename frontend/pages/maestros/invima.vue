<script setup lang="ts">
import {
  formatInvimaDate,
  formatInvimaVencimiento,
  isInvimaRegistroVencido,
  type InvimaExpiredCheckRow,
} from '~/composables/useInvimaExpired'
import { medicamentosPosColLabel } from '~/composables/useMedicamentosPosColumns'
import {
  INVIMA_LIST_TYPE_ORDER,
  INVIMA_SOCRATA_PRESETS,
  MEDICAMENTOS_POS_DATASET_ID,
  type InvimaListType as InvimaPresetListType,
} from '~/composables/useInvimaSocrataPresets'
import {
  formatInvimaCell,
  INVIMA_COMPACT_COLUMNS,
  INVIMA_DATASET_COLUMNS,
  type InvimaTableColumn,
} from '~/composables/useInvimaColumns'
import type { ExpiredInvimaItem } from '~/components/maestros/InvimaExpiredAlertModal.vue'

definePageMeta({ layout: 'app', fullWidth: true })

const { fetchApi } = useApi()
const session = useSessionStore()

type ListType = 'VIGENTE' | 'VENCIDO' | 'RENOVACION' | 'OTRO_ESTADO' | ''

interface InvimaRow extends InvimaExpiredCheckRow {
  id: string
  listType: ListType
  expediente: string | null
  producto: string | null
  titular: string | null
  registroSanitario: string | null
  fechaExpedicion: string | null
  fechaVencimiento: string | null
  estadoRegistro: string | null
  expedienteCum: string | null
  consecutivoCum: string | null
  cantidadCum: string | null
  cumCodigo: string | null
  descripcionComercial: string | null
  estadoCum: string | null
  fechaActivo: string | null
  fechaInactivo: string | null
  muestraMedica: string | null
  unidad: string | null
  principioActivo: string | null
  concentracion: string | null
  unidadMedida: string | null
  cantidad: string | null
  unidadReferencia: string | null
  formaFarmaceutica: string | null
  viaAdministracion: string | null
  atc: string | null
  descripcionAtc: string | null
  nombreRol: string | null
  tipoRol: string | null
  modalidad: string | null
  ium: string | null
  isExpired?: boolean
}

interface SearchResult {
  items: InvimaRow[]
  total: number
  page: number
  limit: number
  countsByListType: { listType: string; count: number }[]
}

interface BatchRow {
  listType: string
  sourceFilename: string
  rowsImported: number
  importedAt: string
}

interface PosBatchRow {
  sourceFilename: string
  rowsImported: number
  importedAt: string
}

interface SyncCatalogItem {
  key: string
  listType?: InvimaPresetListType
  label: string
  datasetId: string
  rowsImported: number | null
  importedAt: string | null
  portalUpdatedAt: string | null
  portalMetadataError?: string
}

const q = ref('')
const cum = ref('')
const listType = ref<ListType>('')
const page = ref(1)
const loading = ref(false)
const error = ref('')
const result = ref<SearchResult | null>(null)
const batches = ref<BatchRow[]>([])
const posBatch = ref<PosBatchRow | null>(null)
const syncCatalog = ref<SyncCatalogItem[]>([])
const syncCatalogLoading = ref(false)
const syncMsg = ref('')
const syncAllRunning = ref(false)
const syncAllProgress = ref('')
const syncLoadingAny = computed(() =>
  syncAllRunning.value ||
  INVIMA_LIST_TYPE_ORDER.some((lt) => syncState.value[lt]?.loading) ||
  posSyncState.value.loading ||
  krystalosSyncState.value.loading,
)

interface ListSyncState {
  loading: boolean
  message: string
  ok: boolean | null
}

const syncState = ref<Record<InvimaPresetListType, ListSyncState>>(
  Object.fromEntries(
    INVIMA_LIST_TYPE_ORDER.map((lt) => [lt, { loading: false, message: '', ok: null }]),
  ) as Record<InvimaPresetListType, ListSyncState>,
)
const posSyncState = ref<ListSyncState>({ loading: false, message: '', ok: null })
const krystalosSyncState = ref<ListSyncState>({ loading: false, message: '', ok: null })
const expiredModalOpen = ref(false)
const expiredModalItems = ref<ExpiredInvimaItem[]>([])

const listLabels: Record<string, string> = {
  VIGENTE: 'Vigentes',
  VENCIDO: 'Medicamentos vencidos',
  RENOVACION: 'Trámite de renovación',
  OTRO_ESTADO: 'Otros estados',
}

const showFullDatasetColumns = computed(() => Boolean(listType.value))
const tableColumns = computed<InvimaTableColumn[]>(() =>
  showFullDatasetColumns.value ? INVIMA_DATASET_COLUMNS : INVIMA_COMPACT_COLUMNS,
)

const compactProductoCol: InvimaTableColumn = {
  key: 'producto',
  label: 'Producto',
  clean: true,
}
const compactDescripcionCol: InvimaTableColumn = {
  key: 'descripcionComercial',
  label: 'Descripción',
  clean: true,
}

function displayCompactCell(row: InvimaRow, col: InvimaTableColumn): string {
  return formatInvimaCell(row, col)
}

/** En referencia: vencidos/renovación ya vienen de su listado; no marcar como alerta operativa. */
function isReferenceRowExpired(row: InvimaRow): boolean {
  if (row.listType === 'VENCIDO' || row.listType === 'RENOVACION') return false
  return isInvimaRegistroVencido(row)
}

function buildExpiredModalItems(items: InvimaRow[]): ExpiredInvimaItem[] {
  const seen = new Set<string>()
  return items
    .filter(isReferenceRowExpired)
    .filter((row) => {
      const key = (row.cumCodigo ?? row.id).trim()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((row) => ({
      cumCodigo: row.cumCodigo,
      producto: row.producto,
      registroSanitario: row.registroSanitario,
      fechaVencimiento: row.fechaVencimiento,
      listType: row.listType,
      estadoRegistro: row.estadoRegistro,
    }))
}

async function search(resetPage = true) {
  if (resetPage) page.value = 1
  loading.value = true
  error.value = ''
  const params = new URLSearchParams()
  if (q.value.trim()) params.set('q', q.value.trim())
  if (cum.value.trim()) params.set('cum', cum.value.trim())
  if (listType.value) params.set('listType', listType.value)
  params.set('page', String(page.value))
  params.set('limit', '25')

  const { data, error: err } = await fetchApi<SearchResult>(
    `/masters/invima/search?${params.toString()}`,
  )
  loading.value = false
  if (err) {
    error.value = err
    result.value = null
    return
  }
  result.value = data
  const hasSpecificLookup = Boolean(q.value.trim() || cum.value.trim())
  const browsingVencidosOrRenovacion =
    listType.value === 'VENCIDO' || listType.value === 'RENOVACION'
  const modalItems = buildExpiredModalItems(data?.items ?? [])
  if (hasSpecificLookup && !browsingVencidosOrRenovacion && modalItems.length) {
    expiredModalItems.value = modalItems
    expiredModalOpen.value = true
  }
}

function rowExpired(row: InvimaRow) {
  return isReferenceRowExpired(row)
}

async function loadBatches() {
  const { data } = await fetchApi<BatchRow[]>('/masters/invima/batches')
  if (data) batches.value = data
}

async function loadPosBatches() {
  const { data } = await fetchApi<PosBatchRow[]>('/masters/medicamentos-pos/batches')
  posBatch.value = data?.[0] ?? null
}

async function loadSyncCatalog() {
  syncCatalogLoading.value = true
  const { data } = await fetchApi<{ items: SyncCatalogItem[] }>(
    '/integrations/external/socrata/sync-catalog',
  )
  syncCatalogLoading.value = false
  if (data?.items) {
    syncCatalog.value = data.items
    const posItem = data.items.find((i) => i.key === 'POS')
    posBatch.value =
      posItem?.rowsImported != null && posItem.importedAt
        ? {
            sourceFilename: '',
            rowsImported: posItem.rowsImported,
            importedAt: posItem.importedAt,
          }
        : posBatch.value
  }
  await loadBatches()
}

function syncCatalogRowLabel(item: SyncCatalogItem): string {
  if (item.key === 'KRYSTALOS') return item.label
  if (item.listType) return listLabels[item.listType] ?? item.label
  return item.label
}

function isPortalNewer(item: SyncCatalogItem): boolean {
  if (!item.portalUpdatedAt || !item.importedAt) return false
  return new Date(item.portalUpdatedAt).getTime() > new Date(item.importedAt).getTime()
}

async function runSyncListType(targetListType: InvimaPresetListType): Promise<boolean> {
  const label = listLabels[targetListType] ?? targetListType

  syncState.value[targetListType] = { loading: true, message: 'Sincronizando…', ok: null }

  const { data, error: err } = await fetchApi<{
    ok: boolean
    message?: string
    rowsImported?: number
    listType?: string
  }>(`/integrations/external/socrata/sync-invimaf/${targetListType}`, {
    method: 'POST',
    body: { replaceExisting: true },
  })

  if (err) {
    syncState.value[targetListType] = { loading: false, message: err, ok: false }
    error.value = err
    return false
  }

  syncState.value[targetListType] = {
    loading: false,
    message: data?.message ?? 'Completado',
    ok: data?.ok ?? false,
  }

  if (data?.ok) {
    syncMsg.value = data.message ?? `Listado ${label} actualizado`
    await loadSyncCatalog()
    if (listType.value === targetListType || !listType.value) {
      await search(false)
    }
    return true
  }

  return false
}

async function syncListType(targetListType: InvimaPresetListType) {
  const preset = INVIMA_SOCRATA_PRESETS.find((p) => p.listType === targetListType)
  const label = listLabels[targetListType] ?? targetListType
  if (
    !confirm(
      `¿Sincronizar listado «${label}» desde datos.gov.co?\n\n` +
        `Dataset: ${preset?.datasetId ?? '—'}\n` +
        'Se reemplazan solo los registros de este estado. Puede tardar varios minutos.',
    )
  ) {
    return
  }

  syncMsg.value = ''
  error.value = ''
  await runSyncListType(targetListType)
}

async function runSyncPos(): Promise<boolean> {
  posSyncState.value = { loading: true, message: 'Sincronizando…', ok: null }

  const { data, error: err } = await fetchApi<{
    ok: boolean
    message?: string
    rowsImported?: number
  }>('/integrations/external/socrata/sync-medicamentos-pos', {
    method: 'POST',
    body: { replaceExisting: true },
  })

  if (err) {
    posSyncState.value = { loading: false, message: err, ok: false }
    error.value = err
    return false
  }

  posSyncState.value = {
    loading: false,
    message: data?.message ?? 'Completado',
    ok: data?.ok ?? false,
  }

  if (data?.ok) {
    syncMsg.value = data.message ?? 'Medicamentos POS actualizados'
    await loadSyncCatalog()
    if (mainTab.value === 'pos') {
      await loadPos(false)
    }
    return true
  }

  return false
}

async function syncPosMedicamentos() {
  if (
    !confirm(
      `¿Sincronizar catálogo «Medicamentos POS» desde datos.gov.co?\n\n` +
        `Dataset: ${MEDICAMENTOS_POS_DATASET_ID}\n` +
        'Se reemplazan todos los registros POS locales. Puede tardar varios minutos.',
    )
  ) {
    return
  }

  syncMsg.value = ''
  error.value = ''
  await runSyncPos()
}

async function syncAllSequential() {
  if (syncAllRunning.value || syncLoadingAny.value) return

  const listSummary = INVIMA_LIST_TYPE_ORDER.map(
    (lt, i) => `${i + 1}. ${listLabels[lt] ?? lt}`,
  ).join('\n')
  const totalSteps = INVIMA_LIST_TYPE_ORDER.length + 1

  if (
    !confirm(
      `¿Sincronizar los ${totalSteps} catálogos uno tras otro?\n\n` +
        `${listSummary}\n` +
        `${totalSteps}. Medicamentos POS\n\n` +
        'El proceso puede tardar varios minutos. Se detendrá si un catálogo falla.',
    )
  ) {
    return
  }

  syncAllRunning.value = true
  syncAllProgress.value = ''
  syncMsg.value = ''
  error.value = ''

  const total = totalSteps
  let completed = 0

  for (const targetListType of INVIMA_LIST_TYPE_ORDER) {
    const label = listLabels[targetListType] ?? targetListType
    syncAllProgress.value = `${completed + 1}/${total}`
    syncMsg.value = `Sincronizando ${completed + 1} de ${total}: ${label}…`

    const ok = await runSyncListType(targetListType)
    if (!ok) {
      syncMsg.value =
        completed > 0
          ? `Detenido en «${label}». ${completed} listado${completed === 1 ? '' : 's'} completado${completed === 1 ? '' : 's'}.`
          : `Error al sincronizar «${label}».`
      syncAllRunning.value = false
      syncAllProgress.value = ''
      return
    }

    completed++
  }

  syncAllProgress.value = `${completed + 1}/${total}`
  syncMsg.value = `Sincronizando ${completed + 1} de ${total}: Medicamentos POS…`

  const posOk = await runSyncPos()
  if (!posOk) {
    syncMsg.value =
      completed > 0
        ? `Detenido en «Medicamentos POS». ${completed} catálogo${completed === 1 ? '' : 's'} INVIMA completado${completed === 1 ? '' : 's'}.`
        : 'Error al sincronizar «Medicamentos POS».'
    syncAllRunning.value = false
    syncAllProgress.value = ''
    return
  }

  completed++
  syncMsg.value = `Los ${completed} catálogos se sincronizaron correctamente.`
  await loadSyncCatalog()
  syncAllRunning.value = false
  syncAllProgress.value = ''
}

function batchForListType(listType: InvimaPresetListType) {
  return batches.value.find((b) => b.listType === listType)
}

function formatBatchDate(iso: string | undefined) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

const olderBatches = computed(() => {
  const latestKeys = new Set(
    INVIMA_SOCRATA_PRESETS.map((p) => batchForListType(p.listType)?.sourceFilename).filter(Boolean),
  )
  return batches.value.filter((b) => !latestKeys.has(b.sourceFilename)).slice(0, 12)
})

onMounted(async () => {
  await loadBatches()
})

watch(listType, () => {
  search()
})

function prevPage() {
  if (page.value > 1) {
    page.value--
    search(false)
  }
}

function nextPage() {
  if (result.value && page.value * result.value.limit < result.value.total) {
    page.value++
    search(false)
  }
}

type MainTab = 'invima-cum' | 'krystalos' | 'pos' | 'estados' | 'sync'
const mainTab = ref<MainTab>('invima-cum')

interface KrystalosSearchResult {
  ok: boolean
  items: Record<string, unknown>[]
  total: number
  page: number
  limit: number
  columns: string[]
  httpStatus?: number
  durationMs?: number
  url?: string
  integrationName?: string
  message?: string
}

const krystalosQ = ref('')
const krystalosPage = ref(1)
const krystalosLoading = ref(false)
const krystalosError = ref('')
const krystalosResult = ref<KrystalosSearchResult | null>(null)

const krystalosColumnLabels: Record<string, string> = {
  IDARTICULO: 'Código artículo',
  DESCRIPCION: 'Descripción',
  codcum: 'CUM',
}

function krystalosColLabel(col: string) {
  return krystalosColumnLabels[col] ?? col
}

async function loadKrystalos(resetPage = true, refresh = false) {
  if (resetPage) krystalosPage.value = 1
  krystalosLoading.value = true
  krystalosError.value = ''
  const params = new URLSearchParams()
  if (krystalosQ.value.trim()) params.set('q', krystalosQ.value.trim())
  params.set('page', String(krystalosPage.value))
  params.set('limit', '50')
  if (refresh) params.set('refresh', 'true')

  const { data, error: err } = await fetchApi<KrystalosSearchResult>(
    `/integrations/external/rest/krystalos-medicamentos?${params.toString()}`,
  )
  krystalosLoading.value = false
  if (err) {
    krystalosError.value = err
    krystalosResult.value = null
    return
  }
  krystalosResult.value = data
}

function krystalosPrevPage() {
  if (krystalosPage.value > 1) {
    krystalosPage.value--
    loadKrystalos(false)
  }
}

function krystalosNextPage() {
  if (
    krystalosResult.value &&
    krystalosPage.value * krystalosResult.value.limit < krystalosResult.value.total
  ) {
    krystalosPage.value++
    loadKrystalos(false)
  }
}

async function runSyncKrystalos(openView = true): Promise<boolean> {
  krystalosSyncState.value = { loading: true, message: 'Sincronizando…', ok: null }

  const { data, error: err } = await fetchApi<{
    ok: boolean
    message?: string
    rowsImported?: number
  }>('/integrations/external/rest/sync-krystalos-medicamentos', {
    method: 'POST',
    body: {},
  })

  if (err) {
    krystalosSyncState.value = { loading: false, message: err, ok: false }
    error.value = err
    return false
  }

  krystalosSyncState.value = {
    loading: false,
    message: data?.message ?? 'Completado',
    ok: data?.ok ?? false,
  }

  if (data?.ok) {
    syncMsg.value = data.message ?? 'Medicamentos Krystalos actualizados'
    await loadSyncCatalog()
    if (openView) {
      mainTab.value = 'krystalos'
      await loadKrystalos(true, false)
    }
    return true
  }

  return false
}

async function syncKrystalosMedicamentos() {
  if (
    !confirm(
      '¿Sincronizar catálogo «Medicamentos Krystalos» desde la API REST configurada?\n\n' +
        'Se actualiza la caché del servidor y se abrirá la vista Krystalos.',
    )
  ) {
    return
  }

  syncMsg.value = ''
  error.value = ''
  await runSyncKrystalos(true)
}

type PosSearchResult = KrystalosSearchResult

const posQ = ref('')
const posPage = ref(1)
const posLoading = ref(false)
const posError = ref('')
const posResult = ref<PosSearchResult | null>(null)

function formatPosCell(col: string, value: unknown): string {
  if (value == null || value === '') return '—'
  if (col === 'fechavencimiento') {
    const s = String(value)
    if (s.startsWith('3000-')) return 'Indefinido'
    return formatInvimaDate(s) ?? s
  }
  return String(value)
}

async function loadPos(resetPage = true) {
  if (resetPage) posPage.value = 1
  posLoading.value = true
  posError.value = ''
  const params = new URLSearchParams()
  if (posQ.value.trim()) params.set('q', posQ.value.trim())
  params.set('page', String(posPage.value))
  params.set('limit', '50')

  const { data, error: err } = await fetchApi<PosSearchResult>(
    `/masters/medicamentos-pos/search?${params.toString()}`,
  )
  posLoading.value = false
  if (err) {
    posError.value = err
    posResult.value = null
    return
  }
  posResult.value = data
}

function posPrevPage() {
  if (posPage.value > 1) {
    posPage.value--
    loadPos(false)
  }
}

function posNextPage() {
  if (
    posResult.value &&
    posPage.value * posResult.value.limit < posResult.value.total
  ) {
    posPage.value++
    loadPos(false)
  }
}

type EstadoFilterKey =
  | 'ALL'
  | 'MATCHED'
  | 'NOT_MATCHED'
  | 'VIGENTE'
  | 'VENCIDO'
  | 'RENOVACION'
  | 'OTRO'
  | 'SIN_CUM'

interface EstadoRow {
  idArticulo: string
  descripcion: string
  codcum: string | null
  invimaMatched: boolean
  invimaListType: string | null
  invimaEstadoRegistro: string | null
  invimaFechaVencimiento: string | null
  invimaProducto: string | null
  invimaRegistroSanitario: string | null
  invimaAtc: string | null
  invimaMatchCount: number
  estadoKey: string
  estadoLabel: string
  posMatched: boolean
  posLabel: 'Medicamento POS' | 'NO POS'
}

interface EstadosResult {
  ok: boolean
  items: EstadoRow[]
  total: number
  page: number
  limit: number
  totalPages?: number
  httpStatus?: number
  durationMs?: number
  integrationName?: string
  summary?: {
    total: number
    matched: number
    notMatched: number
    sinCum: number
    vigente: number
    vencido: number
    renovacion: number
    otro: number
    sinRegistro: number
    posMedicamento?: number
    noPos?: number
  }
}

const estadosQ = ref('')
const estadosCodigo = ref('')
const estadosCum = ref('')
const estadosDescripcion = ref('')
const estadosListType = ref('')
const estadosFilter = ref<EstadoFilterKey>('ALL')
const estadosPage = ref(1)
const estadosLimit = ref(50)
const estadosLoading = ref(false)
const estadosError = ref('')
const estadosResult = ref<EstadosResult | null>(null)

const estadosTotalPages = computed(() =>
  estadosResult.value?.totalPages ??
  (estadosResult.value
    ? Math.max(1, Math.ceil(estadosResult.value.total / estadosResult.value.limit))
    : 1),
)

const estadosPageRange = computed(() => {
  if (!estadosResult.value?.total) return { from: 0, to: 0 }
  const from = (estadosResult.value.page - 1) * estadosResult.value.limit + 1
  const to = Math.min(
    estadosResult.value.page * estadosResult.value.limit,
    estadosResult.value.total,
  )
  return { from, to }
})

const estadosSummaryChips = computed(() => {
  const s = estadosResult.value?.summary
  if (!s) return []
  return [
    { key: 'ALL' as EstadoFilterKey, label: 'Total', count: s.total, class: 'bg-slate-100 text-slate-700' },
    { key: 'VIGENTE' as EstadoFilterKey, label: 'Vigentes', count: s.vigente, class: 'bg-green-100 text-green-800' },
    { key: 'VENCIDO' as EstadoFilterKey, label: 'Vencidos', count: s.vencido, class: 'bg-red-100 text-red-800' },
    { key: 'RENOVACION' as EstadoFilterKey, label: 'Renovación', count: s.renovacion, class: 'bg-amber-100 text-amber-900' },
    { key: 'NOT_MATCHED' as EstadoFilterKey, label: 'Sin registro INVIMA', count: s.sinRegistro, class: 'bg-slate-200 text-slate-700' },
    ...(s.sinCum
      ? [{ key: 'SIN_CUM' as EstadoFilterKey, label: 'Sin CUM', count: s.sinCum, class: 'bg-slate-100 text-slate-600' }]
      : []),
  ]
})

function estadoBadgeClass(key: string): string {
  switch (key) {
    case 'VIGENTE':
      return 'bg-green-100 text-green-800'
    case 'VENCIDO':
      return 'bg-red-100 text-red-800'
    case 'RENOVACION':
      return 'bg-amber-100 text-amber-900'
    case 'SIN_REGISTRO':
    case 'SIN_CUM':
      return 'bg-slate-100 text-slate-600'
    default:
      return 'bg-blue-50 text-blue-800'
  }
}

function posBadgeClass(row: EstadoRow): string {
  return row.posMatched
    ? 'bg-teal-100 text-teal-800 ring-1 ring-teal-200'
    : 'bg-slate-100 text-slate-500'
}

function formatEstadoVence(row: EstadoRow): string {
  return formatInvimaVencimiento({
    listType: row.invimaListType ?? undefined,
    fechaVencimiento: row.invimaFechaVencimiento,
  })
}

async function loadEstados(resetPage = true, refresh = false) {
  if (resetPage) estadosPage.value = 1
  estadosLoading.value = true
  estadosError.value = ''
  const params = new URLSearchParams()
  if (estadosQ.value.trim()) params.set('q', estadosQ.value.trim())
  if (estadosCodigo.value.trim()) params.set('codigo', estadosCodigo.value.trim())
  if (estadosCum.value.trim()) params.set('cum', estadosCum.value.trim())
  if (estadosDescripcion.value.trim()) params.set('descripcion', estadosDescripcion.value.trim())
  if (estadosListType.value) params.set('listType', estadosListType.value)
  params.set('page', String(estadosPage.value))
  params.set('limit', String(estadosLimit.value))
  if (estadosFilter.value !== 'ALL') params.set('estado', estadosFilter.value)
  if (refresh) params.set('refresh', 'true')

  const { data, error: err } = await fetchApi<EstadosResult>(
    `/integrations/external/rest/krystalos-invimaf-estados?${params.toString()}`,
  )
  estadosLoading.value = false
  if (err) {
    estadosError.value = err
    estadosResult.value = null
    return
  }
  estadosResult.value = data
  if (data && estadosPage.value !== data.page) {
    estadosPage.value = data.page
  }
}

function applyEstadosChip(key: EstadoFilterKey) {
  estadosFilter.value = key
  loadEstados(true)
}

function clearEstadosFilters() {
  estadosQ.value = ''
  estadosCodigo.value = ''
  estadosCum.value = ''
  estadosDescripcion.value = ''
  estadosListType.value = ''
  estadosFilter.value = 'ALL'
  loadEstados(true)
}

function estadosGoToPage(page: number) {
  if (page < 1 || (estadosResult.value && page > estadosTotalPages.value)) return
  estadosPage.value = page
  loadEstados(false)
}

function estadosPrevPage() {
  estadosGoToPage(estadosPage.value - 1)
}

function estadosNextPage() {
  estadosGoToPage(estadosPage.value + 1)
}

watch(mainTab, (tab) => {
  if (tab === 'krystalos' && !krystalosResult.value) {
    loadKrystalos()
  }
  if (tab === 'pos' && !posResult.value) {
    loadPos()
  }
  if (tab === 'estados' && !estadosResult.value) {
    loadEstados()
  }
  if (tab === 'sync') {
    loadSyncCatalog()
  }
})

const estadosFiltersOpen = ref(false)

const estadosActiveFiltersCount = computed(() => {
  let n = 0
  if (estadosCodigo.value.trim()) n++
  if (estadosCum.value.trim()) n++
  if (estadosDescripcion.value.trim()) n++
  if (estadosQ.value.trim()) n++
  if (estadosListType.value) n++
  if (estadosFilter.value !== 'ALL') n++
  return n
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <NuxtLink to="/maestros" class="text-sm text-blue-600 hover:underline">← Maestros</NuxtLink>
      <h2 class="text-2xl font-bold text-slate-800 mt-2">Referencia INVIMA (código único)</h2>
    </div>

    <div class="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
      <button
        type="button"
        class="px-4 py-2 text-sm rounded-lg transition"
        :class="mainTab === 'invima-cum' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'"
        @click="mainTab = 'invima-cum'"
      >
        INVIMA CUM
      </button>
      <button
        type="button"
        class="px-4 py-2 text-sm rounded-lg transition"
        :class="mainTab === 'krystalos' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'"
        @click="mainTab = 'krystalos'"
      >
        Medicamentos Krystalos
      </button>
      <button
        type="button"
        class="px-4 py-2 text-sm rounded-lg transition"
        :class="mainTab === 'pos' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'"
        @click="mainTab = 'pos'"
      >
        Medicamentos POS
      </button>
      <button
        type="button"
        class="px-4 py-2 text-sm rounded-lg transition"
        :class="mainTab === 'estados' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'"
        @click="mainTab = 'estados'"
      >
        Estados
      </button>
      <button
        v-if="session.can('admin.users')"
        type="button"
        class="px-4 py-2 text-sm rounded-lg transition"
        :class="mainTab === 'sync' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'"
        @click="mainTab = 'sync'"
      >
        Sincronización
      </button>
    </div>

    <template v-if="mainTab === 'invima-cum'">
    <div
      class="rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 overflow-hidden flex flex-col min-h-[32rem]"
    >
      <div
        class="bg-gradient-to-r from-slate-800 via-slate-800 to-blue-900 px-4 py-3 flex flex-wrap items-center gap-2 gap-y-3"
      >
        <h3 class="text-white font-semibold text-sm shrink-0 mr-1">Registros INVIMA</h3>
        <div class="flex-1 min-w-[12rem] max-w-xl relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">⌕</span>
          <input
            v-model="q"
            type="search"
            placeholder="Producto, titular, registro, principio activo…"
            class="w-full pl-8 pr-3 py-2 rounded-lg bg-white/95 border-0 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:ring-2 focus:ring-blue-400 outline-none"
            @keyup.enter="search()"
          />
        </div>
        <input
          v-model="cum"
          type="search"
          placeholder="CUM"
          class="w-36 py-2 px-3 rounded-lg bg-white/10 border border-white/25 text-sm text-white placeholder:text-slate-300 font-mono focus:ring-2 focus:ring-blue-400 outline-none"
          @keyup.enter="search()"
        />
        <select
          v-model="listType"
          class="py-2 pl-3 pr-8 rounded-lg bg-white/10 border border-white/25 text-sm text-white focus:ring-2 focus:ring-blue-400 outline-none [&>option]:text-slate-800"
        >
          <option value="">Todos los listados</option>
          <option value="VIGENTE">Vigentes</option>
          <option value="VENCIDO">Medicamentos vencidos</option>
          <option value="RENOVACION">Trámite de renovación</option>
          <option value="OTRO_ESTADO">Otros estados</option>
        </select>
        <button
          type="button"
          class="shrink-0 bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm disabled:opacity-50 transition"
          :disabled="loading"
          @click="search()"
        >
          {{ loading ? '…' : 'Buscar' }}
        </button>
      </div>

      <div
        v-if="result?.countsByListType?.length || error"
        class="px-4 py-2 border-b border-slate-100 bg-slate-50/80 flex flex-wrap gap-2 items-center text-xs"
      >
        <span
          v-for="c in result?.countsByListType ?? []"
          :key="c.listType"
          class="bg-white border border-slate-200 px-2.5 py-1 rounded-full text-slate-600 shadow-sm"
        >
          {{ listLabels[c.listType] ?? c.listType }}: {{ c.count.toLocaleString() }}
        </span>
        <p v-if="error" class="text-red-600 ml-auto">{{ error }}</p>
      </div>

      <div class="px-4 py-2.5 border-b border-slate-100 flex flex-wrap justify-between items-center gap-2 bg-white">
        <span class="text-sm font-medium text-slate-700">
          <template v-if="result">
            {{ result.total.toLocaleString() }} resultado{{ result.total === 1 ? '' : 's' }}
            <span v-if="listType" class="text-slate-500 font-normal">
              · {{ listLabels[listType] ?? listType }}
            </span>
          </template>
          <template v-else>Sin búsqueda</template>
        </span>
        <div class="flex gap-1.5">
          <button
            type="button"
            class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
            :disabled="page <= 1 || loading"
            @click="prevPage"
          >
            Anterior
          </button>
          <button
            type="button"
            class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
            :disabled="!result || page * result.limit >= result.total || loading"
            @click="nextPage"
          >
            Siguiente
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-x-auto overflow-y-auto max-h-[calc(100vh-14rem)]">
        <table
          class="w-full text-sm border-collapse"
          :class="showFullDatasetColumns ? 'min-w-max' : ''"
        >
          <thead class="bg-slate-800 text-left text-[11px] text-slate-200 uppercase tracking-wider sticky top-0 z-10">
            <tr>
              <th
                v-for="col in tableColumns"
                :key="col.key"
                class="px-4 py-3.5 whitespace-nowrap font-semibold"
                :style="col.minWidth ? { minWidth: col.minWidth } : undefined"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="!result?.items?.length">
              <td :colspan="tableColumns.length" class="px-4 py-12 text-center text-slate-400">
                Sin datos. Sincronice desde integraciones INVIMA CUM en Configuración.
              </td>
            </tr>
            <tr
              v-for="row in result?.items ?? []"
              :key="row.id"
              class="hover:bg-blue-50/30 transition-colors"
              :class="!showFullDatasetColumns && rowExpired(row) ? 'bg-red-50/60' : ''"
            >
              <template v-if="showFullDatasetColumns">
                <td
                  v-for="col in tableColumns"
                  :key="col.key"
                  class="px-4 py-3.5 text-sm align-top"
                  :class="
                    col.wrap
                      ? 'whitespace-normal break-words leading-snug'
                      : 'whitespace-nowrap'
                  "
                  :style="col.minWidth ? { minWidth: col.minWidth } : undefined"
                >
                  <span
                    :class="col.key === 'producto' ? 'font-medium text-slate-800' : ''"
                  >
                    {{ formatInvimaCell(row, col) }}
                  </span>
                </td>
              </template>
              <template v-else>
                <td class="px-4 py-3.5 whitespace-nowrap">
                  <span class="text-xs font-medium px-2 py-0.5 rounded bg-slate-100">
                    {{ listLabels[row.listType] ?? row.listType }}
                  </span>
                </td>
                <td class="px-4 py-3.5 font-mono text-sm">{{ row.cumCodigo ?? '—' }}</td>
                <td
                  class="px-4 py-3.5 text-sm align-top min-w-[320px] whitespace-normal break-words leading-snug"
                >
                  <p class="font-medium text-slate-900">
                    {{ displayCompactCell(row, compactProductoCol) }}
                  </p>
                  <p
                    v-if="row.descripcionComercial"
                    class="text-xs text-slate-500 mt-0.5 break-words"
                  >
                    {{ displayCompactCell(row, compactDescripcionCol) }}
                  </p>
                </td>
                <td class="px-4 py-3.5 text-sm">{{ row.registroSanitario ?? '—' }}</td>
                <td class="px-4 py-3.5 text-sm whitespace-nowrap">
                  {{ formatInvimaVencimiento(row) }}
                </td>
                <td class="px-4 py-3.5 text-sm">
                  <span
                    v-if="rowExpired(row)"
                    class="text-xs font-medium px-2 py-0.5 rounded bg-red-100 text-red-800"
                  >
                    Vencido
                  </span>
                  <span v-else>{{ row.estadoRegistro ?? '—' }}</span>
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <MaestrosInvimaExpiredAlertModal
      v-model:open="expiredModalOpen"
      :items="expiredModalItems"
    />
    </template>

    <template v-else-if="mainTab === 'sync'">
    <div
      class="rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 overflow-hidden flex flex-col min-h-[32rem]"
    >
      <div class="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-white font-semibold text-sm">Sincronización (administrador)</h3>
        <div class="flex flex-wrap items-center gap-2 ml-auto">
          <p v-if="syncMsg" class="text-xs text-emerald-200 max-w-md text-right">
            {{ syncMsg }}
          </p>
          <button
            type="button"
            class="shrink-0 inline-flex items-center gap-2 bg-white text-indigo-900 hover:bg-indigo-50 px-4 py-2 rounded-lg text-sm font-medium shadow-sm disabled:opacity-50 transition"
            :disabled="syncLoadingAny"
            @click="syncAllSequential"
          >
            {{
              syncAllRunning
                ? `Sincronizando ${syncAllProgress}…`
                : 'Sincronizar todos (uno por uno)'
            }}
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-x-auto">
        <table class="w-full text-sm border-collapse min-w-[640px]">
          <thead class="bg-slate-800 text-left text-[11px] text-slate-200 uppercase tracking-wider sticky top-0 z-10">
            <tr>
              <th class="px-4 py-3.5 font-semibold">Listado</th>
              <th class="px-4 py-3.5 font-semibold w-28">Dataset</th>
              <th class="px-4 py-3.5 font-semibold w-28 text-right">Registros</th>
              <th class="px-4 py-3.5 font-semibold w-40">Última carga</th>
              <th class="px-4 py-3.5 font-semibold w-40">Actualización portal</th>
              <th class="px-4 py-3.5 font-semibold min-w-[12rem]">Estado</th>
              <th class="px-4 py-3.5 font-semibold w-32 text-right">Acción</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="syncCatalogLoading && !syncCatalog.length">
              <td colspan="7" class="px-4 py-8 text-center text-slate-400 text-sm">
                Consultando estado de sincronización…
              </td>
            </tr>
            <tr
              v-for="item in syncCatalog"
              :key="item.key"
              class="hover:bg-indigo-50/30 transition-colors"
              :class="item.key === 'POS' || item.key === 'KRYSTALOS' ? 'border-t border-slate-200' : ''"
            >
              <td class="px-4 py-3.5 font-medium text-slate-900">
                {{ syncCatalogRowLabel(item) }}
              </td>
              <td class="px-4 py-3.5 font-mono text-xs text-slate-500">
                {{ item.datasetId }}
              </td>
              <td class="px-4 py-3.5 text-right tabular-nums text-slate-800">
                <template v-if="item.rowsImported != null">
                  {{ item.rowsImported.toLocaleString() }}
                </template>
                <span v-else class="text-slate-400">—</span>
              </td>
              <td class="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                {{ formatBatchDate(item.importedAt ?? undefined) }}
              </td>
              <td class="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                <template v-if="item.key === 'KRYSTALOS'">
                  <span class="text-slate-400">—</span>
                </template>
                <template v-else>
                  <span
                    :title="item.portalMetadataError"
                    :class="item.portalMetadataError ? 'text-amber-700' : ''"
                  >
                    {{ formatBatchDate(item.portalUpdatedAt ?? undefined) }}
                  </span>
                  <span
                    v-if="isPortalNewer(item)"
                    class="ml-1.5 inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800"
                    title="El portal tiene datos más recientes que tu última carga local"
                  >
                    Portal más reciente
                  </span>
                </template>
              </td>
              <td class="px-4 py-3.5">
                <template v-if="item.key === 'KRYSTALOS'">
                  <span
                    v-if="krystalosSyncState.loading"
                    class="text-xs text-indigo-600 font-medium"
                  >
                    Sincronizando…
                  </span>
                  <span
                    v-else-if="krystalosSyncState.message"
                    class="text-xs"
                    :class="krystalosSyncState.ok === false ? 'text-red-600' : 'text-emerald-700'"
                  >
                    {{ krystalosSyncState.message }}
                  </span>
                  <span v-else-if="item.importedAt" class="text-xs text-slate-400">
                    Al día
                  </span>
                  <span v-else class="text-xs text-amber-700">Sin cargar</span>
                </template>
                <template v-else-if="item.key === 'POS'">
                  <span
                    v-if="posSyncState.loading"
                    class="text-xs text-indigo-600 font-medium"
                  >
                    Sincronizando…
                  </span>
                  <span
                    v-else-if="posSyncState.message"
                    class="text-xs"
                    :class="posSyncState.ok === false ? 'text-red-600' : 'text-emerald-700'"
                  >
                    {{ posSyncState.message }}
                  </span>
                  <span v-else-if="item.importedAt" class="text-xs text-slate-400">
                    Al día
                  </span>
                  <span v-else class="text-xs text-amber-700">Sin cargar</span>
                </template>
                <template v-else-if="item.listType">
                  <span
                    v-if="syncState[item.listType]?.loading"
                    class="text-xs text-indigo-600 font-medium"
                  >
                    Sincronizando…
                  </span>
                  <span
                    v-else-if="syncState[item.listType]?.message"
                    class="text-xs"
                    :class="syncState[item.listType]?.ok === false ? 'text-red-600' : 'text-emerald-700'"
                  >
                    {{ syncState[item.listType]?.message }}
                  </span>
                  <span v-else-if="item.importedAt" class="text-xs text-slate-400">
                    Al día
                  </span>
                  <span v-else class="text-xs text-amber-700">Sin cargar</span>
                </template>
              </td>
              <td class="px-4 py-3.5 text-right">
                <button
                  v-if="item.key === 'KRYSTALOS'"
                  type="button"
                  class="inline-flex items-center justify-center min-w-[6.5rem] bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition"
                  :disabled="syncLoadingAny"
                  @click="syncKrystalosMedicamentos"
                >
                  {{ krystalosSyncState.loading ? '…' : 'Sincronizar' }}
                </button>
                <button
                  v-else-if="item.key === 'POS'"
                  type="button"
                  class="inline-flex items-center justify-center min-w-[6.5rem] bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition"
                  :disabled="syncLoadingAny"
                  @click="syncPosMedicamentos"
                >
                  {{ posSyncState.loading ? '…' : 'Sincronizar' }}
                </button>
                <button
                  v-else-if="item.listType"
                  type="button"
                  class="inline-flex items-center justify-center min-w-[6.5rem] bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition"
                  :disabled="syncLoadingAny"
                  @click="syncListType(item.listType!)"
                >
                  {{
                    syncState[item.listType!]?.loading
                      ? '…'
                      : 'Sincronizar'
                  }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <details v-if="olderBatches.length" class="border-t border-slate-100">
        <summary class="px-4 py-2.5 text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-50 select-none">
          Cargas anteriores ({{ olderBatches.length }})
        </summary>
        <div class="overflow-x-auto border-t border-slate-100">
          <table class="w-full text-xs">
            <tbody class="divide-y divide-slate-50">
              <tr
                v-for="b in olderBatches"
                :key="b.sourceFilename + b.importedAt"
                class="text-slate-600"
              >
                <td class="px-4 py-2">{{ listLabels[b.listType] ?? b.listType }}</td>
                <td class="px-4 py-2 font-mono">{{ b.sourceFilename }}</td>
                <td class="px-4 py-2 text-right tabular-nums">{{ b.rowsImported?.toLocaleString() }}</td>
                <td class="px-4 py-2 whitespace-nowrap">{{ formatBatchDate(b.importedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
    </template>

    <template v-else-if="mainTab === 'estados'">
      <div
        class="rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 overflow-hidden flex flex-col min-h-[32rem]"
      >
        <div
          class="bg-gradient-to-r from-violet-900 via-violet-800 to-indigo-900 px-4 py-3 flex flex-wrap items-center gap-2 gap-y-3"
        >
          <h3 class="text-white font-semibold text-sm shrink-0">Estados del cruce</h3>
          <div class="flex-1 min-w-[12rem] max-w-md relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-violet-300 text-xs pointer-events-none">⌕</span>
            <input
              v-model="estadosQ"
              type="search"
              placeholder="Código, CUM, descripción o producto INVIMA…"
              class="w-full pl-8 pr-3 py-2 rounded-lg bg-white/95 border-0 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:ring-2 focus:ring-violet-400 outline-none"
              @keyup.enter="loadEstados(true)"
            />
          </div>
          <button
            type="button"
            class="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition"
            :class="
              estadosFiltersOpen
                ? 'bg-white text-violet-900 border-white shadow-sm'
                : 'bg-white/10 text-white border-white/25 hover:bg-white/20'
            "
            @click="estadosFiltersOpen = !estadosFiltersOpen"
          >
            Filtros
            <span
              v-if="estadosActiveFiltersCount"
              class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold"
              :class="estadosFiltersOpen ? 'bg-violet-600 text-white' : 'bg-white/30 text-white'"
            >
              {{ estadosActiveFiltersCount }}
            </span>
          </button>
          <button
            type="button"
            class="shrink-0 bg-violet-500 hover:bg-violet-400 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm disabled:opacity-50 transition"
            :disabled="estadosLoading"
            @click="loadEstados(true)"
          >
            {{ estadosLoading ? '…' : 'Buscar' }}
          </button>
          <button
            type="button"
            class="shrink-0 px-3 py-2 rounded-lg text-sm text-white/90 border border-white/25 hover:bg-white/10 disabled:opacity-50 transition"
            :disabled="estadosLoading"
            title="Refrescar datos desde API Krystalos"
            @click="loadEstados(true, true)"
          >
            ↻ API
          </button>
        </div>

        <div
          v-if="estadosSummaryChips.length"
          class="px-4 py-2.5 border-b border-slate-100 bg-slate-50/90 flex flex-wrap gap-2 overflow-x-auto"
        >
          <button
            v-for="chip in estadosSummaryChips"
            :key="chip.key"
            type="button"
            class="text-xs px-3 py-1.5 rounded-full transition shrink-0 shadow-sm"
            :class="[
              chip.class,
              estadosFilter === chip.key ? 'ring-2 ring-violet-500 ring-offset-1 font-semibold scale-[1.02]' : 'hover:opacity-90',
            ]"
            @click="applyEstadosChip(chip.key)"
          >
            {{ chip.label }}: {{ chip.count.toLocaleString() }}
          </button>
        </div>

        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <div
            v-show="estadosFiltersOpen"
            class="px-4 py-4 border-b border-violet-100 bg-gradient-to-br from-violet-50/90 via-white to-indigo-50/50"
          >
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label class="block group">
                <span class="text-[11px] font-medium uppercase tracking-wide text-slate-500 group-focus-within:text-violet-700">
                  Código Krystalos
                </span>
                <input
                  v-model="estadosCodigo"
                  type="search"
                  placeholder="Ej. MD0001"
                  class="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-mono shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none transition"
                  @keyup.enter="loadEstados(true)"
                />
              </label>
              <label class="block group">
                <span class="text-[11px] font-medium uppercase tracking-wide text-slate-500 group-focus-within:text-violet-700">
                  CUM
                </span>
                <input
                  v-model="estadosCum"
                  type="search"
                  placeholder="Ej. 20024307-1"
                  class="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-mono shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none transition"
                  @keyup.enter="loadEstados(true)"
                />
              </label>
              <label class="block group sm:col-span-2">
                <span class="text-[11px] font-medium uppercase tracking-wide text-slate-500 group-focus-within:text-violet-700">
                  Descripción Krystalos
                </span>
                <input
                  v-model="estadosDescripcion"
                  type="search"
                  placeholder="Nombre del medicamento…"
                  class="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none transition"
                  @keyup.enter="loadEstados(true)"
                />
              </label>
              <label class="block group">
                <span class="text-[11px] font-medium uppercase tracking-wide text-slate-500 group-focus-within:text-violet-700">
                  Estado cruce
                </span>
                <select
                  v-model="estadosFilter"
                  class="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm shadow-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none transition"
                  @change="loadEstados(true)"
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="VIGENTE">Solo vigentes</option>
                  <option value="VENCIDO">Solo vencidos</option>
                  <option value="RENOVACION">En renovación</option>
                  <option value="OTRO">Otros estados</option>
                  <option value="NOT_MATCHED">Sin registro INVIMA</option>
                  <option value="MATCHED">Con match INVIMA</option>
                  <option value="SIN_CUM">Sin CUM en Krystalos</option>
                </select>
              </label>
              <label class="block group">
                <span class="text-[11px] font-medium uppercase tracking-wide text-slate-500 group-focus-within:text-violet-700">
                  Listado INVIMA
                </span>
                <select
                  v-model="estadosListType"
                  class="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm shadow-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none transition"
                  @change="loadEstados(true)"
                >
                  <option value="">Todos los listados</option>
                  <option value="VIGENTE">Vigentes</option>
                  <option value="VENCIDO">Medicamentos vencidos</option>
                  <option value="RENOVACION">Trámite de renovación</option>
                  <option value="OTRO_ESTADO">Otros estados</option>
                </select>
              </label>
              <label class="block group sm:col-span-2 lg:col-span-1">
                <span class="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Filas por página
                </span>
                <select
                  v-model.number="estadosLimit"
                  class="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm shadow-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none transition"
                  @change="loadEstados(true)"
                >
                  <option :value="25">25</option>
                  <option :value="50">50</option>
                  <option :value="100">100</option>
                </select>
              </label>
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                class="text-sm text-violet-700 hover:text-violet-900 font-medium"
                @click="clearEstadosFilters"
              >
                Limpiar filtros
              </button>
              <p v-if="estadosError" class="text-sm text-red-600 ml-auto">{{ estadosError }}</p>
            </div>
          </div>
        </Transition>

        <div class="px-4 py-2.5 border-b border-slate-100 flex flex-wrap justify-between items-center gap-2 bg-white">
          <div class="text-sm text-slate-700">
            <template v-if="estadosResult?.total">
              <span class="font-semibold">{{ estadosResult.total.toLocaleString() }}</span>
              resultado{{ estadosResult.total === 1 ? '' : 's' }}
              <span v-if="estadosFilter !== 'ALL'" class="text-violet-600 font-normal">(filtrado)</span>
              <span class="text-slate-500 font-normal text-xs ml-2">
                {{ estadosPageRange.from.toLocaleString() }}–{{ estadosPageRange.to.toLocaleString() }}
                · pág. {{ estadosResult.page }}/{{ estadosTotalPages }}
              </span>
            </template>
            <span v-else-if="estadosLoading" class="text-slate-400">Cargando…</span>
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              class="text-sm px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              :disabled="estadosPage <= 1 || estadosLoading"
              title="Primera página"
              @click="estadosGoToPage(1)"
            >
              «
            </button>
            <button
              type="button"
              class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              :disabled="estadosPage <= 1 || estadosLoading"
              @click="estadosPrevPage"
            >
              Anterior
            </button>
            <span class="text-sm text-slate-600 min-w-[3.5rem] text-center font-medium">
              {{ estadosPage }}/{{ estadosTotalPages }}
            </span>
            <button
              type="button"
              class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              :disabled="estadosPage >= estadosTotalPages || estadosLoading"
              @click="estadosNextPage"
            >
              Siguiente
            </button>
            <button
              type="button"
              class="text-sm px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              :disabled="estadosPage >= estadosTotalPages || estadosLoading"
              title="Última página"
              @click="estadosGoToPage(estadosTotalPages)"
            >
              »
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-x-auto overflow-y-auto max-h-[calc(100vh-14rem)]">
          <table class="w-full text-sm border-collapse min-w-[960px]">
            <thead class="bg-slate-800 text-left text-[11px] text-slate-200 uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th class="px-4 py-3.5 w-36 font-semibold whitespace-nowrap">Medicamento POS</th>
                <th class="px-4 py-3.5 w-16 text-center font-semibold">Match</th>
                <th class="px-4 py-3.5 w-28 font-semibold">Cód. Krystalos</th>
                <th class="px-4 py-3.5 min-w-[260px] font-semibold">Descripción Krystalos</th>
                <th class="px-4 py-3.5 w-32 font-semibold">CUM</th>
                <th class="px-4 py-3.5 w-36 font-semibold">Estado</th>
                <th class="px-4 py-3.5 w-40 font-semibold">Listado INVIMA</th>
                <th class="px-4 py-3.5 w-28 font-semibold">Vence</th>
                <th class="px-4 py-3.5 min-w-[220px] font-semibold">Producto INVIMA</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="estadosLoading && !estadosResult?.items?.length">
                <td colspan="9" class="px-4 py-12 text-center text-slate-400">
                  Cruzando CUM con INVIMA…
                </td>
              </tr>
              <tr v-else-if="!estadosResult?.items?.length">
                <td colspan="9" class="px-4 py-12 text-center text-slate-400">
                  No hay resultados con los filtros actuales.
                </td>
              </tr>
              <tr
                v-for="(row, idx) in estadosResult?.items ?? []"
                :key="`${row.idArticulo}-${row.codcum}-${idx}`"
                class="hover:bg-violet-50/40 transition-colors"
                :class="{
                  'bg-red-50/60': row.estadoKey === 'VENCIDO',
                  'bg-slate-50/80': row.estadoKey === 'SIN_REGISTRO' || row.estadoKey === 'SIN_CUM',
                  'bg-emerald-50/40': row.estadoKey === 'VIGENTE',
                }"
              >
                <td class="px-4 py-3.5 whitespace-nowrap">
                  <span
                    class="inline-block font-medium px-2.5 py-1 rounded-full text-xs"
                    :class="posBadgeClass(row)"
                    :title="row.invimaAtc ? `ATC INVIMA: ${row.invimaAtc}` : 'Sin ATC en registro INVIMA'"
                  >
                    {{ row.posLabel }}
                  </span>
                </td>
                <td class="px-4 py-3.5 text-center">
                  <span
                    v-if="row.invimaMatched"
                    class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold shadow-sm"
                    title="CUM encontrado en INVIMA"
                  >
                    ✓
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-400 text-xs"
                    title="Sin coincidencia INVIMA"
                  >
                    —
                  </span>
                </td>
                <td class="px-4 py-3.5 font-mono text-sm whitespace-nowrap text-slate-900">
                  {{ row.idArticulo || '—' }}
                </td>
                <td class="px-4 py-3.5 text-sm align-top whitespace-normal break-words leading-snug text-slate-900">
                  {{ row.descripcion || '—' }}
                </td>
                <td class="px-4 py-3.5 font-mono text-sm whitespace-nowrap">
                  <span :class="row.codcum ? 'text-slate-900' : 'text-slate-400'">
                    {{ row.codcum || '—' }}
                  </span>
                </td>
                <td class="px-4 py-3.5 whitespace-nowrap">
                  <span
                    class="inline-block font-medium px-2.5 py-1 rounded-full text-xs"
                    :class="estadoBadgeClass(row.estadoKey)"
                  >
                    {{ row.estadoLabel }}
                  </span>
                </td>
                <td class="px-4 py-3.5 text-sm whitespace-nowrap">
                  <span
                    v-if="row.invimaListType"
                    class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs"
                  >
                    {{ listLabels[row.invimaListType] ?? row.invimaListType }}
                  </span>
                  <span v-else class="text-slate-400">—</span>
                </td>
                <td class="px-4 py-3.5 text-sm whitespace-nowrap text-slate-700">
                  {{ row.invimaMatched ? formatEstadoVence(row) : '—' }}
                </td>
                <td class="px-4 py-3.5 text-sm align-top whitespace-normal break-words leading-snug text-slate-600">
                  {{ row.invimaProducto ?? '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <template v-else-if="mainTab === 'krystalos'">
      <div
        class="rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 overflow-hidden flex flex-col min-h-[32rem]"
      >
        <div
          class="bg-gradient-to-r from-amber-800 via-amber-700 to-orange-800 px-4 py-3 flex flex-wrap items-center gap-2 gap-y-3"
        >
          <h3 class="text-white font-semibold text-sm shrink-0">Medicamentos Krystalos</h3>
          <div class="flex-1 min-w-[12rem] max-w-xl relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-amber-200 text-xs pointer-events-none">⌕</span>
            <input
              v-model="krystalosQ"
              type="search"
              placeholder="Código artículo, descripción o CUM…"
              class="w-full pl-8 pr-3 py-2 rounded-lg bg-white/95 border-0 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:ring-2 focus:ring-amber-400 outline-none"
              @keyup.enter="loadKrystalos(true, true)"
            />
          </div>
          <button
            type="button"
            class="shrink-0 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm disabled:opacity-50 transition"
            :disabled="krystalosLoading"
            @click="loadKrystalos(true, true)"
          >
            {{ krystalosLoading ? '…' : 'Buscar / Actualizar' }}
          </button>
        </div>

        <div
          v-if="krystalosError"
          class="px-4 py-2 border-b border-slate-100 bg-slate-50/80 flex flex-wrap items-center gap-2 text-xs"
        >
          <p class="text-red-600">{{ krystalosError }}</p>
        </div>

        <div class="px-4 py-2.5 border-b border-slate-100 flex flex-wrap justify-between items-center gap-2 bg-white">
          <span class="text-sm font-medium text-slate-700">
            <template v-if="krystalosResult">
              {{ krystalosResult.total.toLocaleString() }} medicamento{{ krystalosResult.total === 1 ? '' : 's' }}
            </template>
            <template v-else-if="krystalosLoading">Consultando…</template>
            <template v-else>Sin datos</template>
          </span>
          <div class="flex gap-1.5">
            <button
              type="button"
              class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              :disabled="krystalosPage <= 1 || krystalosLoading"
              @click="krystalosPrevPage"
            >
              Anterior
            </button>
            <button
              type="button"
              class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              :disabled="
                !krystalosResult ||
                krystalosPage * krystalosResult.limit >= krystalosResult.total ||
                krystalosLoading
              "
              @click="krystalosNextPage"
            >
              Siguiente
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-x-auto overflow-y-auto max-h-[calc(100vh-14rem)]">
          <table class="w-full text-sm border-collapse">
            <thead class="bg-slate-800 text-left text-[11px] text-slate-200 uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th
                  v-for="col in krystalosResult?.columns ?? ['IDARTICULO', 'DESCRIPCION', 'codcum']"
                  :key="col"
                  class="px-4 py-3.5 whitespace-nowrap font-semibold"
                >
                  {{ krystalosColLabel(col) }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="!krystalosResult?.items?.length && !krystalosLoading">
                <td
                  :colspan="(krystalosResult?.columns ?? ['IDARTICULO', 'DESCRIPCION', 'codcum']).length"
                  class="px-4 py-12 text-center text-slate-400"
                >
                  {{ krystalosError ? 'Error al consultar.' : 'Pulse Buscar / Actualizar para cargar el catálogo.' }}
                </td>
              </tr>
              <tr v-if="krystalosLoading && !krystalosResult?.items?.length">
                <td
                  :colspan="3"
                  class="px-4 py-12 text-center text-slate-400"
                >
                  Consultando API…
                </td>
              </tr>
              <tr
                v-for="(row, idx) in krystalosResult?.items ?? []"
                :key="idx"
                class="hover:bg-amber-50/40 transition-colors"
              >
                <td
                  v-for="col in krystalosResult?.columns ?? []"
                  :key="col"
                  class="px-4 py-3.5 align-top text-sm"
                  :class="col === 'DESCRIPCION' ? 'min-w-[320px] whitespace-normal break-words text-slate-900' : 'whitespace-nowrap font-mono text-slate-800'"
                >
                  {{ row[col] ?? '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <template v-else-if="mainTab === 'pos'">
      <div
        class="rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 overflow-hidden flex flex-col min-h-[32rem]"
      >
        <div
          class="bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 px-4 py-3 flex flex-wrap items-center gap-2 gap-y-3"
        >
          <h3 class="text-white font-semibold text-sm shrink-0">Medicamentos POS</h3>
          <div class="flex-1 min-w-[12rem] max-w-xl relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-teal-200 text-xs pointer-events-none">⌕</span>
            <input
              v-model="posQ"
              type="search"
              placeholder="Producto, principio activo, expediente, titular…"
              class="w-full pl-8 pr-3 py-2 rounded-lg bg-white/95 border-0 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:ring-2 focus:ring-teal-400 outline-none"
              @keyup.enter="loadPos()"
            />
          </div>
          <button
            type="button"
            class="shrink-0 bg-teal-500 hover:bg-teal-400 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm disabled:opacity-50 transition"
            :disabled="posLoading"
            @click="loadPos()"
          >
            {{ posLoading ? '…' : 'Buscar' }}
          </button>
        </div>

        <div
          v-if="posError"
          class="px-4 py-2 border-b border-slate-100 bg-slate-50/80 flex flex-wrap items-center gap-2 text-xs"
        >
          <p class="text-red-600">{{ posError }}</p>
        </div>

        <div class="px-4 py-2.5 border-b border-slate-100 flex flex-wrap justify-between items-center gap-2 bg-white">
          <span class="text-sm font-medium text-slate-700">
            <template v-if="posResult">
              {{ posResult.total.toLocaleString() }} registro{{ posResult.total === 1 ? '' : 's' }} POS
            </template>
            <template v-else-if="posLoading">Buscando…</template>
            <template v-else>Sin búsqueda</template>
          </span>
          <div class="flex gap-1.5">
            <button
              type="button"
              class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              :disabled="posPage <= 1 || posLoading"
              @click="posPrevPage"
            >
              Anterior
            </button>
            <button
              type="button"
              class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              :disabled="
                !posResult ||
                posPage * posResult.limit >= posResult.total ||
                posLoading
              "
              @click="posNextPage"
            >
              Siguiente
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-x-auto overflow-y-auto max-h-[calc(100vh-14rem)]">
          <table class="w-full text-sm border-collapse min-w-max">
            <thead class="bg-slate-800 text-left text-[11px] text-slate-200 uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th
                  v-for="col in posResult?.columns ?? ['producto', 'principioactivo', 'expediente', 'estadoregistro']"
                  :key="col"
                  class="px-4 py-3.5 whitespace-nowrap font-semibold"
                >
                  {{ medicamentosPosColLabel(col) }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="!posResult?.items?.length && !posLoading">
                <td
                  :colspan="(posResult?.columns ?? ['producto']).length"
                  class="px-4 py-12 text-center text-slate-400"
                >
                  {{ posError ? 'Error al consultar.' : 'Sin datos. Sincronice desde la pestaña Sincronización.' }}
                </td>
              </tr>
              <tr v-if="posLoading && !posResult?.items?.length">
                <td
                  :colspan="4"
                  class="px-4 py-12 text-center text-slate-400"
                >
                  Cargando registros POS…
                </td>
              </tr>
              <tr
                v-for="(row, idx) in posResult?.items ?? []"
                :key="idx"
                class="hover:bg-teal-50/40 transition-colors"
              >
                <td
                  v-for="col in posResult?.columns ?? []"
                  :key="col"
                  class="px-4 py-3.5 align-top text-sm text-slate-800"
                  :class="
                    ['producto', 'principioactivo', 'descripcioncomercial', 'nombrerol'].includes(col)
                      ? 'min-w-[200px] whitespace-normal break-words'
                      : 'whitespace-nowrap'
                  "
                >
                  {{ formatPosCell(col, row[col]) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
