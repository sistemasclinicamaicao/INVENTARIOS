export const INVIMA_SOQL_COLUMNS = [
  'expediente',
  'producto',
  'titular',
  'registrosanitario',
  'fechaexpedicion',
  'fechavencimiento',
  'estadoregistro',
  'expedientecum',
  'consecutivocum',
  'cantidadcum',
  'descripcioncomercial',
  'estadocum',
  'fechaactivo',
  'fechainactivo',
  'muestramedica',
  'unidad',
  'atc',
  'descripcionatc',
  'viaadministracion',
  'concentracion',
  'principioactivo',
  'unidadmedida',
  'cantidad',
  'unidadreferencia',
  'formafarmaceutica',
  'nombrerol',
  'tiporol',
  'modalidad',
  'ium',
] as const

export const INVIMA_SOQL = `SELECT ${INVIMA_SOQL_COLUMNS.join(', ')}`

export type InvimaSocrataPresetKey =
  | 'VIGENTE'
  | 'VENCIDO'
  | 'RENOVACION'
  | 'OTRO_ESTADO'
  | 'CUSTOM'

export type InvimaListType = 'VIGENTE' | 'VENCIDO' | 'RENOVACION' | 'OTRO_ESTADO'

export interface InvimaSocrataPreset {
  key: InvimaSocrataPresetKey
  label: string
  name: string
  datasetId: string
  listType: InvimaListType
}

export const INVIMA_LIST_TYPE_ORDER: InvimaListType[] = [
  'VIGENTE',
  'VENCIDO',
  'RENOVACION',
  'OTRO_ESTADO',
]

/** Títulos oficiales de los datasets INVIMA CUM en datos.gov.co */
export const INVIMA_LIST_TYPE_TITLES: Record<InvimaListType, string> = {
  VIGENTE: 'Código único de medicamentos vigentes',
  VENCIDO: 'Código único de medicamentos vencidos',
  RENOVACION: 'Código único de medicamentos en trámite de renovación',
  OTRO_ESTADO: 'Código único de medicamentos en otros estados',
}

export const INVIMA_SOCRATA_PRESETS: InvimaSocrataPreset[] = [
  {
    key: 'VIGENTE',
    label: 'Vigentes (i7cb-raxc)',
    name: 'INVIMA CUM vigentes',
    datasetId: 'i7cb-raxc',
    listType: 'VIGENTE',
  },
  {
    key: 'VENCIDO',
    label: 'Medicamentos vencidos (vwwf-4ftk)',
    name: 'INVIMA CUM medicamentos vencidos',
    datasetId: 'vwwf-4ftk',
    listType: 'VENCIDO',
  },
  {
    key: 'RENOVACION',
    label: 'Trámite de renovación (vgr4-gemg)',
    name: 'INVIMA CUM trámite de renovación',
    datasetId: 'vgr4-gemg',
    listType: 'RENOVACION',
  },
  {
    key: 'OTRO_ESTADO',
    label: 'Otros estados (spzp-dfuc)',
    name: 'INVIMA CUM otros estados',
    datasetId: 'spzp-dfuc',
    listType: 'OTRO_ESTADO',
  },
]

export const INVIMA_SOCRATA_BASE_URL = 'https://www.datos.gov.co'

export const MEDICAMENTOS_POS_DATASET_ID = 'a7iv-sme8'

export const MEDICAMENTOS_POS_SOQL_COLUMNS = [
  'atc',
  'principioactivo',
  'descripcionatc',
  'producto',
  'expediente',
  'registrosanitario',
  'fechavencimiento',
  'estadoregistro',
  'descripcioncomercial',
  'unidad',
  'viaadministracion',
  'concentracion',
  'unidadmedida',
  'cantidad',
  'unidadreferencia',
  'formafarmaceutica',
  'nombrerol',
] as const

export const MEDICAMENTOS_POS_SOQL = `SELECT ${MEDICAMENTOS_POS_SOQL_COLUMNS.join(', ')}`

export function applyMedicamentosPosPreset(form: {
  name: string
  baseUrl: string
  authMethod: string
  authHeaderName: string
  socrataDatasetId: string
  socrataApiVersion: string
  socrataQuery: string
  socrataPageSize: number
  syncTarget: string
}) {
  form.name = 'MEDICAMENTOS POS'
  form.baseUrl = INVIMA_SOCRATA_BASE_URL
  form.authMethod = 'API_KEY'
  form.authHeaderName = 'X-App-Token'
  form.socrataDatasetId = MEDICAMENTOS_POS_DATASET_ID
  form.socrataApiVersion = 'SODA3'
  form.socrataQuery = MEDICAMENTOS_POS_SOQL
  form.socrataPageSize = 1000
  form.syncTarget = 'NONE'
}

export function applyInvimaSocrataPreset(
  presetKey: InvimaSocrataPresetKey,
  form: {
    name: string
    baseUrl: string
    authMethod: string
    authHeaderName: string
    socrataDatasetId: string
    socrataQuery: string
    syncTarget: string
    invimaListType: InvimaListType
  },
) {
  form.baseUrl = INVIMA_SOCRATA_BASE_URL
  form.authMethod = 'API_KEY'
  form.authHeaderName = 'X-App-Token'
  form.socrataQuery = INVIMA_SOQL
  form.syncTarget = 'INVIMA_REGISTROS'

  if (presetKey === 'CUSTOM') return

  const preset = INVIMA_SOCRATA_PRESETS.find((p) => p.key === presetKey)
  if (!preset) return
  form.name = preset.name
  form.socrataDatasetId = preset.datasetId
  form.invimaListType = preset.listType
}
