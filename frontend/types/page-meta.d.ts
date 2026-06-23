export {}

declare module '#app' {
  interface PageMeta {
    fullWidth?: boolean
    compactContent?: boolean
    pageTitle?: string
    breadcrumb?: { label: string; to: string }
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    fullWidth?: boolean
    compactContent?: boolean
    pageTitle?: string
    breadcrumb?: { label: string; to: string }
  }
}
