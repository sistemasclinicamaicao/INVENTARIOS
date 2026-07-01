/** Dataset Socrata «Precios PMV» — datos.gov.co view nauz-qkjw */

export const INVIMA_PMV_DATASET_ID = 'nauz-qkjw';

export const INVIMA_PMV_BASE_URL = 'https://www.datos.gov.co';

export const INVIMA_PMV_SOQL_COLUMNS = [
  'no',
  'id_mr',
  'mercado_relevante',
  'cum',
  'medicamento',
  'cantidad_por_unidad_de_medida',
  'unidad_de_medida',
  'precio_maximo_de_venta_transaccion_primaria_secundaria_y_final_institucional',
  'margen_para_ips',
  'precio_maximo_de_venta_transaccion_primaria_y_secundaria_comercial',
  'precio_maximo_de_venta_transaccion_final_comercial',
  'circular_cnpmdm',
  'fecha_de_inicio_vigencia_precio_maximo_de_venta',
] as const;

export const INVIMA_PMV_SOQL = `SELECT ${INVIMA_PMV_SOQL_COLUMNS.join(', ')}`;

export const INVIMA_PMV_INTEGRATION_NAME = 'PRECIOS PMV';

/** Columnas retiradas del dataset Socrata que no deben ir en SoQL. */
const PMV_REMOVED_SOQL_COLUMNS = ['ajuste_julio_2025'] as const;

/** Corrige consultas PMV guardadas con columnas obsoletas. */
export function normalizeInvimaPmvSocrataQuery(query: string): string {
  let q = query.trim().replace(/;\s*$/, '');
  for (const col of PMV_REMOVED_SOQL_COLUMNS) {
    q = q.replace(new RegExp(`,\\s*${col}\\b`, 'gi'), '');
    q = q.replace(new RegExp(`\\b${col}\\s*,`, 'gi'), '');
    q = q.replace(new RegExp(`\\b${col}\\b`, 'gi'), '');
  }
  return q.replace(/\s+/g, ' ').trim();
}

/** Quita metadatos Socrata (:id, :version, …) de filas PMV. */
export function sanitizeInvimaPmvSocrataRow(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith(':')) continue;
    out[k] = v;
  }
  return out;
}
