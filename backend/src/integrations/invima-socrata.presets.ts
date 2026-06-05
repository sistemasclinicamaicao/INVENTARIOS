import type { InvimaListType } from '../masters/invima/invima-parser';

/** 29 columnas oficiales del dataset INVIMA CUM en datos.gov.co */
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
] as const;

export const INVIMA_SOQL = `SELECT ${INVIMA_SOQL_COLUMNS.join(', ')}`;

export type InvimaSocrataPresetKey =
  | 'VIGENTE'
  | 'VENCIDO'
  | 'RENOVACION'
  | 'OTRO_ESTADO'
  | 'CUSTOM';

export interface InvimaSocrataPreset {
  key: InvimaSocrataPresetKey;
  label: string;
  name: string;
  datasetId: string;
  listType: InvimaListType;
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
];

export const INVIMA_LIST_TYPE_ORDER: InvimaListType[] = [
  'VIGENTE',
  'VENCIDO',
  'RENOVACION',
  'OTRO_ESTADO',
];

export const INVIMA_LIST_TYPE_TITLES: Record<InvimaListType, string> = {
  VIGENTE: 'Código único de medicamentos vigentes',
  VENCIDO: 'Código único de medicamentos vencidos',
  RENOVACION: 'Código único de medicamentos en trámite de renovación',
  OTRO_ESTADO: 'Código único de medicamentos en otros estados',
};

export const INVIMA_SOCRATA_BASE_URL = 'https://www.datos.gov.co';
