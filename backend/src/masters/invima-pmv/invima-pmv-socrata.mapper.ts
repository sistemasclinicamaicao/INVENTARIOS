import { sanitizeInvimaPmvSocrataRow } from '../../integrations/invima-pmv.presets';
import {
  cellStr,
  parseExcelDate,
  parsePmvNumeric,
  type ParsedPmvRow,
} from './invima-pmv.parser';

function mapSanitizedRow(obj: Record<string, unknown>): ParsedPmvRow {
  return {
    numero: cellStr(obj.no ?? obj['No.']),
    idMr: cellStr(obj.id_mr ?? obj['ID MR']),
    mercadoRelevante: cellStr(obj.mercado_relevante ?? obj['Mercado Relevante']),
    cum: cellStr(obj.cum ?? obj.CUM),
    medicamento: cellStr(obj.medicamento ?? obj.Medicamento),
    cantidadUnidadMedida: cellStr(
      obj.cantidad_por_unidad_de_medida ?? obj['Cantidad por unidad de medida'],
    ),
    unidadMedida: cellStr(obj.unidad_de_medida ?? obj['Unidad de medida']),
    precioMaxInstitucional: parsePmvNumeric(
      obj.precio_maximo_de_venta_transaccion_primaria_secundaria_y_final_institucional ??
        obj['Precio máximo de venta transacción primaria, secundaria y final Institucional'],
    ),
    margenIps: parsePmvNumeric(obj.margen_para_ips ?? obj['Margen para IPS']),
    precioMaxComercialPs: parsePmvNumeric(
      obj.precio_maximo_de_venta_transaccion_primaria_y_secundaria_comercial ??
        obj['Precio máximo de venta transacción primaria y secundaria comercial'],
    ),
    precioMaxComercialFinal: parsePmvNumeric(
      obj.precio_maximo_de_venta_transaccion_final_comercial ??
        obj['Precio máximo de venta transacción final comercial'],
    ),
    circularCnpmdm: cellStr(obj.circular_cnpmdm ?? obj['Circular CNPMDM']),
    fechaInicioVigencia: parseExcelDate(
      obj.fecha_de_inicio_vigencia_precio_maximo_de_venta ??
        obj['Fecha de inicio vigencia precio máximo de venta'],
    ),
    ajusteJulio2025: cellStr(obj.ajuste_julio_2025 ?? obj['Ajuste Julio 2025']),
    rawRow: obj,
  };
}

export function mapSocrataRowToPmvRegistro(
  raw: Record<string, unknown>,
): ParsedPmvRow | null {
  const obj = sanitizeInvimaPmvSocrataRow(raw);
  const row = mapSanitizedRow(obj);
  if (!row.cum && !row.medicamento && !row.idMr) return null;
  return row;
}

export function mapSocrataRowsToPmvRegistros(
  rows: Record<string, unknown>[],
): ParsedPmvRow[] {
  const out: ParsedPmvRow[] = [];
  for (const item of rows) {
    const mapped = mapSocrataRowToPmvRegistro(item);
    if (mapped) out.push(mapped);
  }
  return out;
}
