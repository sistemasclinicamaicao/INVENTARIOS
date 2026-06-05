import {
  formatInvimaDate,
  formatInvimaVencimiento,
  type InvimaExpiredCheckRow,
} from '~/composables/useInvimaExpired'

export interface InvimaTableColumn {
  key: string
  label: string
  date?: boolean
  minWidth?: string
  /** Texto largo: permite salto de línea en lugar de truncar */
  wrap?: boolean
  /** Limpia guiones/espacios iniciales del listado INVIMA */
  clean?: boolean
  /** Usa formatInvimaVencimiento (reglas INVIMA vigentes/vencidos) */
  vencimiento?: boolean
}

/** 29 columnas oficiales del dataset INVIMA CUM (datos.gov.co), orden Socrata. */
export const INVIMA_DATASET_COLUMNS: InvimaTableColumn[] = [
  { key: 'expediente', label: 'Expediente', minWidth: '95px' },
  { key: 'producto', label: 'Producto', minWidth: '360px', wrap: true, clean: true },
  { key: 'titular', label: 'Titular', minWidth: '200px', wrap: true, clean: true },
  { key: 'registroSanitario', label: 'Registro sanitario', minWidth: '160px' },
  { key: 'fechaExpedicion', label: 'Fecha expedición', date: true, minWidth: '115px' },
  { key: 'fechaVencimiento', label: 'Fecha vencimiento', minWidth: '130px', vencimiento: true },
  { key: 'estadoRegistro', label: 'Estado registro', minWidth: '120px' },
  { key: 'expedienteCum', label: 'Expediente CUM', minWidth: '115px' },
  { key: 'consecutivoCum', label: 'Consecutivo CUM', minWidth: '115px' },
  { key: 'cantidadCum', label: 'Cantidad CUM', minWidth: '105px' },
  { key: 'descripcionComercial', label: 'Descripción comercial', minWidth: '260px', wrap: true, clean: true },
  { key: 'estadoCum', label: 'Estado CUM', minWidth: '105px' },
  { key: 'fechaActivo', label: 'Fecha activo', date: true, minWidth: '115px' },
  { key: 'fechaInactivo', label: 'Fecha inactivo', date: true, minWidth: '115px' },
  { key: 'muestraMedica', label: 'Muestra médica', minWidth: '105px' },
  { key: 'unidad', label: 'Unidad', minWidth: '85px' },
  { key: 'atc', label: 'ATC', minWidth: '90px' },
  { key: 'descripcionAtc', label: 'Descripción ATC', minWidth: '160px', wrap: true },
  { key: 'viaAdministracion', label: 'Vía administración', minWidth: '130px' },
  { key: 'concentracion', label: 'Concentración', minWidth: '105px' },
  { key: 'principioActivo', label: 'Principio activo', minWidth: '200px', wrap: true, clean: true },
  { key: 'unidadMedida', label: 'Unidad medida', minWidth: '115px' },
  { key: 'cantidad', label: 'Cantidad', minWidth: '95px' },
  { key: 'unidadReferencia', label: 'Unidad referencia', minWidth: '170px', wrap: true },
  { key: 'formaFarmaceutica', label: 'Forma farmacéutica', minWidth: '160px', wrap: true },
  { key: 'nombreRol', label: 'Nombre rol', minWidth: '180px', wrap: true },
  { key: 'tipoRol', label: 'Tipo rol', minWidth: '115px' },
  { key: 'modalidad', label: 'Modalidad', minWidth: '150px', wrap: true },
  { key: 'ium', label: 'IUM', minWidth: '130px' },
]

export const INVIMA_COMPACT_COLUMNS: InvimaTableColumn[] = [
  { key: 'listType', label: 'Listado', minWidth: '90px' },
  { key: 'cumCodigo', label: 'CUM', minWidth: '110px' },
  { key: 'producto', label: 'Producto', minWidth: '320px', wrap: true, clean: true },
  { key: 'registroSanitario', label: 'Registro', minWidth: '130px' },
  { key: 'fechaVencimiento', label: 'Vence', minWidth: '130px', vencimiento: true },
  { key: 'estadoRegistro', label: 'Estado', minWidth: '100px' },
]

/** Quita espacios y guiones iniciales (padding del listado oficial INVIMA). */
export function cleanInvimaDisplayText(value: string | null | undefined): string {
  if (value == null || value === '') return ''
  const trimmed = String(value).trim()
  const cleaned = trimmed.replace(/^[\s\-–—_]+/, '').trim()
  return cleaned || trimmed
}

export function formatInvimaCell(
  row: Record<string, unknown>,
  col: InvimaTableColumn,
): string {
  if (col.vencimiento) {
    return formatInvimaVencimiento(row as InvimaExpiredCheckRow)
  }
  const value = row[col.key]
  if (value == null || value === '') return '—'
  if (col.date) return formatInvimaDate(String(value))
  const text = String(value)
  if (col.clean) return cleanInvimaDisplayText(text) || '—'
  return text
}
