/** Línea cruda API Crystalos / CXCQRYSTALOS */
export interface ErpCxcLine {
  NIT?: string
  RAZONSOCIAL?: string
  CODIGO?: string
  DESCRIPCION?: string
  CANT_AUTO?: number
  VLR_UNITARIO?: number
  VLR_BRUTO?: number
  DESCUENTO?: number
  IMPUESTO?: number
  VALOR_TOTAL?: number
  VLRUNI_IMP?: number
  NRO_LOTE?: string
  DETALLE?: string
  BODEGA?: string
  CODBODEGA?: string
  NOMBODEGA?: string
  BODEGA_DESTINO?: string
}

/** Línea ERP en vista combinada de varias OC */
export type ErpCxcLineWithOc = ErpCxcLine & { ocNumber: string }

export interface OcConsultEntry {
  number: string
  loading?: boolean
  error?: string | null
  result?: OcLookupResult | null
}

export type OcHeaderMatch =
  | 'purchase_order_db'
  | 'erp_warehouse'
  | 'erp_warehouse_created'
  | 'supplier_tax_id'
  | 'supplier_erp_created'
  | 'supplier_name'
  | 'supplier_last_order'
  | 'products_policy'
  | 'products_code_prefix'
  | 'default_warehouse'
  | 'none'

export interface OcResolvedHeader {
  supplierId: string | null
  warehouseId: string | null
  supplierName: string | null
  warehouseName: string | null
  warehouseCode: string | null
  warehouseType?: string | null
  matchedBy: OcHeaderMatch
  supplierMatchedBy?: OcHeaderMatch
  warehouseMatchedBy?: OcHeaderMatch
}

export interface OcLookupResult {
  found: boolean
  source: 'local' | 'erp'
  message?: string
  header?: OcResolvedHeader
  local?: import('~/types/purchases').PurchaseOrderDetail
  erp?: ErpPollResult
}

export interface ErpPollResult {
  ok: boolean
  httpStatus: number
  durationMs: number
  url?: string
  integrationName?: string
  integrationId?: string
  mapped?: {
    number: string
    status: string
    supplier: { id?: string; name: string }
    lines: {
      productCode: string
      productName: string
      qtyOrdered: number
      unitPrice: number
      lineTotal: number
      lotNumber?: string | null
    }[]
    totals: { lineCount: number; amount: number }
  }
  erpLines?: ErpCxcLine[] | null
  erpHeader?: {
    nit: string
    razonSocial: string
    warehouse?: { code: string; name: string } | null
  } | null
  message?: string
  source?: string
}
