export interface InvimaExpiredCheckRow {
  listType?: string
  estadoRegistro?: string | null
  fechaVencimiento?: string | null
  isExpired?: boolean
}

export function isInvimaRegistroVencido(row: InvimaExpiredCheckRow): boolean {
  if (row.isExpired === true) return true
  if (row.listType === 'VENCIDO') return true
  if (row.estadoRegistro?.toLowerCase().includes('vencido')) return true
  if (row.fechaVencimiento) {
    const d = new Date(String(row.fechaVencimiento).slice(0, 10))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (!isNaN(d.getTime()) && d < today) return true
  }
  return false
}

export function formatInvimaDate(value: string | null | undefined): string {
  if (!value) return '—'
  const s = String(value).slice(0, 10)
  const [y, m, d] = s.split('-')
  if (y && m && d) return `${d}/${m}/${y}`
  return s
}

/** Formatea vencimiento según convenciones del listado INVIMA (datos.gov.co). */
export function formatInvimaVencimiento(row: InvimaExpiredCheckRow): string {
  const value = row.fechaVencimiento
  if (!value) {
    if (row.listType === 'VIGENTE') return 'Sin dato oficial'
    return '—'
  }
  const iso = String(value).slice(0, 10)
  if (iso >= '3000-01-01') return 'Indefinido'
  return formatInvimaDate(value)
}
