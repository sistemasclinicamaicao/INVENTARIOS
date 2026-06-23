import { normalizeCumKey } from './cum-key.util';
import { normalizeAtc } from './medicamentos-pos.presets';

export type InvimaListTypeKey = 'VIGENTE' | 'VENCIDO' | 'RENOVACION' | 'OTRO_ESTADO';

export interface InvimaCumMatchRow {
  cumCodigo: string;
  listType: InvimaListTypeKey;
  estadoRegistro: string | null;
  fechaVencimiento: string | null;
  producto: string | null;
  registroSanitario: string | null;
  atc: string | null;
  cantidadCum: string | null;
}

export interface KrystalosMedicamentoRow {
  idArticulo: string;
  descripcion: string;
  codcum: string;
}

export type EstadoResumenKey =
  | 'VIGENTE'
  | 'VENCIDO'
  | 'RENOVACION'
  | 'OTRO'
  | 'SIN_REGISTRO'
  | 'SIN_CUM';

const LIST_PRIORITY: InvimaListTypeKey[] = [
  'VIGENTE',
  'RENOVACION',
  'OTRO_ESTADO',
  'VENCIDO',
];

export function normalizeCum(value: unknown): string {
  return normalizeCumKey(value);
}

export function parseKrystalosMedicamento(
  raw: Record<string, unknown>,
): KrystalosMedicamentoRow | null {
  const idArticulo = String(raw.IDARTICULO ?? raw.idarticulo ?? '').trim();
  const descripcion = String(raw.DESCRIPCION ?? raw.descripcion ?? '').trim();
  const codcum = normalizeCum(raw.codcum ?? raw.CODCUM ?? raw.cum ?? '');
  if (!idArticulo && !descripcion && !codcum) return null;
  return { idArticulo, descripcion, codcum };
}

export function pickBestInvimaMatch(
  matches: InvimaCumMatchRow[],
): InvimaCumMatchRow | null {
  if (!matches.length) return null;
  const sorted = [...matches].sort(
    (a, b) =>
      LIST_PRIORITY.indexOf(a.listType) - LIST_PRIORITY.indexOf(b.listType),
  );
  return sorted[0];
}

export function resolveEstadoResumen(
  med: KrystalosMedicamentoRow,
  matches: InvimaCumMatchRow[],
): { key: EstadoResumenKey; label: string } {
  if (!med.codcum) {
    return { key: 'SIN_CUM', label: 'Sin CUM en Krystalos' };
  }
  const best = pickBestInvimaMatch(matches);
  if (!best) {
    return { key: 'SIN_REGISTRO', label: 'Sin registro INVIMA' };
  }
  if (best.listType === 'VIGENTE') {
    const label = best.estadoRegistro?.trim() || 'Vigente';
    return { key: 'VIGENTE', label };
  }
  if (best.listType === 'VENCIDO') {
    return { key: 'VENCIDO', label: best.estadoRegistro?.trim() || 'Vencido' };
  }
  if (best.listType === 'RENOVACION') {
    return {
      key: 'RENOVACION',
      label: best.estadoRegistro?.trim() || 'En renovación',
    };
  }
  return {
    key: 'OTRO',
    label: best.estadoRegistro?.trim() || 'Otro estado',
  };
}

export type EstadoFilter =
  | 'ALL'
  | 'MATCHED'
  | 'NOT_MATCHED'
  | 'VIGENTE'
  | 'VENCIDO'
  | 'RENOVACION'
  | 'OTRO'
  | 'SIN_CUM'
  | 'REGULADOS';

export function matchesEstadoFilter(
  key: EstadoResumenKey,
  filter: EstadoFilter,
): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'MATCHED') return key !== 'SIN_REGISTRO' && key !== 'SIN_CUM';
  if (filter === 'NOT_MATCHED') return key === 'SIN_REGISTRO' || key === 'SIN_CUM';
  if (filter === 'OTRO') return key === 'OTRO';
  return key === filter;
}

export function resolvePosLabel(
  invimaAtc: string | null | undefined,
  posAtcSet: Set<string>,
): { posMatched: boolean; posLabel: 'Medicamento POS' | 'NO POS' } {
  const atc = normalizeAtc(invimaAtc);
  if (atc && posAtcSet.has(atc)) {
    return { posMatched: true, posLabel: 'Medicamento POS' };
  }
  return { posMatched: false, posLabel: 'NO POS' };
}

export type KrystalosInvimaEstadoSortKey =
  | 'posLabel'
  | 'invimaMatched'
  | 'idArticulo'
  | 'descripcion'
  | 'codcum'
  | 'pmvPrecioUnitario'
  | 'pmvRegulado'
  | 'estadoLabel'
  | 'invimaListType'
  | 'invimaFechaVencimiento'
  | 'invimaProducto';

export type SortDirection = 'asc' | 'desc';

const ESTADO_SORT_KEYS: readonly KrystalosInvimaEstadoSortKey[] = [
  'posLabel',
  'invimaMatched',
  'idArticulo',
  'descripcion',
  'codcum',
  'pmvPrecioUnitario',
  'pmvRegulado',
  'estadoLabel',
  'invimaListType',
  'invimaFechaVencimiento',
  'invimaProducto',
];

export function isValidEstadoSortKey(
  key?: string,
): key is KrystalosInvimaEstadoSortKey {
  return !!key && (ESTADO_SORT_KEYS as readonly string[]).includes(key);
}

export function parseSortDirection(dir?: string): SortDirection | undefined {
  if (dir === 'asc' || dir === 'desc') return dir;
  return undefined;
}

export interface KrystalosInvimaEstadoSortRow {
  posLabel: string;
  invimaMatched: boolean;
  idArticulo: string;
  descripcion: string;
  codcum: string | null;
  pmvPrecioUnitario: number | null;
  pmvRegulado: boolean;
  estadoLabel: string;
  invimaListType: string | null;
  invimaFechaVencimiento: string | null;
  invimaProducto: string | null;
}

function compareEstadoSortValues(
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

function estadoSortValue(
  row: KrystalosInvimaEstadoSortRow,
  sortBy: KrystalosInvimaEstadoSortKey,
): string | number | boolean | null {
  switch (sortBy) {
    case 'posLabel':
      return row.posLabel;
    case 'invimaMatched':
      return row.invimaMatched;
    case 'idArticulo':
      return row.idArticulo;
    case 'descripcion':
      return row.descripcion;
    case 'codcum':
      return row.codcum;
    case 'pmvPrecioUnitario':
      return row.pmvPrecioUnitario;
    case 'pmvRegulado':
      return row.pmvRegulado;
    case 'estadoLabel':
      return row.estadoLabel;
    case 'invimaListType':
      return row.invimaListType;
    case 'invimaFechaVencimiento':
      return row.invimaFechaVencimiento;
    case 'invimaProducto':
      return row.invimaProducto;
    default:
      return null;
  }
}

export function sortKrystalosInvimaEstadoRows<T extends KrystalosInvimaEstadoSortRow>(
  rows: T[],
  sortBy: KrystalosInvimaEstadoSortKey,
  sortDir: SortDirection,
): T[] {
  const dir = sortDir === 'desc' ? -1 : 1;
  return [...rows].sort(
    (a, b) =>
      dir *
      compareEstadoSortValues(
        estadoSortValue(a, sortBy),
        estadoSortValue(b, sortBy),
      ),
  );
}
