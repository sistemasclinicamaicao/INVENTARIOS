export interface Supplier {
  id: string
  code: string
  name: string
  taxId?: string
}

export interface WarehouseOption {
  id: string
  code: string
  name: string
  type: string
}

export interface ProductSearchHit {
  id: string
  code: string
  name: string
  baseUnit: string
}

export interface PurchaseOrderLine {
  id?: string
  productId: string
  productCode?: string
  productName?: string
  qtyOrdered: number
  qtyErp?: number | null
  erpCode?: string | null
  fulfillmentStatus?: string | null
  qtyAlreadyReceived?: number | null
  unit: string
  unitPrice?: number
  lotNumber?: string | null
  expiresAt?: string | null
  lineTotal?: number
}

export interface PurchaseOrderSummary {
  id: string
  number: string
  supplierName: string
  supplierId: string | null
  status: string
  warehouseId: string
  warehouseName: string
  warehouseCode?: string | null
  createdAt: string
  lineCount: number
  importStatus?: string | null
  erpLinesCount?: number | null
  linkedLinesCount?: number | null
}

export interface PurchaseOrderDetail extends PurchaseOrderSummary {
  lines: PurchaseOrderLine[]
}
