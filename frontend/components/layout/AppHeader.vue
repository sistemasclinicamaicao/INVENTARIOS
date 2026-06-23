<script setup lang="ts">
const session = useSessionStore()
const config = useRuntimeConfig()
const route = useRoute()
const { loadProfile, logout } = useAuth()

const pageTitle = computed(() => String(route.meta.pageTitle ?? ''))
const breadcrumb = computed(() => {
  const bc = route.meta.breadcrumb as { label: string; to: string } | undefined
  return bc?.label && bc?.to ? bc : null
})

onMounted(() => {
  const hasToken = !!localStorage.getItem('accessToken')
  if (!session.loaded && (hasToken || config.public.authDisabled)) {
    loadProfile()
  }
})
</script>

<template>
  <header class="bg-white h-14 border-b border-slate-200 flex items-center justify-between px-4 shrink-0 gap-4">
    <div class="flex items-center gap-2 min-w-0 flex-1">
      <NuxtLink
        v-if="breadcrumb"
        :to="breadcrumb.to"
        class="text-xs text-blue-600 hover:underline shrink-0 whitespace-nowrap"
      >
        ← {{ breadcrumb.label }}
      </NuxtLink>
      <span v-if="breadcrumb && pageTitle" class="text-slate-300 shrink-0">·</span>
      <p v-if="pageTitle" class="text-sm font-semibold text-slate-700 truncate">
        {{ pageTitle }}
      </p>
    </div>

    <div class="flex items-center gap-4 shrink-0">
      <button type="button" class="relative text-slate-500 hover:text-slate-700 transition">
        <UiIcon name="bell" :size="20" />
        <span
          v-if="session.notificationCount > 0"
          class="absolute -top-1 -right-1 bg-red-500 w-4 h-4 rounded-full text-[10px] text-white flex items-center justify-center font-bold"
        >
          {{ session.notificationCount }}
        </span>
      </button>
      <div class="h-8 w-px bg-slate-200" />
      <div class="flex items-center gap-3">
        <div class="text-right hidden sm:block">
          <p class="text-sm font-semibold text-slate-700 leading-none">{{ session.fullName }}</p>
          <p class="text-xs text-slate-500">{{ session.roleLabel }}</p>
        </div>
        <div
          class="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold border border-blue-200"
        >
          {{ session.initials }}
        </div>
        <button
          type="button"
          class="text-xs text-slate-500 hover:text-red-600 ml-1"
          title="Cerrar sesión"
          @click="logout"
        >
          Salir
        </button>
      </div>
    </div>
  </header>
</template>
