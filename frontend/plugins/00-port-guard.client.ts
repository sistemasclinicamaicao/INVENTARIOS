/**
 * Si el usuario abre el puerto del API (3050) por error, redirige al frontend (3051).
 */
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const apiPort = String(config.public.apiPort ?? '3050')
  const frontPort = String(config.public.frontendPort ?? '3051')

  if (apiPort === frontPort) return

  // Redirigir puerto API → frontend, o localhost → 127.0.0.1 (evita 426 IPv6 en Windows)
  const { hostname, port } = window.location
  if (port === apiPort || (hostname === 'localhost' && port === frontPort)) {
    const url = new URL(window.location.href)
    if (port === apiPort) url.port = frontPort
    if (hostname === 'localhost') url.hostname = '127.0.0.1'
    window.location.replace(url.toString())
  }
})
