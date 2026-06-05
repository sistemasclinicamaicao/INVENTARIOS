import { extractColumnNames } from './socrata-row.mapper';

function flattenCell(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function flattenRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = flattenCell(v);
  }
  return out;
}

/** Extrae filas tabulares de una respuesta JSON REST (array u objetos anidados comunes). */
export function extractJsonTableRows(data: unknown): Record<string, unknown>[] {
  if (data == null) return [];

  if (Array.isArray(data)) {
    return data
      .filter((r) => r && typeof r === 'object' && !Array.isArray(r))
      .map((r) => flattenRow(r as Record<string, unknown>));
  }

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['data', 'rows', 'results', 'items', 'value', 'records']) {
      const inner = obj[key];
      if (Array.isArray(inner)) {
        return extractJsonTableRows(inner);
      }
    }
    return [flattenRow(obj)];
  }

  return [];
}

export { extractColumnNames };
