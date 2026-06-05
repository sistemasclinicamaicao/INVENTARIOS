import { sanitizeMedicamentosPosRow } from '../../integrations/medicamentos-pos.presets';

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

export interface ParsedPosRow {
  atc: string | null;
  principioActivo: string | null;
  descripcionAtc: string | null;
  producto: string | null;
  expediente: string | null;
  registroSanitario: string | null;
  fechaVencimiento: string | null;
  estadoRegistro: string | null;
  descripcionComercial: string | null;
  unidad: string | null;
  viaAdministracion: string | null;
  concentracion: string | null;
  unidadMedida: string | null;
  cantidad: string | null;
  unidadReferencia: string | null;
  formaFarmaceutica: string | null;
  nombreRol: string | null;
  rawRow: Record<string, unknown>;
}

export function mapSocrataRowToPosRegistro(
  raw: Record<string, unknown>,
): ParsedPosRow {
  const row = sanitizeMedicamentosPosRow(raw);
  return {
    atc: cellStr(row.atc),
    principioActivo: cellStr(row.principioactivo),
    descripcionAtc: cellStr(row.descripcionatc),
    producto: cellStr(row.producto),
    expediente: cellStr(row.expediente),
    registroSanitario: cellStr(row.registrosanitario),
    fechaVencimiento: parseDate(row.fechavencimiento),
    estadoRegistro: cellStr(row.estadoregistro),
    descripcionComercial: cellStr(row.descripcioncomercial),
    unidad: cellStr(row.unidad),
    viaAdministracion: cellStr(row.viaadministracion),
    concentracion: cellStr(row.concentracion),
    unidadMedida: cellStr(row.unidadmedida),
    cantidad: cellStr(row.cantidad),
    unidadReferencia: cellStr(row.unidadreferencia),
    formaFarmaceutica: cellStr(row.formafarmaceutica),
    nombreRol: cellStr(row.nombrerol),
    rawRow: row,
  };
}

export function posRegistroToApiRow(row: {
  atc: string | null;
  principioActivo: string | null;
  descripcionAtc: string | null;
  producto: string | null;
  expediente: string | null;
  registroSanitario: string | null;
  fechaVencimiento: string | null;
  estadoRegistro: string | null;
  descripcionComercial: string | null;
  unidad: string | null;
  viaAdministracion: string | null;
  concentracion: string | null;
  unidadMedida: string | null;
  cantidad: string | null;
  unidadReferencia: string | null;
  formaFarmaceutica: string | null;
  nombreRol: string | null;
}): Record<string, unknown> {
  return {
    atc: row.atc,
    principioactivo: row.principioActivo,
    descripcionatc: row.descripcionAtc,
    producto: row.producto,
    expediente: row.expediente,
    registrosanitario: row.registroSanitario,
    fechavencimiento: row.fechaVencimiento,
    estadoregistro: row.estadoRegistro,
    descripcioncomercial: row.descripcionComercial,
    unidad: row.unidad,
    viaadministracion: row.viaAdministracion,
    concentracion: row.concentracion,
    unidadmedida: row.unidadMedida,
    cantidad: row.cantidad,
    unidadreferencia: row.unidadReferencia,
    formafarmaceutica: row.formaFarmaceutica,
    nombrerol: row.nombreRol,
  };
}
