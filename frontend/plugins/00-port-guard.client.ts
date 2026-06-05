/**
 * Si el usuario abre el puerto del API (3050) por error, redirige al frontend (3051).
 */
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const apiPort = String(config.public.apiPort ?? '3050')
  const frontPort = String(config.public.frontendPort ?? '3051')

  if (apiPort === frontPort) return
  if (window.location.port !== apiPort) return

  const url = new URL(window.location.href)
  url.port = frontPort
  window.location.replace(url.toString())
})
