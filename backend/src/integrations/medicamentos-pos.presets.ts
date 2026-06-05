/** Dataset Socrata «Medicamentos POS» (Plan Obligatorio de Salud) — datos.gov.co view a7iv-sme8 */

export const MEDICAMENTOS_POS_DATASET_ID = 'a7iv-sme8';

export const MEDICAMENTOS_POS_BASE_URL = 'https://www.datos.gov.co';

export const MEDICAMENTOS_POS_SOQL_COLUMNS = [
  'atc',
  'principioactivo',
  'descripcionatc',
  'producto',
  'expediente',
  'registrosanitario',
  'fechavencimiento',
  'estadoregistro',
  'descripcioncomercial',
  'unidad',
  'viaadministracion',
  'concentracion',
  'unidadmedida',
  'cantidad',
  'unidadreferencia',
  'formafarmaceutica',
  'nombrerol',
] as const;

export const MEDICAMENTOS_POS_SOQL = `SELECT ${MEDICAMENTOS_POS_SOQL_COLUMNS.join(', ')}`;

export const MEDICAMENTOS_POS_INTEGRATION_NAME = 'MEDICAMENTOS POS';

/** Quita metadatos Socrata (:id, :version, …) de filas para vista y búsqueda. */
export function sanitizeMedicamentosPosRow(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith(':')) continue;
    out[k] = v;
  }
  return out;
}

export function medicamentosPosColumnNames(
  rows: Record<string, unknown>[],
): string[] {
  if (!rows.length) return [...MEDICAMENTOS_POS_SOQL_COLUMNS];
  const keys = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(sanitizeMedicamentosPosRow(row))) {
      keys.add(k);
    }
  }
  const ordered = MEDICAMENTOS_POS_SOQL_COLUMNS.filter((c) => keys.has(c));
  const rest = [...keys].filter((k) => !ordered.includes(k as (typeof MEDICAMENTOS_POS_SOQL_COLUMNS)[number]));
  return [...ordered, ...rest.sort()];
}

export function normalizeAtc(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

/** Conjunto de códigos ATC presentes en el catálogo POS. */
export function buildPosAtcSet(rows: Record<string, unknown>[]): Set<string> {
  const set = new Set<string>();
  for (const row of rows) {
    const atc = normalizeAtc(row.atc);
    if (atc) set.add(atc);
  }
  return set;
}
