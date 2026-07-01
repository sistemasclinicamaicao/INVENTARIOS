import { formatQty } from '~/utils/locale-format'

export const INVIMA_PMV_COLUMN_LABELS: Record<string, string> = {
  cum: 'CUM',
  idMr: 'ID MR',
  mercadoRelevante: 'Mercado relevante',
  medicamento: 'Medicamento',
  cantidadUnidadMedida: 'Cantidad U. medida',
  unidadMedida: 'U. medida',
  precioMaxInstitucional: 'Precio máx. institucional',
  margenIps: 'Margen IPS',
  precioMaxComercialPs: 'Precio máx. comercial P/S',
  precioMaxComercialFinal: 'Precio máx. final comercial',
  circularCnpmdm: 'Circular CNPMDM',
  fechaInicioVigencia: 'Inicio vigencia',
  ajusteJulio2025: 'Ajuste Jul 2025',
  numero: 'No.',
};

export function invimaPmvColLabel(col: string): string {
  return INVIMA_PMV_COLUMN_LABELS[col] ?? col;
}

export function formatPmvPrice(v: unknown): string {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return formatQty(n, 2)
}
