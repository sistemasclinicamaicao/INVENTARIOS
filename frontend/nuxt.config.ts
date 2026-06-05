const API_PORT = process.env.API_PORT || '3050'

const FRONTEND_PORT = process.env.FRONTEND_PORT || '3051'

const apiProxyTarget = process.env.NUXT_API_PROXY || `http://127.0.0.1:${API_PORT}`



export default defineNuxtConfig({

  compatibilityDate: '2024-11-01',

  devtools: { enabled: true },

  devServer: {

    port: Number(FRONTEND_PORT),

    host: process.env.NUXT_HOST || '0.0.0.0',

    strictPort: true,

  },

  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],

  css: ['~/assets/css/main.css'],

  // Proxy solo vía server/routes/api/v1 — devProxy quitaba /api/v1 (→ Cannot GET /dashboard/stats)

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


