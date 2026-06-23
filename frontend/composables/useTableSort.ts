export type TableSortDirection = 'asc' | 'desc'

function compareSortValues(
  a: string | number | boolean | null | undefined,
  b: string | number | boolean | null | undefined,
): number {
  const aMissing = a == null || a === ''
  const bMissing = b == null || b === ''
  if (aMissing && bMissing) return 0
  if (aMissing) return 1
  if (bMissing) return -1

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return Number(a) - Number(b)
  }

  return String(a).localeCompare(String(b), 'es', {
    numeric: true,
    sensitivity: 'base',
  })
}

/** Ordena filas en memoria (p. ej. pestaña Sincronización). */
export function sortRowsByKey<T>(
  rows: T[],
  sortBy: string,
  sortDir: TableSortDirection,
  getValue: (row: T, key: string) => unknown,
): T[] {
  const dir = sortDir === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const va = getValue(a, sortBy)
    const vb = getValue(b, sortBy)
    return (
      dir *
      compareSortValues(
        va as string | number | boolean | null,
        vb as string | number | boolean | null,
      )
    )
  })
}

export function useTableSort() {
  const sortBy = ref<string | null>(null)
  const sortDir = ref<TableSortDirection>('desc')

  function toggleSort(key: string, onChange?: () => void) {
    if (sortBy.value === key) {
      sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
    } else {
      sortBy.value = key
      sortDir.value = 'desc'
    }
    onChange?.()
  }

  function sortIndicator(key: string): string {
    if (sortBy.value !== key) return ''
    return sortDir.value === 'desc' ? ' ↓' : ' ↑'
  }

  function appendToParams(params: URLSearchParams) {
    if (sortBy.value) {
      params.set('sortBy', sortBy.value)
      params.set('sortDir', sortDir.value)
    }
  }

  function reset() {
    sortBy.value = null
    sortDir.value = 'desc'
  }

  const sortableThClass =
    'cursor-pointer select-none hover:bg-slate-700/80 transition-colors'

  return {
    sortBy,
    sortDir,
    toggleSort,
    sortIndicator,
    appendToParams,
    reset,
    sortableThClass,
  }
}
