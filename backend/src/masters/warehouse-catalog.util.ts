/** Farmacia y almacén son catálogos distintos (products.is_farmacia). */
export function isFarmaciaWarehouseType(warehouseType: string): boolean {
  return warehouseType === 'CENTRAL_FARMACIA';
}

export function productBelongsToWarehouse(
  productIsFarmacia: boolean,
  warehouseType: string,
): boolean {
  return productIsFarmacia === isFarmaciaWarehouseType(warehouseType);
}

export function catalogLabel(isFarmacia: boolean): string {
  return isFarmacia ? 'farmacia' : 'almacén';
}
