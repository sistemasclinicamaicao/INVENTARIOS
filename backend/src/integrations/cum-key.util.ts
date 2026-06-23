/** Clave CUM INVIMA: {expediente_cum}-{consecutivo_cum} */
export function buildCumKey(
  expedienteCum: unknown,
  consecutivoCum: unknown,
): string | null {
  const a = String(expedienteCum ?? '').trim();
  const b = String(consecutivoCum ?? '').trim();
  if (!a && !b) return null;
  if (a && b) return `${a}-${b}`;
  return a || b || null;
}

export function normalizeCumKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

export function parseCantidadCum(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 ? value : null;
  }
  const s = String(value).trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function computePmvUnitPrice(
  precioInst: unknown,
  margenIps: unknown,
  cantidadCum: unknown,
): number | null {
  const inst = Number(precioInst);
  const margen = Number(margenIps);
  const cantidad = parseCantidadCum(cantidadCum);
  if (!Number.isFinite(inst) || !Number.isFinite(margen) || cantidad == null) {
    return null;
  }
  const total = inst + margen;
  if (total <= 0) return null;
  return Math.round((total / cantidad) * 100) / 100;
}
