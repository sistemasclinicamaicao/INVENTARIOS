import { formatPmvPrice } from '~/composables/useInvimaPmvColumns'

export const KRYSTALOS_COLUMN_LABELS: Record<string, string> = {
  IDARTICULO: 'Código artículo',
  DESCRIPCION: 'Descripción',
  codcum: 'CUM',
  pmvPrecioUnitario: 'Precio unit. institucional',
  pmvRegulado: 'Medicamento regulado',
}

export function krystalosColLabel(col: string): string {
  return KRYSTALOS_COLUMN_LABELS[col] ?? col
}

export function formatKrystalosCell(col: string, value: unknown): string {
  if (col === 'pmvPrecioUnitario') return formatPmvPrice(value)
  if (col === 'pmvRegulado') {
    if (value === true || value === 'true') return 'Regulado'
    return '—'
  }
  if (value == null || value === '') return '—'
  return String(value)
}

export function krystalosReguladoBadgeClass(value: unknown): string {
  if (value === true || value === 'true') {
    return 'text-xs font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-800'
  }
  return ''
}

export const KRYSTALOS_DEFAULT_COLUMNS = [
  'IDARTICULO',
  'DESCRIPCION',
  'codcum',
  'pmvPrecioUnitario',
  'pmvRegulado',
]
