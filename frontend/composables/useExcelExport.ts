import * as XLSX from 'xlsx'

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export interface ExcelExportColumn<TRow = Record<string, unknown>> {
  key: string
  label: string
  value?: (row: TRow) => unknown
}

export interface ExcelExportSession {
  filename: string
  sheetName: string
  fileHandle: FileSystemFileHandle | null
}

function cellValue(raw: unknown): string | number {
  if (raw == null || raw === '') return ''
  if (typeof raw === 'boolean') return raw ? 'Sí' : 'No'
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  return String(raw)
}

function normalizeFilename(filename: string) {
  return filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
}

function buildWorkbook<TRow>(
  sheetName: string,
  columns: ExcelExportColumn<TRow>[],
  rows: TRow[],
) {
  const headerRow = columns.map((c) => c.label)
  const body = rows.map((row) =>
    columns.map((col) => {
      const raw = col.value
        ? col.value(row)
        : (row as Record<string, unknown>)[col.key]
      return cellValue(raw)
    }),
  )
  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...body])
  const wb = XLSX.utils.book_new()
  const safeSheet = sheetName.replace(/[\\/*?:[\]]/g, '').slice(0, 31) || 'Datos'
  XLSX.utils.book_append_sheet(wb, ws, safeSheet)
  return wb
}

function downloadBufferAsFile(filename: string, buf: ArrayBuffer) {
  const blob = new Blob([buf], { type: XLSX_MIME })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Llamar al inicio del clic (antes de cargar datos).
 * En Chrome/Edge abre "Guardar como" mientras el gesto del usuario sigue activo.
 */
export async function beginExcelExport(
  filename: string,
  sheetName: string,
): Promise<ExcelExportSession | null> {
  const out = normalizeFilename(filename)
  let fileHandle: FileSystemFileHandle | null = null

  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const savePicker = (
        window as Window & {
          showSaveFilePicker: (options: {
            suggestedName?: string
            types?: Array<{ description: string; accept: Record<string, string[]> }>
          }) => Promise<FileSystemFileHandle>
        }
      ).showSaveFilePicker
      fileHandle = await savePicker({
        suggestedName: out,
        types: [
          {
            description: 'Excel (.xlsx)',
            accept: { [XLSX_MIME]: ['.xlsx'] },
          },
        ],
      })
    } catch (error) {
      if ((error as DOMException).name === 'AbortError') return null
    }
  }

  return { filename: out, sheetName, fileHandle }
}

/** Escribe el archivo tras cargar todas las filas. */
export async function finishExcelExport<TRow>(
  session: ExcelExportSession,
  columns: ExcelExportColumn<TRow>[],
  rows: TRow[],
) {
  const wb = buildWorkbook(session.sheetName, columns, rows)
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer

  if (session.fileHandle) {
    const writable = await session.fileHandle.createWritable()
    await writable.write(new Blob([buf], { type: XLSX_MIME }))
    await writable.close()
    return
  }

  downloadBufferAsFile(session.filename, buf)
}

/** Exportación inmediata (tablas pequeñas, sin espera async). */
export async function exportRowsToExcel<TRow>(
  filename: string,
  sheetName: string,
  columns: ExcelExportColumn<TRow>[],
  rows: TRow[],
) {
  const session = await beginExcelExport(filename, sheetName)
  if (!session) return
  await finishExcelExport(session, columns, rows)
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
