import {
  PURCHASE_DESTINATION_TYPES,
  type PurchaseDestinationType,
  WAREHOUSE_TYPE,
} from '../masters/warehouse-types.util';

/**
 * Códigos de bodega CXC / Crystalos → tipo interno.
 * 02 Almacén general | 10 Servicio farmacéutico | 11 Confecciones
 */
export const ERP_BODEGA_TO_TYPE: Record<string, PurchaseDestinationType> = {
  '02': WAREHOUSE_TYPE.CENTRAL_ALMACEN,
  '10': WAREHOUSE_TYPE.CENTRAL_FARMACIA,
  '11': WAREHOUSE_TYPE.BODEGA_CONFECCIONES,
};

export type { PurchaseDestinationType as CentralWarehouseType };

/** Normaliza "02", "2", "bodega 10", " 11 " → "02" | "10" | "11" | null */
export function normalizeErpBodegaCode(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;

  const fromLabel = t.match(/bodega\s*(\d{1,2})\b/i);
  if (fromLabel) return fromLabel[1].padStart(2, '0');

  if (/^\d{1,2}$/.test(t)) return t.padStart(2, '0');

  return t.toUpperCase();
}

export function erpBodegaToWarehouseType(
  code?: string | null,
  name?: string | null,
): PurchaseDestinationType | null {
  for (const part of [code, name]) {
    if (!part?.trim()) continue;
    const n = normalizeErpBodegaCode(part);
    if (n && ERP_BODEGA_TO_TYPE[n]) return ERP_BODEGA_TO_TYPE[n];
  }
  return null;
}

/** @deprecated use erpBodegaToWarehouseType */
export function erpBodegaToCentralType(
  code?: string | null,
  name?: string | null,
): PurchaseDestinationType | null {
  return erpBodegaToWarehouseType(code, name);
}

export function isKnownErpBodegaCode(code: string): boolean {
  const n = normalizeErpBodegaCode(code);
  if (!n) return false;
  return !!ERP_BODEGA_TO_TYPE[n];
}

export { PURCHASE_DESTINATION_TYPES };
