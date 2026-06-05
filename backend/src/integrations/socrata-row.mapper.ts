import type { ParsedInvimaRow } from '../masters/invima/invima-parser';

function cellStr(v: unknown): string | null {
  if (v == null || v === '') return null;
  return String(v).trim() || null;
}

function parseDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'string') {
    const iso = v.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  }
  const d = new Date(v as string | number);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return null;
}

function buildCumCodigo(expedienteCum: string | null, consecutivo: string | null): string | null {
  if (!expedienteCum && !consecutivo) return null;
  const a = expedienteCum ?? '';
  const b = consecutivo ?? '';
  if (a && b) return `${a}-${b}`;
  return a || b || null;
}

/** Normaliza clave de columna API Socrata (minúsculas, sin espacios). */
function normKey(k: string): string {
  return k.toLowerCase().replace(/\s+/g, '');
}

const FIELD_ALIASES: Record<string, keyof ParsedInvimaRow> = {
  expediente: 'expediente',
  producto: 'producto',
  titular: 'titular',
  registrosanitario: 'registroSanitario',
  registro_sanitario: 'registroSanitario',
  fechaexpedicion: 'fechaExpedicion',
  fechavencimiento: 'fechaVencimiento',
  estadoregistro: 'estadoRegistro',
  expedientecum: 'expedienteCum',
  consecutivocum: 'consecutivoCum',
  cantidadcum: 'cantidadCum',
  descripcioncomercial: 'descripcionComercial',
  estadocum: 'estadoCum',
  fechaactivo: 'fechaActivo',
  fechainactivo: 'fechaInactivo',
  principioactivo: 'principioActivo',
  concentracion: 'concentracion',
  formafarmaceutica: 'formaFarmaceutica',
  viaadministracion: 'viaAdministracion',
  atc: 'atc',
  descripcionatc: 'descripcionAtc',
  ium: 'ium',
  muestramedica: 'muestraMedica',
  unidad: 'unidad',
  unidadmedida: 'unidadMedida',
  cantidad: 'cantidad',
  unidadreferencia: 'unidadReferencia',
  nombrerol: 'nombreRol',
  tiporol: 'tipoRol',
  modalidad: 'modalidad',
};

const DATE_FIELDS = new Set<keyof ParsedInvimaRow>([
  'fechaExpedicion',
  'fechaVencimiento',
  'fechaActivo',
  'fechaInactivo',
]);

/**
 * Mapea una fila JSON de Socrata (datos.gov.co) a ParsedInvimaRow para import INVIMA.
 */
export function mapSocrataRowToInvima(raw: Record<string, unknown>): ParsedInvimaRow | null {
  const parsed: ParsedInvimaRow = {
    expediente: null,
    producto: null,
    titular: null,
    registroSanitario: null,
    fechaExpedicion: null,
    fechaVencimiento: null,
    estadoRegistro: null,
    expedienteCum: null,
    consecutivoCum: null,
    cantidadCum: null,
    cumCodigo: null,
    descripcionComercial: null,
    estadoCum: null,
    fechaActivo: null,
    fechaInactivo: null,
    principioActivo: null,
    concentracion: null,
    formaFarmaceutica: null,
    viaAdministracion: null,
    atc: null,
    descripcionAtc: null,
    ium: null,
    muestraMedica: null,
    unidad: null,
    unidadMedida: null,
    cantidad: null,
    unidadReferencia: null,
    nombreRol: null,
    tipoRol: null,
    modalidad: null,
    rawRow: { ...raw },
  };

  for (const [key, val] of Object.entries(raw)) {
    const field = FIELD_ALIASES[normKey(key)];
    if (!field) continue;
    if (DATE_FIELDS.has(field)) {
      parsed[field] = parseDate(val) as never;
    } else {
      parsed[field] = cellStr(val) as never;
    }
  }

  parsed.cumCodigo = buildCumCodigo(parsed.expedienteCum, parsed.consecutivoCum);

  if (!parsed.expediente && !parsed.producto && !parsed.cumCodigo) return null;
  return parsed;
}

export function mapSocrataRowsToInvima(rows: unknown[]): ParsedInvimaRow[] {
  const out: ParsedInvimaRow[] = [];
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const mapped = mapSocrataRowToInvima(item as Record<string, unknown>);
    if (mapped) out.push(mapped);
  }
  return out;
}

export function extractColumnNames(rows: unknown[]): string[] {
  const first = rows.find((r) => r && typeof r === 'object');
  if (!first || typeof first !== 'object') return [];
  return Object.keys(first as Record<string, unknown>);
}
