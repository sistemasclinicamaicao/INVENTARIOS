export type RequisitionPriority = 'ALTA' | 'MEDIA' | 'NORMAL'

export type RequisitionStatus =
  | 'PENDING'
  | 'IN_PICKING'
  | 'DISPATCHED'
  | 'RECEIVED'
  | 'CANCELLED'

export interface SatelliteWarehouse {
  id: string
  code: string
  name: string
  policy: string
}

export interface CentralWarehouseOption {
  id: string
  code: string
  name: string
  type: string
}

export interface RequisitionLineDraft {
  key: string
  productId: string
  code: string
  name: string
  qty: number
  unit: string
}

export interface RequisitionHeaderDraft {
  sourceWarehouseId: string
  destWarehouseId: string
  priority: RequisitionPriority
}

export interface InternalRequisitionRow {
  id: string
  status: RequisitionStatus
  priority: RequisitionPriority
  destination: string
  source: string
  createdAt: string
  lineCount?: number
  productsSummary?: string | null
}

export interface SatellitesResponse {
  warehouses: SatelliteWarehouse[]
  requisitions: InternalRequisitionRow[]
}
