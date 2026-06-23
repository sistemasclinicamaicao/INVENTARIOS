const API_PORT = process.env.API_PORT || '3050'

const FRONTEND_PORT = process.env.FRONTEND_PORT || '3051'

const apiProxyTarget = process.env.NUXT_API_PROXY || `http://127.0.0.1:${API_PORT}`



export default defineNuxtConfig({

  compatibilityDate: '2024-11-01',

  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  devServer: {

    port: Number(FRONTEND_PORT),

    // 127.0.0.1 evita 426 en Windows cuando el navegador usa localhost → ::1 (IPv6)
    host: process.env.NUXT_HOST || '127.0.0.1',

    strictPort: true,

  },

  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],

  css: ['~/assets/css/main.css'],

  // Proxy solo vía server/routes/api/v1 — devProxy quitaba /api/v1 (→ Cannot GET /dashboard/stats)

  vite: {
    server: {
      host: '127.0.0.1',
      hmr: { host: '127.0.0.1', port: Number(FRONTEND_PORT) },
    },
  },

  runtimeConfig: {

    public: {

      apiBase: '/api/v1',

      apiPort: API_PORT,

      frontendPort: FRONTEND_PORT,

      authDisabled:

        process.env.NUXT_PUBLIC_AUTH_DISABLED === 'true' ||

        process.env.AUTH_DISABLED === 'true' ||

        (process.env.NODE_ENV !== 'production' &&

          process.env.NUXT_PUBLIC_AUTH_DISABLED !== 'false' &&

          process.env.AUTH_DISABLED !== 'false'),

    },

    apiProxyTarget,

  },

  app: {

    head: {

      title: 'Clínica ERP - Logística & Farmacia',

      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],

    },

  },

})


