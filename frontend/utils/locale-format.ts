export const LOCALE = 'es-CO'
export const TIME_ZONE = 'America/Bogota'

/** Fecha → DD-MM-AAAA (es-CO) */
export function formatDateLatAm(value: string | null | undefined): string {
  if (!value) return '—'
  const iso = String(value).slice(0, 10)
  const isoMatch = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`
  const d = new Date(value)
  if (!Number.isNaN(d.getTime())) {
    const parts = new Intl.DateTimeFormat(LOCALE, {
      timeZone: TIME_ZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(d)
    const dd = parts.find((p) => p.type === 'day')?.value ?? ''
    const mm = parts.find((p) => p.type === 'month')?.value ?? ''
    const yyyy = parts.find((p) => p.type === 'year')?.value ?? ''
    return `${dd}-${mm}-${yyyy}`
  }
  return String(value)
}

/** Enteros con separador de miles (SSR-safe) */
export function formatInteger(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(value)
}

/** Pesos colombianos */
export function formatCop(value: number | null | undefined, fractionDigits = 0): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

export function formatQty(
  value: number | null | undefined,
  maximumFractionDigits = 2,
): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits }).format(value)
}

export function formatDateTimeLatAm(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** Fecha y hora corta (mismo resultado en SSR y cliente) */
export function formatDateTimeShort(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d)
}
