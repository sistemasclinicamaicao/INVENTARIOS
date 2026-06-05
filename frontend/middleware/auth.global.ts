export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return
  const config = useRuntimeConfig()
  if (config.public.authDisabled) return

  const publicPaths = ['/login']
  if (publicPaths.some((p) => to.path.startsWith(p))) return
  const token = localStorage.getItem('accessToken')
  if (!token) {
    return navigateTo('/login')
  }
})
