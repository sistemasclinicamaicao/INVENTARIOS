import * as XLSX from 'xlsx'

export interface ExcelExportColumn<TRow extends Record<string, unknown> = Record<string, unknown>> {
  key: string
  label: string
  value?: (row: TRow) => unknown
}

function cellValue(raw: unknown): string | number {
  if (raw == null || raw === '') return ''
  if (typeof raw === 'boolean') return raw ? 'Sí' : 'No'
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  return String(raw)
}

/** Genera un .xlsx con cabecera en la primera fila. */
export function exportRowsToExcel(
  filename: string,
  sheetName: string,
  columns: ExcelExportColumn[],
  rows: Record<string, unknown>[],
) {
  const headerRow = columns.map((c) => c.label)
  const body = rows.map((row) =>
    columns.map((col) => {
      const raw = col.value ? col.value(row) : row[col.key]
      return cellValue(raw)
    }),
  )
  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...body])
  const wb = XLSX.utils.book_new()
  const safeSheet = sheetName.replace(/[\\/*?:[\]]/g, '').slice(0, 31) || 'Datos'
  XLSX.utils.book_append_sheet(wb, ws, safeSheet)
  const out = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  XLSX.writeFile(wb, out)
}

export async function fetchAllPaginated<T>(options: {
  pageLimit: number
  fetchPage: (page: number, limit: number) => Promise<{ items: T[]; total: number } | null>
  onProgress?: (loaded: number, total: number) => void
  maxRows?: number
}): Promise<T[]> {
  const all: T[] = []
  const cap = options.maxRows ?? 500_000
  let page = 1
  let total = Infinity

  while (all.length < total && all.length < cap) {
    const chunk = await options.fetchPage(page, options.pageLimit)
    if (!chunk?.items?.length) break
    all.push(...chunk.items)
    total = chunk.total
    options.onProgress?.(all.length, total)
    if (chunk.items.length < options.pageLimit || all.length >= total) break
    page++
  }

  return all.slice(0, cap)
}
