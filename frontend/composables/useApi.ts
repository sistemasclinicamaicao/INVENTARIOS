export interface ApiResult<T> {
  data: T | null
  error: string | null
}

export function useApi() {
  const base = useApiBase()

  function authHeaders(): Record<string, string> {
    if (!import.meta.client) return {}
    const config = useRuntimeConfig()
    if (config.public.authDisabled) return {}
    const token = localStorage.getItem('accessToken')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async function fetchApi<T>(
    path: string,
    options?: Parameters<typeof $fetch<T>>[1] & { quiet?: boolean },
  ): Promise<ApiResult<T>> {
    const quiet = options?.quiet === true
    const { quiet: _q, ...fetchOptions } = options ?? {}
    try {
      const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`
      const data = await $fetch<T>(url, {
        ...fetchOptions,
        headers: {
          ...authHeaders(),
          ...(fetchOptions?.headers as Record<string, string> | undefined),
        },
      })
      return { data, error: null }
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string; statusCode?: number }
      let message = err?.data?.message ?? err?.message ?? 'Error al conectar con el servidor'
      if (
        message.includes('Failed to fetch') ||
        err?.statusCode === 426 ||
        err?.statusCode === 502
      ) {
        const port = useRuntimeConfig().public.frontendPort ?? '3051'
        const apiPort = useRuntimeConfig().public.apiPort ?? '3050'
        message =
          err?.statusCode === 502
            ? `La API no está en ejecución (puerto ${apiPort}). Ejecute .\\iniciar.bat o inicie el backend NestJS, luego recargue http://127.0.0.1:${port}`
            : `No se pudo contactar la API. Abra http://127.0.0.1:${port} y ejecute .\\iniciar.bat`
      }
      const config = useRuntimeConfig()
      if (
        !config.public.authDisabled &&
        (err?.statusCode === 401 || err?.statusCode === 403) &&
        import.meta.client
      ) {
        if (err?.statusCode === 401) {
          const { refreshAccessToken, logout } = useAuth()
          const ok = await refreshAccessToken()
          if (!ok) logout()
        }
      }
      const skipLog = quiet && (err?.statusCode === 404 || err?.statusCode === 400)
      if (!skipLog) console.error(`[API] ${path}`, message)
      return { data: null, error: message }
    }
  }

  return { fetchApi, base }
}
