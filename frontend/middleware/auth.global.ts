export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return
  const config = useRuntimeConfig()
  if (config.public.authDisabled) return

  const publicPaths = ['/login']
  if (publicPaths.some((p) => to.path.startsWith(p))) return

  const token = localStorage.getItem('accessToken')
  if (!token) {
    return navigateTo('/login')
  }

  if (isAccessTokenExpired(token)) {
    const { refreshAccessToken, logout } = useAuth()
    const ok = await refreshAccessToken()
    if (!ok) {
      logout()
      return navigateTo('/login')
    }
  }
})
