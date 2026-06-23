import * as XLSX from 'xlsx';

export interface ParsedPmvRow {
  numero: string | null;
  idMr: string | null;
  mercadoRelevante: string | null;
  cum: string | null;
  medicamento: string | null;
  cantidadUnidadMedida: string | null;
  unidadMedida: string | null;
  precioMaxInstitucional: number | null;
  margenIps: number | null;
  precioMaxComercialPs: number | null;
  precioMaxComercialFinal: number | null;
  circularCnpmdm: string | null;
  fechaInicioVigencia: string | null;
  ajusteJulio2025: string | null;
  rawRow: Record<string, unknown>;
}

const PMV_SHEET = 'PMV';

function cellStr(v: unknown): string | null {
  if (v == null || v === '') return null;
  return String(v).trim() || null;
}

function parsePrice(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseExcelDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s || null;
}

function pickRow(obj: Record<string, unknown>): ParsedPmvRow {
  return {
    numero: cellStr(obj['No.']),
    idMr: cellStr(obj['ID MR']),
    mercadoRelevante: cellStr(obj['Mercado Relevante']),
    cum: cellStr(obj['CUM']),
    medicamento: cellStr(obj['Medicamento']),
    cantidadUnidadMedida: cellStr(obj['Cantidad por unidad de medida']),
    unidadMedida: cellStr(obj['Unidad de medida']),
    precioMaxInstitucional: parsePrice(
      obj['Precio máximo de venta transacción primaria, secundaria y final Institucional'],
    ),
    margenIps: parsePrice(obj['Margen para IPS']),
    precioMaxComercialPs: parsePrice(
      obj['Precio máximo de venta transacción primaria y secundaria comercial'],
    ),
    precioMaxComercialFinal: parsePrice(
      obj['Precio máximo de venta transacción final comercial'],
    ),
    circularCnpmdm: cellStr(obj['Circular CNPMDM']),
    fechaInicioVigencia: parseExcelDate(
      obj['Fecha de inicio vigencia precio máximo de venta'],
    ),
    ajusteJulio2025: cellStr(obj['Ajuste Julio 2025']),
    rawRow: obj,
  };
}

export function parseInvimaPmvWorkbook(buffer: Buffer): ParsedPmvRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = wb.SheetNames.includes(PMV_SHEET) ? PMV_SHEET : wb.SheetNames[0];
  if (!sheetName) {
    throw new Error('El archivo no contiene hojas');
  }
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: true,
  });
  return rows
    .map(pickRow)
    .filter((r) => r.cum || r.medicamento || r.idMr);
}
