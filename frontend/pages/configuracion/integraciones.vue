<script setup lang="ts">
definePageMeta({ layout: 'app' })

import {
  applyInvimaSocrataPreset,
  applyMedicamentosPosPreset,
  INVIMA_LIST_TYPE_ORDER,
  INVIMA_SOCRATA_PRESETS,
  INVIMA_SOQL,
  type InvimaListType,
  type InvimaSocrataPresetKey,
} from '~/composables/useInvimaSocrataPresets'

const { fetchApi } = useApi()
const session = useSessionStore()
const apiBase = useApiBase()

type TabId = 'list' | 'new' | 'poll'
const activeTab = ref<TabId>('list')

const error = ref<string | null>(null)
const msg = ref('')
const showAdvanced = ref(false)

type AuthMethod = 'NONE' | 'API_KEY' | 'BEARER' | 'BASIC'
type IntegrationKind = 'ERP_PURCHASE_ORDER' | 'SOCRATA_OPEN_DATA' | 'REST_QUERY'
type SocrataApiVersion = 'SODA2' | 'SODA3'
type SyncTarget = 'NONE' | 'INVIMA_REGISTROS'

const INVIMA_SOQL_TEMPLATE = INVIMA_SOQL

type IntegrationRow = {
  id: string
  name: string
  isActive: boolean
  integrationKind: IntegrationKind
  baseUrl: string
  internalNotes?: string | null
  authMethod: AuthMethod
  authHeaderName?: string | null
  hasSecret: boolean
  authUsername?: string | null
  poPathTemplate?: string | null
  socrataDatasetId?: string | null
  socrataApiVersion?: SocrataApiVersion | null
  socrataQuery?: string | null
  socrataPageSize?: number
  syncTarget?: SyncTarget
  invimaListType?: InvimaListType | null
  createdAt: string
  updatedAt: string
  lastPollAt?: string | null
}

const integrations = ref<IntegrationRow[]>([])
const loading = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const editingHasSecret = ref(false)
const invimaPresetKey = ref<InvimaSocrataPresetKey>('VIGENTE')

const form = ref({
  integrationKind: 'ERP_PURCHASE_ORDER' as IntegrationKind,
  name: '',
  isActive: true,
  baseUrl: 'https://',
  internalNotes: '',
  authMethod: 'NONE' as AuthMethod,
  authHeaderName: 'x-api-key',
  authSecret: '',
  authUsername: '',
  poPathTemplate: '?consecutivo={number}',
  socrataDatasetId: '',
  socrataApiVersion: 'SODA3' as SocrataApiVersion,
  socrataQuery: INVIMA_SOQL_TEMPLATE,
  socrataPageSize: 1000,
  syncTarget: 'NONE' as SyncTarget,
  invimaListType: 'VIGENTE' as InvimaListType,
})

const pollIntegrationId = ref('')
const pollOc = ref('0100000017')
const pollLoading = ref(false)
const pollResult = ref<{
  ok: boolean
  httpStatus: number
  durationMs: number
  url?: string
  mapped?: unknown
  rawPreview?: unknown
  source?: string
  message?: string
} | null>(null)
const showRawPreview = ref(false)

const restPreview = ref<{
  ok: boolean
  httpStatus: number
  durationMs: number
  url?: string
  rowCount: number
  columns: string[]
  rows: Record<string, unknown>[]
  message?: string
} | null>(null)
const restLoading = ref(false)

const socrataLoading = ref(false)
const socrataSyncing = ref(false)
const socrataPreview = ref<{
  ok: boolean
  httpStatus: number
  durationMs: number
  url?: string
  rowCount: number
  columns: string[]
  rows: Record<string, unknown>[]
  sampleMapped?: unknown[]
  message?: string
} | null>(null)
const socrataSyncResult = ref<{
  ok: boolean
  rowsImported?: number
  rowsFetched?: number
  durationMs?: number
  message?: string
} | null>(null)

type BulkSyncItem = {
  integrationId: string
  integrationName: string
  listType: string
  ok: boolean
  rowsImported?: number
  durationMs?: number
  message?: string
}

const bulkInvimaSyncing = ref(false)
const bulkSyncProgress = ref('')
const bulkInvimaSyncResult = ref<{
  ok: boolean
  integrationsProcessed: number
  integrationsOk: number
  totalRowsImported: number
  durationMs: number
  message: string
  results: BulkSyncItem[]
} | null>(null)

const hrStatus = ref<{ source: string; count: number } | null>(null)
const syncing = ref(false)
const hisPayload = ref({
  externalId: 'RX-HIS-001',
  patientId: 'PAC-1001',
  doctorId: 'DOC-01',
  lines: [{ productCode: '10014', doseQty: 2, doseUnit: 'TAB' }],
})

const kindLabels: Record<IntegrationKind, string> = {
  ERP_PURCHASE_ORDER: 'ERP ? Sondeo OC',
  SOCRATA_OPEN_DATA: 'Datos abiertos ? Socrata',
  REST_QUERY: 'REST ? Consulta directa',
}

const authMethodLabels: Record<AuthMethod, string> = {
  NONE: 'Sin autenticaci?n',
  API_KEY: 'API Key (header)',
  BEARER: 'Bearer token',
  BASIC: 'Basic Auth',
}

const selectedPollIntegration = computed(() =>
  integrations.value.find((i) => i.id === pollIntegrationId.value),
)

const isSocrataPoll = computed(
  () => selectedPollIntegration.value?.integrationKind === 'SOCRATA_OPEN_DATA',
)

const isRestPoll = computed(() => {
  const row = selectedPollIntegration.value
  if (!row) return false
  if (row.integrationKind === 'REST_QUERY') return true
  return (
    row.integrationKind === 'ERP_PURCHASE_ORDER' &&
    row.authMethod === 'API_KEY' &&
    !row.poPathTemplate?.trim()
  )
})

const isErpPoll = computed(() => {
  const row = selectedPollIntegration.value
  if (!row) return false
  if (row.integrationKind !== 'ERP_PURCHASE_ORDER') return false
  return !(
    row.authMethod === 'API_KEY' &&
    !row.poPathTemplate?.trim()
  )
})

const showPoPathTemplate = computed(
  () =>
    form.value.integrationKind === 'ERP_PURCHASE_ORDER' &&
    form.value.authMethod !== 'API_KEY',
)

const activeInvimaIntegrations = computed(() =>
  integrations.value.filter(
    (i) =>
      i.isActive &&
      i.integrationKind === 'SOCRATA_OPEN_DATA' &&
      i.syncTarget === 'INVIMA_REGISTROS',
  ),
)

/** Solo integraciones INVIMA CUM (Socrata ? INVIMA) muestran sync en vista previa. */
const isInvimaCumPoll = computed(
  () =>
    isSocrataPoll.value &&
    selectedPollIntegration.value?.syncTarget === 'INVIMA_REGISTROS',
)

const showInvimaBulkSync = computed(
  () => isInvimaCumPoll.value && activeInvimaIntegrations.value.length > 0,
)

const invimaIntegrationsMissingToken = computed(() =>
  activeInvimaIntegrations.value.filter((i) => !i.hasSecret),
)

function applySocrataDefaults(presetKey: InvimaSocrataPresetKey = 'VIGENTE') {
  invimaPresetKey.value = presetKey
  form.value.socrataApiVersion = 'SODA3'
  form.value.socrataPageSize = 1000
  applyInvimaSocrataPreset(presetKey, form.value)
}

function onInvimaPresetChange() {
  if (invimaPresetKey.value === 'CUSTOM') return
  applySocrataDefaults(invimaPresetKey.value)
}

function applyPosPresetToForm() {
  form.value.integrationKind = 'SOCRATA_OPEN_DATA'
  applyMedicamentosPosPreset(form.value)
  invimaPresetKey.value = 'CUSTOM'
}

function onAuthMethodChange() {
  if (
    form.value.integrationKind === 'ERP_PURCHASE_ORDER' &&
    form.value.authMethod === 'API_KEY'
  ) {
    form.value.poPathTemplate = ''
  } else if (
    form.value.integrationKind === 'ERP_PURCHASE_ORDER' &&
    !form.value.poPathTemplate?.trim()
  ) {
    form.value.poPathTemplate = '?consecutivo={number}'
  }
}

function onKindChange() {
  if (form.value.integrationKind === 'SOCRATA_OPEN_DATA') {
    applySocrataDefaults('VIGENTE')
  } else if (form.value.integrationKind === 'REST_QUERY') {
    form.value.authMethod = 'BEARER'
    form.value.poPathTemplate = ''
    if (form.value.baseUrl.includes('datos.gov.co')) {
      form.value.baseUrl = 'https://'
    }
  } else {
    form.value.baseUrl = form.value.baseUrl.includes('datos.gov.co')
      ? 'https://'
      : form.value.baseUrl
    form.value.poPathTemplate = '?consecutivo={number}'
  }
}

function resetForm() {
  editingId.value = null
  editingHasSecret.value = false
  invimaPresetKey.value = 'VIGENTE'
  form.value = {
    integrationKind: 'ERP_PURCHASE_ORDER',
    name: '',
    isActive: true,
    baseUrl: 'https://',
    internalNotes: '',
    authMethod: 'NONE',
    authHeaderName: 'x-api-key',
    authSecret: '',
    authUsername: '',
    poPathTemplate: '?consecutivo={number}',
    socrataDatasetId: '',
    socrataApiVersion: 'SODA3',
    socrataQuery: INVIMA_SOQL_TEMPLATE,
    socrataPageSize: 1000,
    syncTarget: 'NONE',
    invimaListType: 'VIGENTE',
  }
}

async function loadIntegrations() {
  loading.value = true
  const { data, error: err } = await fetchApi<IntegrationRow[]>('/integrations/external')
  loading.value = false
  if (err) error.value = err
  else if (data) integrations.value = data
}

onMounted(async () => {
  if (!session.can('admin.users')) return
  await loadIntegrations()
  const { data } = await fetchApi<{ source: string; count: number }>('/integrations/hr/status')
  if (data) hrStatus.value = data
})

function startEdit(row: IntegrationRow) {
  editingId.value = row.id
  editingHasSecret.value = row.hasSecret
  form.value = {
    integrationKind: row.integrationKind,
    name: row.name,
    isActive: row.isActive,
    baseUrl: row.baseUrl,
    internalNotes: row.internalNotes ?? '',
    authMethod: row.authMethod,
    authHeaderName: row.authHeaderName ?? 'x-api-key',
    authSecret: '',
    authUsername: row.authUsername ?? '',
    poPathTemplate:
      row.integrationKind === 'ERP_PURCHASE_ORDER' && row.authMethod === 'API_KEY'
        ? (row.poPathTemplate ?? '')
        : (row.poPathTemplate ?? '?consecutivo={number}'),
    socrataDatasetId: row.socrataDatasetId ?? '',
    socrataApiVersion: row.socrataApiVersion ?? 'SODA3',
    socrataQuery: row.socrataQuery ?? INVIMA_SOQL_TEMPLATE,
    socrataPageSize: row.socrataPageSize ?? 1000,
    syncTarget: row.syncTarget ?? 'NONE',
    invimaListType: row.invimaListType ?? 'VIGENTE',
  }
  activeTab.value = 'new'
  const preset = INVIMA_SOCRATA_PRESETS.find((p) => p.datasetId === row.socrataDatasetId)
  invimaPresetKey.value = preset?.key ?? 'CUSTOM'
}

async function runBulkInvimaSync() {
  if (!activeInvimaIntegrations.value.length) {
    error.value = 'No hay integraciones Socrata activas con destino INVIMA'
    return
  }
  if (invimaIntegrationsMissingToken.value.length) {
    error.value = `Falta token en: ${invimaIntegrationsMissingToken.value.map((i) => i.name).join(', ')}`
    return
  }
  const toSync = INVIMA_LIST_TYPE_ORDER.filter((lt) =>
    activeInvimaIntegrations.value.some((i) => i.invimaListType === lt),
  )
  if (
    !confirm(
      `Sincronizar ${toSync.length} listado(s) INVIMA desde datos.gov.co?\n\n` +
        'Se ejecutar? uno por uno (vigentes, vencidos, renovaci?n, otros). Puede tardar muchos minutos.',
    )
  ) {
    return
  }
  bulkInvimaSyncing.value = true
  bulkSyncProgress.value = ''
  error.value = null
  bulkInvimaSyncResult.value = null
  const results: BulkSyncItem[] = []
  let totalImported = 0
  let okCount = 0
  const startMs = Date.now()

  for (const listType of toSync) {
    const integration = activeInvimaIntegrations.value.find((i) => i.invimaListType === listType)
    const preset = INVIMA_SOCRATA_PRESETS.find((p) => p.listType === listType)
    bulkSyncProgress.value = preset?.label ?? listType

    const { data, error: err } = await fetchApi<{
      ok: boolean
      message?: string
      rowsImported?: number
      rowsFetched?: number
      pages?: number
      durationMs?: number
      integrationId?: string
      integrationName?: string
      listType?: string
    }>(`/integrations/external/socrata/sync-invimaf/${listType}`, {
      method: 'POST',
      body: { replaceExisting: true },
    })

    if (err) {
      results.push({
        integrationId: integration?.id ?? listType,
        integrationName: integration?.name ?? listType,
        listType,
        ok: false,
        message: err,
      })
      continue
    }

    results.push({
      integrationId: data?.integrationId ?? integration?.id ?? listType,
      integrationName: data?.integrationName ?? integration?.name ?? listType,
      listType,
      ok: data?.ok ?? false,
      rowsImported: data?.rowsImported,
      rowsFetched: data?.rowsFetched,
      pages: data?.pages,
      durationMs: data?.durationMs,
      message: data?.message,
    })
    if (data?.ok) {
      okCount++
      totalImported += data.rowsImported ?? 0
    }
  }

  bulkInvimaSyncing.value = false
  bulkSyncProgress.value = ''
  bulkInvimaSyncResult.value = {
    ok: okCount === results.length,
    integrationsProcessed: results.length,
    integrationsOk: okCount,
    totalRowsImported: totalImported,
    durationMs: Date.now() - startMs,
    message:
      okCount === results.length
        ? `Sincronizados ${results.length} listados INVIMA (${totalImported.toLocaleString()} filas en total)`
        : `Completado con errores: ${okCount}/${results.length} listados OK`,
    results,
  }
  msg.value = bulkInvimaSyncResult.value.message
  await loadIntegrations()
}

async function saveIntegration() {
  if (!form.value.name.trim() || !form.value.baseUrl.trim()) {
    error.value = 'Complete nombre y URL base'
    return
  }
  if (form.value.integrationKind === 'SOCRATA_OPEN_DATA') {
    if (!form.value.socrataDatasetId.trim() || !form.value.socrataQuery.trim()) {
      error.value = 'Complete ID de dataset y consulta SoQL'
      return
    }
    if (
      form.value.syncTarget === 'INVIMA_REGISTROS' &&
      !form.value.invimaListType
    ) {
      error.value = 'Seleccione tipo de listado INVIMA'
      return
    }
    if (form.value.socrataApiVersion === 'SODA3' && form.value.authMethod === 'NONE') {
      error.value = 'SODA3 requiere App Token (API Key con header X-App-Token)'
      return
    }
  }

  if (
    form.value.authMethod !== 'NONE' &&
    !form.value.authSecret.trim() &&
    (!editingId.value || !editingHasSecret.value)
  ) {
    error.value =
      'Ingrese el App Token (token de la aplicaci?n de datos.gov.co) en el campo API Key'
    return
  }

  saving.value = true
  error.value = null
  const body: Record<string, unknown> = {
    name: form.value.name.trim(),
    isActive: form.value.isActive,
    integrationKind: form.value.integrationKind,
    baseUrl: form.value.baseUrl.trim(),
    internalNotes: form.value.internalNotes.trim() || undefined,
    authMethod: form.value.authMethod,
    authHeaderName: form.value.authHeaderName,
    authUsername: form.value.authUsername || undefined,
  }
  if (form.value.authSecret.trim()) {
    body.authSecret = form.value.authSecret.trim()
  }

  if (form.value.integrationKind === 'ERP_PURCHASE_ORDER') {
    body.poPathTemplate =
      form.value.authMethod === 'API_KEY'
        ? form.value.poPathTemplate.trim()
        : form.value.poPathTemplate.trim() || '?consecutivo={number}'
  } else {
    body.socrataDatasetId = form.value.socrataDatasetId.trim()
    body.socrataApiVersion = form.value.socrataApiVersion
    body.socrataQuery = form.value.socrataQuery.trim()
    body.socrataPageSize = form.value.socrataPageSize
    body.syncTarget = form.value.syncTarget
    if (form.value.syncTarget === 'INVIMA_REGISTROS') {
      body.invimaListType = form.value.invimaListType
    }
  }

  const path = editingId.value
    ? `/integrations/external/${editingId.value}`
    : '/integrations/external'
  const { data, error: err } = await fetchApi<IntegrationRow>(path, {
    method: editingId.value ? 'PATCH' : 'POST',
    body,
  })
  saving.value = false
  if (err) error.value = err
  else if (data) {
    msg.value = editingId.value ? 'Integraci?n actualizada' : 'Integraci?n creada'
    resetForm()
    activeTab.value = 'list'
    await loadIntegrations()
  }
}

async function deactivate(id: string) {
  if (!confirm('?Desactivar esta integraci?n?')) return
  const { error: err } = await fetchApi(`/integrations/external/${id}`, { method: 'DELETE' })
  if (err) error.value = err
  else {
    msg.value = 'Integraci?n desactivada'
    await loadIntegrations()
  }
}

async function testConnection(id: string) {
  error.value = null
  const { data, error: err } = await fetchApi<{ ok: boolean; message: string }>(
    `/integrations/external/${id}/test-connection`,
    { method: 'POST' },
  )
  if (err) error.value = err
  else if (data) msg.value = data.message
}

function openPoll(row: IntegrationRow) {
  pollIntegrationId.value = row.id
  pollResult.value = null
  socrataPreview.value = null
  restPreview.value = null
  socrataSyncResult.value = null
  activeTab.value = 'poll'
}

async function runPoll() {
  if (!pollIntegrationId.value || !pollOc.value.trim()) {
    error.value = 'Seleccione integraci?n y consecutivo OC'
    return
  }
  pollLoading.value = true
  error.value = null
  pollResult.value = null
  const num = encodeURIComponent(pollOc.value.trim())
  const { data, error: err } = await fetchApi<typeof pollResult.value>(
    `/integrations/external/${pollIntegrationId.value}/poll/purchase-orders/${num}`,
  )
  pollLoading.value = false
  if (err) error.value = err
  else if (data) {
    pollResult.value = data
    msg.value = data.ok ? 'Sondeo exitoso' : (data.message ?? 'Sondeo con advertencias')
    await loadIntegrations()
  }
}

async function runRestPreview() {
  if (!pollIntegrationId.value) {
    error.value = 'Seleccione una integraci?n REST'
    return
  }
  restLoading.value = true
  error.value = null
  restPreview.value = null
  const { data, error: err } = await fetchApi<typeof restPreview.value>(
    `/integrations/external/${pollIntegrationId.value}/rest/preview`,
  )
  restLoading.value = false
  if (err) error.value = err
  else if (data) {
    restPreview.value = data
    if (data.ok) {
      msg.value = `Consulta: ${data.rowCount.toLocaleString()} fila(s)`
      error.value = null
    } else {
      error.value = data.message ?? `Error HTTP ${data.httpStatus}`
      msg.value = ''
    }
    await loadIntegrations()
  }
}

async function runSocrataPreview() {
  if (!pollIntegrationId.value) {
    error.value = 'Seleccione una integraci?n Socrata'
    return
  }
  socrataLoading.value = true
  error.value = null
  socrataPreview.value = null
  socrataSyncResult.value = null
  const { data, error: err } = await fetchApi<typeof socrataPreview.value>(
    `/integrations/external/${pollIntegrationId.value}/socrata/preview`,
  )
  socrataLoading.value = false
  if (err) error.value = err
  else if (data) {
    socrataPreview.value = data
    if (data.ok) {
      msg.value = `Vista previa: ${data.rowCount} fila(s)`
      error.value = null
    } else {
      error.value = data.message ?? `Error HTTP ${data.httpStatus}`
      msg.value = ''
    }
    await loadIntegrations()
  }
}

async function runSocrataSync() {
  const row = selectedPollIntegration.value
  if (!row) {
    error.value = 'Seleccione integraci?n'
    return
  }
  if (row.syncTarget !== 'INVIMA_REGISTROS') {
    error.value = 'Configure destino INVIMA en la integraci?n'
    return
  }
  const label = row.invimaListType ?? 'listado'
  if (
    !confirm(
      `Sincronizar TODO el dataset a INVIMA (${label})?\n\n` +
        'Se descargaran todas las paginas desde datos.gov.co (puede tardar varios minutos) ' +
        'y se reemplazaran los registros de ese listado. Luego busque en Maestros ? INVIMA.',
    )
  ) {
    return
  }
  socrataSyncing.value = true
  error.value = null
  const { data, error: err } = await fetchApi<typeof socrataSyncResult.value>(
    `/integrations/external/${pollIntegrationId.value}/socrata/sync`,
    { method: 'POST', body: { replaceExisting: true } },
  )
  socrataSyncing.value = false
  if (err) error.value = err
  else if (data) {
    socrataSyncResult.value = data
    msg.value = data.message ?? (data.ok ? 'Sincronizaci?n completada' : 'Error al sincronizar')
    await loadIntegrations()
  }
}

const previewTableColumns = computed(() => {
  const preview = isRestPoll.value ? restPreview.value : socrataPreview.value
  if (!preview?.columns?.length) return []
  return preview.columns.slice(0, isRestPoll.value ? 12 : 8)
})

async function syncHr() {
  syncing.value = true
  error.value = null
  msg.value = ''
  const { data, error: err } = await fetchApi<{ recordsProcessed: number; source: string }>(
    '/integrations/hr/sync',
    { method: 'POST' },
  )
  syncing.value = false
  if (err) error.value = err
  else if (data) msg.value = `Sincronizados ${data.recordsProcessed} usuarios (${data.source})`
}

async function testHis() {
  error.value = null
  msg.value = ''
  try {
    await $fetch(`${apiBase}/integrations/his/prescriptions`, {
      method: 'POST',
      headers: { 'x-his-secret': 'dev-his-secret' },
      body: hisPayload.value,
    })
    msg.value = 'Prescripci?n HIS registrada'
  } catch {
    error.value = 'Error al enviar webhook HIS'
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-xs text-slate-500 uppercase tracking-wide">Configuraci?n</p>
      <h2 class="text-2xl font-bold text-slate-800">Integraciones API externas</h2>
      <p class="text-slate-500 text-sm mt-1">
        ERP (sondeo OC), REST (consulta directa), datos abiertos Socrata (
        <a
          href="https://www.datos.gov.co/"
          target="_blank"
          rel="noopener"
          class="text-orange-600 hover:underline"
        >datos.gov.co</a>
        ) e importaci?n INVIMA.
      </p>
    </div>

    <div
      v-if="!session.can('admin.users')"
      class="bg-amber-50 border border-amber-200 p-4 rounded-lg text-sm text-amber-900"
    >
      Requiere permiso <code>admin.users</code>.
    </div>

    <template v-else>
      <div
        v-if="error"
        class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
      >
        {{ error }}
      </div>
      <p
        v-if="msg"
        class="text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-lg"
      >
        {{ msg }}
      </p>

      <div class="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          class="px-4 py-2 text-sm rounded-lg transition"
          :class="activeTab === 'list' ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-slate-100'"
          @click="activeTab = 'list'; resetForm()"
        >
          Registradas
        </button>
        <button
          type="button"
          class="px-4 py-2 text-sm rounded-lg transition"
          :class="activeTab === 'new' ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-slate-100'"
          @click="activeTab = 'new'"
        >
          {{ editingId ? 'Editar integraci?n' : 'Nueva integraci?n' }}
        </button>
        <button
          type="button"
          class="px-4 py-2 text-sm rounded-lg transition"
          :class="activeTab === 'poll' ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-slate-100'"
          @click="activeTab = 'poll'"
        >
          Vista previa / operaciones
        </button>
      </div>

      <!-- Registradas -->
      <div v-if="activeTab === 'list'" class="bg-white rounded-xl border p-6">
        <div v-if="loading" class="text-sm text-slate-500">Cargando...</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-slate-500 border-b">
                <th class="py-2 pr-3">Nombre</th>
                <th class="py-2 pr-3">Tipo</th>
                <th class="py-2 pr-3">URL base</th>
                <th class="py-2 pr-3">Auth</th>
                <th class="py-2 pr-3">Activa</th>
                <th class="py-2 pr-3">?ltima consulta</th>
                <th class="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in integrations"
                :key="row.id"
                class="border-b border-slate-50"
              >
                <td class="py-2 pr-3 font-medium">{{ row.name }}</td>
                <td class="py-2 pr-3 text-xs">
                  {{ kindLabels[row.integrationKind] ?? row.integrationKind }}
                </td>
                <td class="py-2 pr-3 font-mono text-xs max-w-[180px] truncate" :title="row.baseUrl">
                  {{ row.baseUrl }}
                </td>
                <td class="py-2 pr-3">{{ authMethodLabels[row.authMethod] }}</td>
                <td class="py-2 pr-3">{{ row.isActive ? 'S?' : 'No' }}</td>
                <td class="py-2 pr-3 text-xs">
                  {{ row.lastPollAt ? new Date(row.lastPollAt).toLocaleString() : '?' }}
                </td>
                <td class="py-2 space-x-2 whitespace-nowrap">
                  <button
                    v-if="row.integrationKind === 'ERP_PURCHASE_ORDER'"
                    type="button"
                    class="text-blue-600 text-xs hover:underline"
                    @click="openPoll(row)"
                  >
                    Sondeo OC
                  </button>
                  <template v-else>
                    <button
                      type="button"
                      class="text-blue-600 text-xs hover:underline"
                      @click="openPoll(row)"
                    >
                      Vista previa
                    </button>
                  </template>
                  <button
                    type="button"
                    class="text-slate-600 text-xs hover:underline"
                    @click="testConnection(row.id)"
                  >
                    Probar
                  </button>
                  <button
                    type="button"
                    class="text-slate-600 text-xs hover:underline"
                    @click="startEdit(row)"
                  >
                    Editar
                  </button>
                  <button
                    v-if="row.isActive"
                    type="button"
                    class="text-red-600 text-xs hover:underline"
                    @click="deactivate(row.id)"
                  >
                    Desactivar
                  </button>
                </td>
              </tr>
              <tr v-if="!integrations.length">
                <td colspan="7" class="py-6 text-center text-slate-400">
                  No hay integraciones. Cree una en ?Nueva integraci?n?.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Nueva / Editar -->
      <div v-if="activeTab === 'new'" class="bg-white rounded-xl border p-6 space-y-6 max-w-2xl">
        <section class="space-y-4">
          <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Tipo e identificaci?n
          </h3>
          <div>
            <label class="text-sm text-slate-700">Tipo de integraci?n</label>
            <select
              v-model="form.integrationKind"
              class="w-full p-2 border rounded-lg text-sm mt-1"
              @change="onKindChange"
            >
              <option value="ERP_PURCHASE_ORDER">ERP ? Sondeo ?rdenes de compra</option>
              <option value="REST_QUERY">REST ? Consulta directa (tabla)</option>
              <option value="SOCRATA_OPEN_DATA">Datos abiertos ? Socrata (SODA)</option>
            </select>
          </div>
          <div class="flex flex-wrap gap-4 items-start justify-between">
            <div class="flex-1 min-w-[200px]">
              <label class="text-sm text-slate-700">Nombre</label>
              <input
                v-model="form.name"
                class="w-full p-2 border rounded-lg text-sm mt-1"
                :placeholder="form.integrationKind === 'SOCRATA_OPEN_DATA' ? 'INVIMA CUM vigentes' : 'ERP principal'"
              />
            </div>
            <div class="flex items-center gap-2 pt-6">
              <label class="text-sm text-slate-700">Activa</label>
              <button
                type="button"
                class="relative w-11 h-6 rounded-full transition"
                :class="form.isActive ? 'bg-orange-500' : 'bg-slate-300'"
                @click="form.isActive = !form.isActive"
              >
                <span
                  class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition"
                  :class="form.isActive ? 'translate-x-5' : ''"
                />
              </button>
            </div>
          </div>
          <div>
            <label class="text-sm text-slate-700">URL base</label>
            <input
              v-model="form.baseUrl"
              class="w-full p-2 border rounded-lg text-sm mt-1 font-mono"
                :placeholder="form.integrationKind === 'SOCRATA_OPEN_DATA' ? 'https://www.datos.gov.co' : form.integrationKind === 'REST_QUERY' ? 'https://api.ejemplo.com/v1/recurso' : 'https://erp.empresa.com/api/v1'"
            />
            <p v-if="form.integrationKind === 'REST_QUERY'" class="text-xs text-slate-400 mt-1">
              URL completa del endpoint (GET). No usa consecutivo ni plantilla de ruta.
            </p>
          </div>
          <div>
            <label class="text-sm text-slate-700">Notas internas</label>
            <textarea
              v-model="form.internalNotes"
              rows="2"
              class="w-full p-2 border rounded-lg text-sm mt-1"
            />
          </div>
        </section>

        <section
          v-if="form.integrationKind === 'SOCRATA_OPEN_DATA'"
          class="space-y-4 border-t pt-4"
        >
          <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Socrata / SoQL
          </h3>
          <p class="text-xs text-slate-500">
            SODA3 admite hasta 1000 filas por p?gina. Obtenga su App Token en el portal de
            <a href="https://dev.socrata.com/" target="_blank" rel="noopener" class="text-orange-600 hover:underline">Socrata</a>.
          </p>
          <div v-if="!editingId">
            <label class="text-sm text-slate-700">Plantilla INVIMA (datos.gov.co)</label>
            <select
              v-model="invimaPresetKey"
              class="w-full p-2 border rounded-lg text-sm mt-1"
              @change="onInvimaPresetChange"
            >
              <option
                v-for="p in INVIMA_SOCRATA_PRESETS"
                :key="p.key"
                :value="p.key"
              >
                {{ p.label }}
              </option>
              <option value="CUSTOM">Personalizado</option>
            </select>
            <p class="text-xs text-slate-500 mt-1">
              Cree una integraci?n por listado (vigentes, vencidos, otros estados). Mismo token en cada una.
            </p>
            <button
              type="button"
              class="mt-2 text-sm text-teal-700 hover:text-teal-900 font-medium"
              @click="applyPosPresetToForm"
            >
              Usar plantilla Medicamentos POS (a7iv-sme8)
            </button>
          </div>
          <div>
            <label class="text-sm text-slate-700">ID dataset</label>
            <input
              v-model="form.socrataDatasetId"
              class="w-full p-2 border rounded-lg text-sm mt-1 font-mono"
              placeholder="i7cb-raxc"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-sm text-slate-700">Versi?n API</label>
              <select v-model="form.socrataApiVersion" class="w-full p-2 border rounded-lg text-sm mt-1">
                <option value="SODA3">SODA3 (POST query)</option>
                <option value="SODA2">SODA2 (GET resource)</option>
              </select>
            </div>
            <div>
              <label class="text-sm text-slate-700">Tama?o de p?gina</label>
              <input
                v-model.number="form.socrataPageSize"
                type="number"
                min="1"
                max="50000"
                class="w-full p-2 border rounded-lg text-sm mt-1"
              />
            </div>
          </div>
          <div>
            <label class="text-sm text-slate-700">Consulta SoQL</label>
            <textarea
              v-model="form.socrataQuery"
              rows="8"
              class="w-full p-2 border rounded-lg text-sm mt-1 font-mono text-xs"
            />
            <p class="text-xs text-slate-500 mt-1">
              No use LIMIT en la consulta guardada: la sincronizaci?n pagina todo el dataset (como el Excel).
              La vista previa a?ade LIMIT 10 solo para la prueba.
            </p>
          </div>
          <div>
            <label class="text-sm text-slate-700">Destino al sincronizar</label>
            <select v-model="form.syncTarget" class="w-full p-2 border rounded-lg text-sm mt-1">
              <option value="NONE">Solo vista previa</option>
              <option value="INVIMA_REGISTROS">INVIMA ? Referencia CUM</option>
            </select>
          </div>
          <div v-if="form.syncTarget === 'INVIMA_REGISTROS'">
            <label class="text-sm text-slate-700">Tipo listado INVIMA</label>
            <select v-model="form.invimaListType" class="w-full p-2 border rounded-lg text-sm mt-1">
              <option value="VIGENTE">VIGENTE</option>
              <option value="VENCIDO">VENCIDO</option>
              <option value="RENOVACION">RENOVACION</option>
              <option value="OTRO_ESTADO">OTRO_ESTADO</option>
            </select>
          </div>
        </section>

        <section class="space-y-4 border-t pt-4">
          <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Autenticaci?n
          </h3>
          <div>
            <label class="text-sm text-slate-700">M?todo</label>
            <select v-model="form.authMethod" class="w-full p-2 border rounded-lg text-sm mt-1" @change="onAuthMethodChange">
              <option value="NONE">Sin autenticaci?n</option>
              <option value="API_KEY">API Key (header)</option>
              <option value="BEARER">Bearer token</option>
              <option value="BASIC">Basic Auth</option>
            </select>
          </div>
          <template v-if="form.authMethod === 'API_KEY'">
            <div>
              <label class="text-sm text-slate-700">Nombre del header</label>
              <input v-model="form.authHeaderName" class="w-full p-2 border rounded-lg text-sm mt-1" />
            </div>
            <div>
              <label class="text-sm text-slate-700">API Key / App Token</label>
              <input
                v-model="form.authSecret"
                type="password"
                class="w-full p-2 border rounded-lg text-sm mt-1"
                :placeholder="
                  editingId && editingHasSecret
                    ? 'Dejar vac?o para no cambiar'
                    : 'Token de la aplicaci?n (datos.gov.co)'
                "
              />
              <p
                v-if="editingId && !editingHasSecret"
                class="text-xs text-amber-700 mt-1"
              >
                No hay token guardado. Pegue el ?Token de la aplicaci?n? y guarde.
              </p>
              <p
                v-else-if="form.integrationKind === 'SOCRATA_OPEN_DATA'"
                class="text-xs text-slate-400 mt-1"
              >
                Use el valor de ?Token de la aplicaci?n?, no el ID de ?Claves API?.
              </p>
            </div>
          </template>
          <template v-if="form.authMethod === 'BEARER'">
            <div>
              <label class="text-sm text-slate-700">Token</label>
              <input v-model="form.authSecret" type="password" class="w-full p-2 border rounded-lg text-sm mt-1" />
            </div>
          </template>
          <template v-if="form.authMethod === 'BASIC'">
            <div>
              <label class="text-sm text-slate-700">Usuario</label>
              <input v-model="form.authUsername" class="w-full p-2 border rounded-lg text-sm mt-1" />
            </div>
            <div>
              <label class="text-sm text-slate-700">Contrase?a</label>
              <input v-model="form.authSecret" type="password" class="w-full p-2 border rounded-lg text-sm mt-1" />
            </div>
          </template>
          <div v-if="showPoPathTemplate">
            <label class="text-sm text-slate-700">Ruta plantilla OC</label>
            <input v-model="form.poPathTemplate" class="w-full p-2 border rounded-lg text-sm mt-1 font-mono" />
            <p class="text-xs text-slate-400 mt-1">
              Crystalos: <code>?consecutivo={number}</code>
            </p>
          </div>
          <p
            v-else-if="form.integrationKind === 'ERP_PURCHASE_ORDER' && form.authMethod === 'API_KEY'"
            class="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3"
          >
            Con <strong>API Key (header)</strong> se consulta la URL base completa sin plantilla OC.
            En vista previa use <strong>Ejecutar consulta</strong>.
          </p>
        </section>

        <div class="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            class="px-5 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            :disabled="saving"
            @click="saveIntegration"
          >
            {{ saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear integraci?n' }}
          </button>
          <button
            type="button"
            class="px-5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700"
            @click="resetForm(); activeTab = 'list'"
          >
            Volver al listado
          </button>
        </div>
      </div>

      <!-- Vista previa / operaciones -->
      <div v-if="activeTab === 'poll'" class="bg-white rounded-xl border p-6 space-y-4 max-w-6xl">
        <div>
          <label class="text-sm text-slate-700">Integraci?n</label>
          <select
            v-model="pollIntegrationId"
            class="w-full p-2 border rounded-lg text-sm mt-1 max-w-md"
            @change="pollResult = null; socrataPreview = null; restPreview = null; socrataSyncResult = null; bulkInvimaSyncResult = null"
          >
            <option value="">Seleccione...</option>
            <option
              v-for="row in integrations.filter((i) => i.isActive)"
              :key="row.id"
              :value="row.id"
            >
              {{ row.name }} ({{ kindLabels[row.integrationKind] }})
            </option>
          </select>
        </div>

        <div
          v-if="showInvimaBulkSync"
          class="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50"
        >
          <p class="text-sm font-medium text-slate-800">
            Sincronizaci?n INVIMA por listado ({{ activeInvimaIntegrations.length }} integraci?n/es)
          </p>
          <ul class="text-xs text-slate-600 list-disc pl-4 space-y-0.5">
            <li v-for="i in activeInvimaIntegrations" :key="i.id">
              {{ i.name }}
              <span :class="i.hasSecret ? 'text-green-700' : 'text-red-600'">
                ({{ i.hasSecret ? 'token OK' : 'sin token' }})
              </span>
            </li>
          </ul>
          <button
            type="button"
            class="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50"
            :disabled="bulkInvimaSyncing || !!invimaIntegrationsMissingToken.length"
            @click="runBulkInvimaSync"
          >
            {{
              bulkInvimaSyncing
                ? `Sincronizando ${bulkSyncProgress || '?'}`
                : 'Sincronizar todos (uno por uno)'
            }}
          </button>
          <p
            v-if="invimaIntegrationsMissingToken.length"
            class="text-xs text-amber-700"
          >
            Pegue el App Token en cada integraci?n antes del sync masivo.
          </p>
          <div
            v-if="bulkInvimaSyncResult"
            class="text-sm p-3 rounded-lg space-y-2"
            :class="bulkInvimaSyncResult.ok ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'"
          >
            <p>{{ bulkInvimaSyncResult.message }}</p>
            <ul class="text-xs space-y-1">
              <li v-for="r in bulkInvimaSyncResult.results" :key="r.integrationId">
                {{ r.listType }} ? {{ r.integrationName }}:
                <span :class="r.ok ? 'text-green-700' : 'text-red-700'">
                  {{ r.ok ? `${r.rowsImported?.toLocaleString() ?? 0} filas` : r.message }}
                </span>
              </li>
            </ul>
          </div>
        </div>

        <!-- ERP sondeo -->
        <template v-if="isErpPoll">
          <p class="text-sm text-slate-600">
            Consulta por <strong>consecutivo</strong> (ej. <code>0100000017</code>).
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl">
            <div>
              <label class="text-sm text-slate-700">Consecutivo OC</label>
              <input
                v-model="pollOc"
                class="w-full p-2 border rounded-lg text-sm mt-1 font-mono"
                placeholder="0100000017"
              />
            </div>
          </div>
          <button
            type="button"
            class="px-5 py-2.5 bg-orange-500 text-white rounded-lg text-sm disabled:opacity-50"
            :disabled="pollLoading"
            @click="runPoll"
          >
            {{ pollLoading ? 'Ejecutando sondeo...' : 'Ejecutar sondeo' }}
          </button>
          <template v-if="pollResult">
            <div class="text-xs text-slate-500 space-y-1">
              <p>
                HTTP {{ pollResult.httpStatus }} ? {{ pollResult.durationMs }} ms
                <span v-if="pollResult.source"> ? {{ pollResult.source }}</span>
              </p>
              <p v-if="pollResult.url" class="font-mono break-all">{{ pollResult.url }}</p>
              <p v-if="pollResult.message" class="text-amber-700">{{ pollResult.message }}</p>
            </div>
            <div v-if="pollResult.mapped">
              <pre class="bg-slate-800 text-emerald-100 p-4 rounded-lg text-xs overflow-auto max-h-80">{{ JSON.stringify(pollResult.mapped, null, 2) }}</pre>
            </div>
            <button
              type="button"
              class="text-xs text-blue-600 hover:underline"
              @click="showRawPreview = !showRawPreview"
            >
              {{ showRawPreview ? 'Ocultar' : 'Ver' }} respuesta cruda
            </button>
            <pre
              v-if="showRawPreview && pollResult.rawPreview"
              class="bg-slate-100 p-4 rounded-lg text-xs overflow-auto max-h-64"
            >{{ JSON.stringify(pollResult.rawPreview, null, 2) }}</pre>
          </template>
        </template>

        <!-- REST consulta directa -->
        <template v-else-if="isRestPoll">
          <p class="text-sm text-slate-600">
            Ejecuta un <strong>GET</strong> a la URL configurada y muestra el resultado en tabla.
            No requiere consecutivo ni mapeo a ?rdenes de compra.
          </p>
          <button
            type="button"
            class="px-5 py-2.5 bg-orange-500 text-white rounded-lg text-sm disabled:opacity-50"
            :disabled="restLoading"
            @click="runRestPreview"
          >
            {{ restLoading ? 'Consultando...' : 'Ejecutar consulta' }}
          </button>

          <template v-if="restPreview">
            <div class="text-xs text-slate-500 space-y-1">
              <p>
                HTTP {{ restPreview.httpStatus }} ? {{ restPreview.durationMs }} ms ?
                {{ restPreview.rowCount.toLocaleString() }} fila(s)
              </p>
              <p v-if="restPreview.url" class="font-mono break-all">{{ restPreview.url }}</p>
              <p v-if="restPreview.message" class="text-amber-700">{{ restPreview.message }}</p>
            </div>
            <div v-if="restPreview.rows.length" class="overflow-x-auto border rounded-lg max-h-[32rem] overflow-y-auto">
              <table class="w-full text-xs">
                <thead class="sticky top-0 bg-slate-50">
                  <tr class="text-left">
                    <th
                      v-for="col in previewTableColumns"
                      :key="col"
                      class="px-2 py-1 border-b font-medium whitespace-nowrap"
                    >
                      {{ col }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(r, idx) in restPreview.rows"
                    :key="idx"
                    class="border-b border-slate-50"
                  >
                    <td
                      v-for="col in previewTableColumns"
                      :key="col"
                      class="px-2 py-1 align-top max-w-xs truncate"
                      :title="String(r[col] ?? '')"
                    >
                      {{ r[col] ?? '?' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </template>

        <!-- Socrata -->
        <template v-else-if="isSocrataPoll">
          <p v-if="isInvimaCumPoll" class="text-sm text-slate-600">
            <strong>Vista previa:</strong> muestra hasta 10 filas (prueba r?pida).
            <strong>Sincronizar a INVIMA:</strong> descarga <em>todo</em> el dataset por p?ginas de 1000
            y alimenta la b?squeda en Maestros ? INVIMA (reemplaza el listado
            <code>{{ selectedPollIntegration?.invimaListType ?? 'VIGENTE' }}</code>).
            Puede tardar varios minutos si hay decenas de miles de filas.
          </p>
          <p v-else class="text-sm text-slate-600">
            <strong>Vista previa:</strong> consulta Socrata y muestra una muestra de filas.
            Esta integraci?n no est? configurada para sincronizar a INVIMA CUM.
          </p>
          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              class="px-5 py-2.5 bg-orange-500 text-white rounded-lg text-sm disabled:opacity-50"
              :disabled="socrataLoading"
              @click="runSocrataPreview"
            >
              {{ socrataLoading ? 'Consultando...' : 'Vista previa' }}
            </button>
            <button
              v-if="selectedPollIntegration?.syncTarget === 'INVIMA_REGISTROS'"
              type="button"
              class="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50"
              :disabled="socrataSyncing"
              @click="runSocrataSync"
            >
              {{ socrataSyncing ? 'Sincronizando...' : 'Sincronizar a INVIMA' }}
            </button>
          </div>

          <template v-if="socrataPreview">
            <div class="text-xs text-slate-500">
              HTTP {{ socrataPreview.httpStatus }} ? {{ socrataPreview.durationMs }} ms ?
              {{ socrataPreview.rowCount }} fila(s)
              <span v-if="socrataPreview.message" class="text-amber-700 block">{{ socrataPreview.message }}</span>
            </div>
            <div v-if="socrataPreview.rows.length" class="overflow-x-auto border rounded-lg">
              <table class="w-full text-xs">
                <thead>
                  <tr class="bg-slate-50 text-left">
                    <th
                      v-for="col in previewTableColumns"
                      :key="col"
                      class="px-2 py-1 border-b font-medium"
                    >
                      {{ col }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(r, idx) in socrataPreview.rows.slice(0, 15)"
                    :key="idx"
                    class="border-b border-slate-50"
                  >
                    <td
                      v-for="col in previewTableColumns"
                      :key="col"
                      class="px-2 py-1 max-w-[140px] truncate"
                      :title="String(r[col] ?? '')"
                    >
                      {{ r[col] ?? '?' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="socrataPreview.sampleMapped?.length">
              <p class="text-sm font-medium text-slate-700 mt-2">Muestra mapeada INVIMA</p>
              <pre class="bg-slate-100 p-3 rounded-lg text-xs overflow-auto max-h-48">{{ JSON.stringify(socrataPreview.sampleMapped, null, 2) }}</pre>
            </div>
          </template>

          <div
            v-if="socrataSyncResult"
            class="text-sm p-3 rounded-lg"
            :class="socrataSyncResult.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'"
          >
            {{ socrataSyncResult.message }}
            <span v-if="socrataSyncResult.rowsImported">
              ? {{ socrataSyncResult.rowsImported }} filas en {{ socrataSyncResult.durationMs }} ms
            </span>
          </div>
        </template>
      </div>

      <button
        type="button"
        class="text-sm text-slate-600 hover:text-slate-800"
        @click="showAdvanced = !showAdvanced"
      >
        {{ showAdvanced ? '?' : '?' }} RRHH, HIS y variables (.env)
      </button>

      <template v-if="showAdvanced">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-white rounded-xl border p-6 space-y-4">
            <h3 class="font-semibold">RRHH</h3>
            <p v-if="hrStatus" class="text-sm text-slate-600">
              Fuente: <strong>{{ hrStatus.source }}</strong> ? {{ hrStatus.count }} usuarios
            </p>
            <button
              type="button"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
              :disabled="syncing"
              @click="syncHr"
            >
              {{ syncing ? 'Sincronizando...' : 'Sincronizar usuarios' }}
            </button>
          </div>
          <div class="bg-white rounded-xl border p-6 space-y-4">
            <h3 class="font-semibold">HIS ? Webhook</h3>
            <button
              type="button"
              class="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm"
              @click="testHis"
            >
              Enviar prueba HIS
            </button>
          </div>
        </div>
        <div class="bg-slate-800 text-slate-300 rounded-xl p-5 text-sm font-mono space-y-1">
          <p>INTEGRATION_SECRET_KEY ? cifrado de credenciales en BD</p>
          <p>ERP_USE_MOCK=true ? mock si el ERP no responde (desarrollo)</p>
        </div>
      </template>
    </template>
  </div>
</template>
