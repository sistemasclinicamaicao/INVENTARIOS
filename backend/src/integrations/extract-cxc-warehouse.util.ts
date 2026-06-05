/** Extrae bodega destino de líneas CXC / Crystalos (nombres de campo variables). */
export function extractCxcWarehouse(
  lines: unknown[] | null | undefined,
): { code: string; name: string } | null {
  if (!Array.isArray(lines) || lines.length === 0) return null;

  const first = lines[0] as Record<string, unknown>;
  const code = pickStr(first, [
    'CODBODEGA',
    'COD_BODEGA',
    'CODIGOBODEGA',
    'IDBODEGA',
    'ID_BODEGA',
    'BODEGA_COD',
    'warehouseCode',
    'warehouse_code',
  ]);
  const name = pickStr(first, [
    'NOMBODEGA',
    'NOM_BODEGA',
    'NOMBRE_BODEGA',
    'BODEGA_NOMBRE',
    'DESBODEGA',
    'DESCRIPCION_BODEGA',
    'BODEGA_DESTINO',
    'warehouseName',
    'warehouse_name',
  ]);
  const bodega = pickStr(first, [
    'BODEGA',
    'bodega',
    'NUM_BODEGA',
    'NUMBODEGA',
    'ID_BODEGA_ERP',
  ]);

  const resolvedCode =
    code ||
    (bodega && looksLikeErpBodegaCode(bodega) ? bodega.trim() : '');
  const resolvedName =
    name ||
    (bodega && !looksLikeErpBodegaCode(bodega) ? bodega : '') ||
    code;

  if (!resolvedCode && !resolvedName) return null;

  return {
    code: resolvedCode.trim(),
    name: (resolvedName || resolvedCode).trim(),
  };
}

function pickStr(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k] ?? obj[k.toLowerCase()];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

/** Códigos ERP CXC: 02 almacén, 10 servicio farmacéutico, 11 confecciones. */
function looksLikeErpBodegaCode(s: string): boolean {
  const t = s.trim();
  if (/^bodega\s*\d{1,2}$/i.test(t)) return true;
  if (/^\d{1,2}$/.test(t)) return true;
  return t.length <= 20 && /^[A-Z0-9_-]+$/i.test(t);
}
