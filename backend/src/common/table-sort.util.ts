export type SortDirection = 'asc' | 'desc';

export function parseSortDirection(dir?: string): SortDirection | undefined {
  if (dir === 'asc' || dir === 'desc') return dir;
  return undefined;
}

export function resolveSqlOrderClause(
  sortBy: string | undefined,
  sortDir: SortDirection | undefined,
  columnMap: Record<string, string>,
  defaultOrder: string,
): string {
  if (sortBy && sortDir && columnMap[sortBy]) {
    const sqlCol = columnMap[sortBy];
    const dir = sortDir === 'desc' ? 'DESC' : 'ASC';
    return `${sqlCol} ${dir} NULLS LAST, r.id`;
  }
  return defaultOrder;
}

function compareSortValues(
  a: string | number | boolean | null | undefined,
  b: string | number | boolean | null | undefined,
): number {
  const aMissing = a == null || a === '';
  const bMissing = b == null || b === '';
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return Number(a) - Number(b);
  }

  return String(a).localeCompare(String(b), 'es', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function getRecordField(
  row: Record<string, unknown>,
  key: string,
): unknown {
  if (Object.prototype.hasOwnProperty.call(row, key)) {
    return row[key];
  }
  const target = key.toLowerCase();
  for (const [k, v] of Object.entries(row)) {
    if (k.toLowerCase() === target) return v;
  }
  return undefined;
}

export function sortRecordsByKey<T extends Record<string, unknown>>(
  rows: T[],
  sortBy: string,
  sortDir: SortDirection,
): T[] {
  const dir = sortDir === 'desc' ? -1 : 1;
  return [...rows].sort(
    (a, b) =>
      dir * compareSortValues(
        getRecordField(a, sortBy) as string | number | boolean | null,
        getRecordField(b, sortBy) as string | number | boolean | null,
      ),
  );
}
