export interface ReceptionHistoryRow {
  id: string
  number: string
  receivedAt: string
  isPartial: boolean
  purchaseOrderId: string
  ocNumber: string
  supplierName: string
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  receivedByName: string
  receivedByCedula?: string | null
  lineCount: number
  totalQtyReceived: number
}

export interface ReceptionHistoryLine {
  id: string
  productCode: string
  productName: string
  qtyReceived: number
  unit: string
  lotNumber?: string | null
  expiresAt?: string | null
  ocLineQty?: number | null
}

export interface ReceptionHistoryDetail extends ReceptionHistoryRow {
  lines: ReceptionHistoryLine[]
}

export interface ReceptionHistoryFilters {
  oc: string
  warehouseId: string
  from: string
  to: string
}

export interface ReceptionHistoryListResult {
  items: ReceptionHistoryRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}
