export function useAuth() {
  const apiBase = useApiBase()
  const session = useSessionStore()
  const router = useRouter()

  function getToken() {
    if (!import.meta.client) return null
    return localStorage.getItem('accessToken')
  }

  async function loadProfile() {
    const config = useRuntimeConfig()
    const { fetchApi } = useApi()
    const { data, error } = await fetchApi<{
      fullName: string
      roleLabel: string
      initials: string
      notificationCount: number
      permissions: string[]
      roles: string[]
    }>('/users/me')
    if (data) {
      session.setFromProfile(data)
      return data
    }
    if (config.public.authDisabled) {
      session.setFromProfile({
        fullName: 'Desarrollo (sin login)',
        roleLabel: 'Administrador',
        initials: 'DV',
        notificationCount: 0,
        permissions: ['*'],
        roles: ['admin'],
      })
      return null
    }
    if (error) return null
    return data
  }

  async function refreshAccessToken(): Promise<boolean> {
    const refresh = localStorage.getItem('refreshToken')
    if (!refresh) return false
    try {
      const res = await $fetch<{
        accessToken: string
        permissions?: string[]
        roles?: string[]
      }>(`${apiBase}/auth/refresh`, {
        method: 'POST',
        body: { refreshToken: refresh },
      })
      localStorage.setItem('accessToken', res.accessToken)
      if (res.permissions) session.permissions = res.permissions
      if (res.roles) session.roles = res.roles
      return true
    } catch {
      return false
    }
  }

  function logout() {
    if (import.meta.client) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
    }
    session.clear()
    router.push('/login')
  }

  function can(permission: string) {
    return session.can(permission)
  }

  return { getToken, loadProfile, refreshAccessToken, logout, can }
}
