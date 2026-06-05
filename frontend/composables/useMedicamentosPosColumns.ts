export const MEDICAMENTOS_POS_COLUMN_LABELS: Record<string, string> = {
  atc: 'ATC',
  principioactivo: 'Principio activo',
  descripcionatc: 'Descripción ATC',
  producto: 'Producto',
  expediente: 'Expediente',
  registrosanitario: 'Registro sanitario',
  fechavencimiento: 'Vence',
  estadoregistro: 'Estado registro',
  descripcioncomercial: 'Descripción comercial',
  unidad: 'Unidad',
  viaadministracion: 'Vía administración',
  concentracion: 'Concentración',
  unidadmedida: 'Unidad medida',
  cantidad: 'Cantidad',
  unidadreferencia: 'Unidad referencia',
  formafarmaceutica: 'Forma farmacéutica',
  nombrerol: 'Titular / rol',
}

export function medicamentosPosColLabel(col: string): string {
  return MEDICAMENTOS_POS_COLUMN_LABELS[col] ?? col
}
