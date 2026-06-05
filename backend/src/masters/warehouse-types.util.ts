/** Tipos de bodega en PostgreSQL (warehouses.type). */
export const WAREHOUSE_TYPE = {
  CENTRAL_ALMACEN: 'CENTRAL_ALMACEN',
  CENTRAL_FARMACIA: 'CENTRAL_FARMACIA',
  BODEGA_CONFECCIONES: 'BODEGA_CONFECCIONES',
  /** Legacy / inactivo — ya no viene de CXC */
  BODEGA_HEMODERIVADOS: 'BODEGA_HEMODERIVADOS',
  SATELITE: 'SATELITE',
} as const;

export type WarehouseType = (typeof WAREHOUSE_TYPE)[keyof typeof WAREHOUSE_TYPE];

/** Bodegas destino válidas en órdenes de compra / recepción (mapeo 1:1 con CXC). */
export const PURCHASE_DESTINATION_TYPES = [
  WAREHOUSE_TYPE.CENTRAL_ALMACEN,
  WAREHOUSE_TYPE.CENTRAL_FARMACIA,
  WAREHOUSE_TYPE.BODEGA_CONFECCIONES,
] as const;

export type PurchaseDestinationType = (typeof PURCHASE_DESTINATION_TYPES)[number];

export function isPurchaseDestination(type: string): type is PurchaseDestinationType {
  return (PURCHASE_DESTINATION_TYPES as readonly string[]).includes(type);
}

export function usesFefoPolicy(type: string): boolean {
  return type === WAREHOUSE_TYPE.CENTRAL_FARMACIA;
}
