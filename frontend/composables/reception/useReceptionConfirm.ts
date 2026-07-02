import type { ReceptionLine, ReceptionOrder } from '~/types/reception'

export function isActionableReceptionLine(l: {
  fulfillmentStatus?: string
  qtyErp: number
  qtyAlreadyReceived?: number
  lineAction?: string
}) {
  if (l.lineAction === 'complete') return false
  if (l.fulfillmentStatus === 'COMPLETE' || l.fulfillmentStatus === 'SURPLUS') return false
  return Math.max(0, l.qtyErp - (l.qtyAlreadyReceived ?? 0)) > 0
}

export function applyReceptionOrder(data: ReceptionOrder): ReceptionOrder {
  return {
    ...data,
    lines: data.lines.map((l) => ({
      ...l,
      lineAction:
        l.lineAction ??
        (l.fulfillmentStatus === 'COMPLETE' || l.fulfillmentStatus === 'SURPLUS'
          ? 'complete'
          : 'defer'),
      qtyReceived: l.lineAction === 'receive' ? l.qtyReceived : 0,
    })),
  }
}

export function validateReceptionConfirm(
  order: ReceptionOrder,
  warehouseId: string,
  isFarmaciaWarehouse: boolean,
): string | null {
  if (!order.purchaseOrderId) return 'Cargue una orden de compra primero'
  if (!warehouseId) return 'La OC no tiene bodega destino asignada'

  const receiveLines = order.lines.filter((l) => l.lineAction === 'receive')
  const receiveWithQty = receiveLines.filter((l) => l.qtyReceived > 0)
  if (!receiveWithQty.length) {
    return 'Marque al menos un artículo con cantidad a recibir'
  }

  const missingLot = receiveWithQty.filter(
    (l) =>
      isFarmaciaWarehouse &&
      l.requiresLot &&
      (!l.lotNumber?.trim() || l.lotNumber.trim() === '0' || !l.expiresAt),
  )
  if (missingLot.length) {
    return `Complete lote y vencimiento: ${missingLot.map((l) => l.code).join(', ')}`
  }

  const invalidQty = receiveWithQty.filter((l) => {
    const max = Math.max(0, l.qtyErp - (l.qtyAlreadyReceived ?? 0))
    return l.qtyReceived > max
  })
  if (invalidQty.length) {
    return `Cantidad supera pendiente: ${invalidQty.map((l) => l.code).join(', ')}`
  }

  return null
}

export function buildReceptionConfirmBody(
  order: ReceptionOrder,
  warehouseId: string,
  isPartial = false,
) {
  const receiveWithQty = order.lines.filter(
    (l) => l.lineAction === 'receive' && l.qtyReceived > 0,
  )
  const notArrivedLines = order.lines.filter((l) => l.lineAction === 'not_arrived')

  const hasPendingAfterSave = order.lines.some((l) => {
    if (!isActionableReceptionLine(l)) return false
    if (l.lineAction === 'receive' && l.qtyReceived > 0) {
      const max = Math.max(0, l.qtyErp - (l.qtyAlreadyReceived ?? 0))
      return l.qtyReceived < max
    }
    return l.lineAction !== 'receive' || l.qtyReceived <= 0
  })

  return {
    purchaseOrderId: order.purchaseOrderId,
    warehouseId,
    isPartial: isPartial || hasPendingAfterSave || notArrivedLines.length > 0,
    lines: receiveWithQty.map((l) => ({
      purchaseOrderLineId: l.id,
      productId: l.productId,
      disposition: 'receive' as const,
      qtyReceived: l.qtyReceived,
      lotNumber: l.lotNumber || undefined,
      expiresAt: l.expiresAt || undefined,
    })),
  }
}

export function matchReceptionLineByScan(lines: ReceptionLine[], code: string) {
  const c = code.trim().toUpperCase()
  return lines.find((l) => l.code.toUpperCase() === c)
}
