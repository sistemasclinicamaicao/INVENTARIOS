/** Siempre ruta relativa: el proxy en server/routes/api/v1 reenvía a NestJS. */
export function useApiBase(): string {
  return '/api/v1'
}
