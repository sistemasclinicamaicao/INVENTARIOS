export type PoLineFulfillment =
  | 'PENDING'
  | 'PARTIAL'
  | 'COMPLETE'
  | 'SURPLUS'
  | 'NOT_ARRIVED'

/** Acción del operador en esta sesión de recepción */
export type ReceptionLineAction = 'defer' | 'receive' | 'not_arrived' | 'complete'
export type PoImportStatus = 'COMPLETE' | 'INCOMPLETE'
export type MissingErpLineReason = 'MISSING_PRODUCT' | 'WRONG_CATALOG'

export interface WarehouseOption {
  id: string
  name: string
}

export interface ReceptionLine {
  id: string
  productId: string
  code: string
  name: string
  presentation: string
  qtyOrdered: number
  qtyErp: number
  qtyAlreadyReceived?: number
  qtyReceived: number
  unitPrice?: number
  requiresLot: boolean
  fulfillmentStatus?: PoLineFulfillment
  /** defer = pendiente; receive = recibir ahora; not_arrived = no vino en este despacho (sigue pendiente) */
  lineAction?: ReceptionLineAction
  lotNumber: string
  expiresAt: string
}

export interface MissingErpLine {
  erpCode: string
  erpDescription: string
  qtyErp: number
  unitPrice: number
  reason: MissingErpLineReason
}

export interface ReceptionOrder {
  purchaseOrderId: string
  ocNumber: string
  supplier: string
  supplierId?: string | null
  status?: string
  erpLinesCount?: number | null
  linkedLinesCount?: number | null
  importStatus?: PoImportStatus | null
  missingErpLines?: MissingErpLine[]
  warehouseId: string
  selectedWarehouseId: string
  selectedWarehouse: string
  warehouseCode?: string | null
  warehouseType?: string | null
  catalogFarmacia?: boolean | null
  warehouses: WarehouseOption[]
  warehouseOptions: string[]
  lines: ReceptionLine[]
}
