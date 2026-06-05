import * as XLSX from 'xlsx';

export type InvimaListType = 'VIGENTE' | 'VENCIDO' | 'RENOVACION' | 'OTRO_ESTADO';

export const INVIMA_LIST_TYPE_VALUES: InvimaListType[] = [
  'VIGENTE',
  'VENCIDO',
  'RENOVACION',
  'OTRO_ESTADO',
];

export interface ParsedInvimaRow {
  expediente: string | null;
  producto: string | null;
  titular: string | null;
  registroSanitario: string | null;
  fechaExpedicion: string | null;
  fechaVencimiento: string | null;
  estadoRegistro: string | null;
  expedienteCum: string | null;
  consecutivoCum: string | null;
  cantidadCum: string | null;
  cumCodigo: string | null;
  descripcionComercial: string | null;
  estadoCum: string | null;
  fechaActivo: string | null;
  fechaInactivo: string | null;
  principioActivo: string | null;
  concentracion: string | null;
  formaFarmaceutica: string | null;
  viaAdministracion: string | null;
  atc: string | null;
  descripcionAtc: string | null;
  ium: string | null;
  muestraMedica: string | null;
  unidad: string | null;
  unidadMedida: string | null;
  cantidad: string | null;
  unidadReferencia: string | null;
  nombreRol: string | null;
  tipoRol: string | null;
  modalidad: string | null;
  rawRow: Record<string, unknown>;
}

const HEADER_MAP: Record<string, keyof ParsedInvimaRow | 'skip'> = {
  EXPEDIENTE: 'expediente',
  PRODUCTO: 'producto',
  TITULAR: 'titular',
  'REGISTRO SANITARIO': 'registroSanitario',
  'FECHA EXPEDICIÓN': 'fechaExpedicion',
  'FECHA EXPEDICION': 'fechaExpedicion',
  'FECHA VENCIMIENTO': 'fechaVencimiento',
  'ESTADO REGISTRO': 'estadoRegistro',
  'EXPEDIENTE CUM': 'expedienteCum',
  CONSECUTIVO: 'consecutivoCum',
  'CANTIDAD CUM': 'cantidadCum',
  'DESCRIPCIÓN COMERCIAL': 'descripcionComercial',
  'DESCRIPCION COMERCIAL': 'descripcionComercial',
  'ESTADO CUM': 'estadoCum',
  'FECHA ACTIVO': 'fechaActivo',
  'FECHA INACTIVO': 'fechaInactivo',
  'PRINCIPIO ACTIVO': 'principioActivo',
  CONCENTRACIÓN: 'concentracion',
  CONCENTRACION: 'concentracion',
  'FORMA FARMACÉUTICA': 'formaFarmaceutica',
  'FORMA FARMACEUTICA': 'formaFarmaceutica',
  'VÍA ADMINISTRACIÓN': 'viaAdministracion',
  'VIA ADMINISTRACION': 'viaAdministracion',
  ATC: 'atc',
  DESCRIPCIÓN_ATC: 'descripcionAtc',
  DESCRIPCION_ATC: 'descripcionAtc',
  IUM: 'ium',
  'MUESTRA MEDICA': 'muestraMedica',
  'MUESTRA MÉDICA': 'muestraMedica',
  UNIDAD: 'unidad',
  'UNIDAD MEDIDA': 'unidadMedida',
  CANTIDAD: 'cantidad',
  'UNIDAD REFERENCIA': 'unidadReferencia',
  'NOMBRE ROL': 'nombreRol',
  'TIPO ROL': 'tipoRol',
  MODALIDAD: 'modalidad',
};

function cellStr(v: unknown): string | null {
  if (v == null || v === '') return null;
  return String(v).trim() || null;
}

function parseUsDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = m[1].padStart(2, '0');
    const dd = m[2].padStart(2, '0');
    return `${m[3]}-${mm}-${dd}`;
  }
  return null;
}

function buildCumCodigo(expedienteCum: string | null, consecutivo: string | null): string | null {
  if (expedienteCum == null && consecutivo == null) return null;
  const a = expedienteCum ?? '';
  const b = consecutivo ?? '';
  if (a && b) return `${a}-${b}`;
  return a || b || null;
}

export function inferListTypeFromFilename(name: string): InvimaListType | null {
  const n = name.toLowerCase();
  if (n.includes('vigente')) return 'VIGENTE';
  if (n.includes('vencido')) return 'VENCIDO';
  if (n.includes('renovacion')) return 'RENOVACION';
  if (n.includes('otros')) return 'OTRO_ESTADO';
  return null;
}

export function parseInvimaWorkbook(buffer: Buffer): {
  rows: ParsedInvimaRow[];
  generatedAt: string | null;
} {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  }) as unknown[][];

  let headerRowIdx = -1;
  let generatedAt: string | null = null;

  for (let i = 0; i < Math.min(matrix.length, 20); i++) {
    const row = matrix[i] ?? [];
    const texts = row.map((c) => cellStr(c)).filter(Boolean) as string[];
    const joined = texts.join(' ').toUpperCase();
    if (joined.includes('FECHA DE GENERACI')) {
      const dateMatch = joined.match(/(\d{1,2})\s+DE\s+(\w+)\s+DE\s+(\d{4})/i);
      if (dateMatch) {
        generatedAt = null;
      }
    }
    if (texts.some((t) => t.toUpperCase() === 'EXPEDIENTE') && texts.some((t) => t.toUpperCase() === 'PRODUCTO')) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx < 0) {
    return { rows: [], generatedAt };
  }

  const headerCells = (matrix[headerRowIdx] ?? []).map((c) =>
    cellStr(c)?.toUpperCase().replace(/\s+/g, ' ').trim() ?? '',
  );
  const colMap: { field: keyof ParsedInvimaRow; idx: number }[] = [];
  headerCells.forEach((h, idx) => {
    const field = HEADER_MAP[h];
    if (field && field !== 'skip') {
      colMap.push({ field, idx });
    }
  });

  const rows: ParsedInvimaRow[] = [];

  for (let i = headerRowIdx + 1; i < matrix.length; i++) {
    const line = matrix[i] ?? [];
    if (!line.some((c) => c != null && String(c).trim() !== '')) continue;

    const rawRow: Record<string, unknown> = {};
    headerCells.forEach((h, idx) => {
      if (h) rawRow[h] = line[idx] ?? null;
    });

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
      rawRow,
    };

    for (const { field, idx } of colMap) {
      const val = line[idx];
      if (
        field === 'fechaExpedicion' ||
        field === 'fechaVencimiento' ||
        field === 'fechaActivo' ||
        field === 'fechaInactivo'
      ) {
        (parsed as unknown as Record<string, unknown>)[field] = parseUsDate(val);
      } else {
        (parsed as unknown as Record<string, unknown>)[field] = cellStr(val);
      }
    }

    parsed.cumCodigo = buildCumCodigo(parsed.expedienteCum, parsed.consecutivoCum);
    if (!parsed.expediente && !parsed.producto && !parsed.cumCodigo) continue;

    rows.push(parsed);
  }

  return { rows, generatedAt };
}
