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
  'ajuste_julio_2025',
] as const;

export const INVIMA_PMV_SOQL = `SELECT ${INVIMA_PMV_SOQL_COLUMNS.join(', ')}`;

export const INVIMA_PMV_INTEGRATION_NAME = 'PRECIOS PMV';

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
