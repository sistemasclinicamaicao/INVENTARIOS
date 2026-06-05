import { ExternalPurchaseOrderResponseDto } from './dto/external-purchase-order.dto';

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown, fallback = ''): string {
  return v != null ? String(v) : fallback;
}

/** Respuesta ya en formato estable (API estándar o mock). */
export function mapStablePurchaseOrder(
  raw: Record<string, unknown>,
): ExternalPurchaseOrderResponseDto | null {
  if (!raw?.number && !raw?.status) return null;

  const linesRaw = (raw.lines as Record<string, unknown>[]) ?? [];
  const lines = linesRaw.map((l) => ({
    productCode: str(l.productCode),
    productName: str(l.productName),
    qtyOrdered: num(l.qtyOrdered),
    unit: str(l.unit, 'UND'),
    unitPrice: num(l.unitPrice),
    lineTotal: num(l.lineTotal ?? num(l.qtyOrdered) * num(l.unitPrice)),
    lotNumber: (l.lotNumber as string) ?? null,
    expiresAt: l.expiresAt ? str(l.expiresAt).slice(0, 10) : null,
  }));

  const supplier = (raw.supplier as Record<string, unknown>) ?? {};
  const warehouse = (raw.warehouse as Record<string, unknown>) ?? {};

  return {
    number: str(raw.number),
    status: str(raw.status),
    supplier: {
      id: supplier.id ? str(supplier.id) : undefined,
      name: str(supplier.name, 'Proveedor'),
    },
    warehouse: {
      id: str(warehouse.id, 'wh-mock'),
      code: str(warehouse.code),
      name: str(warehouse.name, 'Bodega'),
      type: str(warehouse.type, 'CENTRAL'),
    },
    lines,
    totals: {
      lineCount: lines.length,
      amount: lines.reduce((s, l) => s + l.lineTotal, 0),
    },
  };
}

/**
 * ERP CXC / Crystalos: GET ?consecutivo=0100000017 → array de líneas
 * (NIT, RAZONSOCIAL, CODIGO, DESCRIPCION, CANT_AUTO, VLR_UNITARIO, VALOR_TOTAL, …)
 */
export function mapCxcCrystalosLines(
  raw: unknown[],
  consecutivo: string,
): ExternalPurchaseOrderResponseDto | null {
  if (!raw.length) return null;
  const first = raw[0] as Record<string, unknown>;
  if (first.CODIGO == null && first.codigo == null) return null;

  const lines = raw.map((item) => {
    const l = item as Record<string, unknown>;
    const qty = num(l.CANT_AUTO ?? l.cantidad);
    const unitPrice = num(l.VLR_UNITARIO ?? l.vlr_unitario);
    const lineTotal = num(l.VALOR_TOTAL ?? l.valor_total ?? l.VLR_BRUTO ?? qty * unitPrice);
    const lot = str(l.NRO_LOTE ?? l.nro_lote).trim();
    return {
      productCode: str(l.CODIGO ?? l.codigo),
      productName: str(l.DESCRIPCION ?? l.descripcion).trim(),
      qtyOrdered: qty,
      unit: 'UND',
      unitPrice,
      lineTotal,
      lotNumber: lot || null,
      expiresAt: null,
    };
  });

  const nit = str(first.NIT ?? first.nit).trim();
  const razon = str(first.RAZONSOCIAL ?? first.razonsocial).trim();

  return {
    number: consecutivo,
    status: 'OPEN',
    supplier: {
      id: nit || undefined,
      name: razon || 'Proveedor ERP',
    },
    warehouse: {
      id: 'erp-cxc',
      code: '',
      name: 'ERP principal (CXC)',
      type: 'CENTRAL',
    },
    lines,
    totals: {
      lineCount: lines.length,
      amount: lines.reduce((s, l) => s + l.lineTotal, 0),
    },
  };
}

/** Variante ERP: cabecera plana + array `items` / `detalle`. */
export function mapErpPurchaseOrder(
  raw: unknown,
  fallbackNumber: string,
): ExternalPurchaseOrderResponseDto | null {
  if (Array.isArray(raw)) {
    const cxc = mapCxcCrystalosLines(raw, fallbackNumber);
    if (cxc) return cxc;
    if (raw.length === 0) return null;
  }

  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const stable = mapStablePurchaseOrder(r);
  if (stable) return stable;

  const items =
    (r.lines as unknown[]) ??
    (r.items as unknown[]) ??
    (r.detalle as unknown[]) ??
    [];

  if (!Array.isArray(items) || items.length === 0) return null;

  const lines = items.map((item) => {
    const l = item as Record<string, unknown>;
    const qty = num(l.qtyOrdered ?? l.cantidad ?? l.quantity ?? l.CANT_AUTO);
    const price = num(l.unitPrice ?? l.precio ?? l.valorUnitario ?? l.VLR_UNITARIO);
    return {
      productCode: str(l.productCode ?? l.codigo ?? l.sku ?? l.CODIGO),
      productName: str(l.productName ?? l.nombre ?? l.descripcion ?? l.DESCRIPCION),
      qtyOrdered: qty,
      unit: str(l.unit ?? l.unidad, 'UND'),
      unitPrice: price,
      lineTotal: num(l.lineTotal ?? l.total ?? l.VALOR_TOTAL ?? qty * price),
      lotNumber: ((l.lotNumber ?? l.lote ?? l.NRO_LOTE) as string | null) ?? null,
      expiresAt: l.expiresAt ?? l.vencimiento
        ? str(l.expiresAt ?? l.vencimiento).slice(0, 10)
        : null,
    };
  });

  return {
    number: str(r.number ?? r.consecutivo ?? r.numero ?? fallbackNumber),
    status: str(r.status ?? r.estado, 'OPEN'),
    supplier: {
      id: r.supplierId ? str(r.supplierId) : undefined,
      name: str(
        (r.supplier as Record<string, unknown>)?.name ??
          r.supplierName ??
          r.proveedor,
        'Proveedor',
      ),
    },
    warehouse: {
      id: str(
        (r.warehouse as Record<string, unknown>)?.id ?? r.warehouseId,
        'wh-ext',
      ),
      code: str(
        (r.warehouse as Record<string, unknown>)?.code ?? r.warehouseCode,
      ),
      name: str(
        (r.warehouse as Record<string, unknown>)?.name ?? r.warehouseName,
        'Bodega destino',
      ),
      type: str(
        (r.warehouse as Record<string, unknown>)?.type ?? r.warehouseType,
        'CENTRAL',
      ),
    },
    lines,
    totals: {
      lineCount: lines.length,
      amount: lines.reduce((s, l) => s + l.lineTotal, 0),
    },
  };
}

export function mockPurchaseOrder(number: string): ExternalPurchaseOrderResponseDto {
  return {
    number: number.toUpperCase(),
    status: 'APPROVED',
    supplier: { name: 'Proveedor demo ERP' },
    warehouse: {
      id: 'wh-mock-1',
      code: 'CENTRAL_FARMACIA',
      name: 'Farmacia central',
      type: 'CENTRAL_FARMACIA',
    },
    lines: [
      {
        productCode: '10014',
        productName: 'Producto demo ERP',
        qtyOrdered: 10,
        unit: 'TAB',
        unitPrice: 1500,
        lineTotal: 15000,
        lotNumber: null,
        expiresAt: null,
      },
    ],
    totals: { lineCount: 1, amount: 15000 },
  };
}

export function rawPreview(data: unknown, maxLen = 2048): unknown {
  try {
    const s = JSON.stringify(data);
    if (s.length <= maxLen) return data;
    return { _truncated: true, preview: s.slice(0, maxLen) };
  } catch {
    return { _truncated: String(data).slice(0, maxLen) };
  }
}
