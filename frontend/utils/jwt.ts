/** Decodifica exp del JWT sin verificar firma (solo para UX en cliente). */
export function isAccessTokenExpired(token: string, skewMs = 30_000): boolean {
  try {
    const part = token.split('.')[1]
    if (!part) return true
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof payload.exp !== 'number') return false
    return Date.now() >= payload.exp * 1000 - skewMs
  } catch {
    return true
  }
}
