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
  return String(value ?? '')
    .trim()
    .toUpperCase();
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
  | 'SIN_CUM';

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
