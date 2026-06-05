/**
 * Quita tildes solo para comparar/buscar; no usar al guardar texto en BD.
 */
export function foldAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Comparación insensible a mayúsculas y tildes. */
export function equalsFolded(a: string, b: string): boolean {
  return foldAccents(a).localeCompare(foldAccents(b), 'es', { sensitivity: 'base' }) === 0;
}
