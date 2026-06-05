export interface InventoryBalanceRow {
  balanceId: string
  productId: string
  productCode: string
  productName: string
  productDescription?: string | null
  warehouseId: string
  warehouseName: string
  warehouseCode: string
  warehouseType?: string | null
  warehousePolicy?: string | null
  locationCode?: string | null
  locationName?: string | null
  lotId?: string | null
  lotNumber: string | null
  expiresAt: string | null
  lotInternalBarcode?: string | null
  qty: number
  unit: string
  minStock: number
  unitPrice?: number | null
  lineValue?: number | null
  isFarmacia?: boolean
  requiresLot?: boolean
  isControlado?: boolean
  productPolicy?: string | null
  lowStock: boolean
}

export interface InventoryWarehouseRow {
  id: string
  code: string
  name: string
  type: string
  policy: string
  totalQty: string
  productCount: string
}
