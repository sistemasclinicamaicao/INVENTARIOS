<script setup lang="ts">
import type { FlaticonIconName } from '~/utils/flaticon-icons'

const route = useRoute()

const navItems: { to: string; label: string; icon: FlaticonIconName }[] = [
  { to: '/', label: 'Panel Principal', icon: 'home' },
]

const operationItems: { to: string; label: string; icon: FlaticonIconName }[] = [
  { to: '/compras/ordenes', label: 'Órdenes de Compra', icon: 'document' },
  { to: '/recepcion', label: 'Recepción', icon: 'arrow-down' },
  { to: '/picking', label: 'Picking / Despacho', icon: 'arrow-up' },
  { to: '/inventario', label: 'Inventario Central', icon: 'apps' },
]

const specialItems: { to: string; label: string; icon: FlaticonIconName }[] = [
  { to: '/farmacia', label: 'Farmacia (Controlados)', icon: 'pills' },
  { to: '/bodegas', label: 'Bodegas Satélite', icon: 'box' },
]

function isActive(path: string | null) {
  if (!path) return false
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

function linkClass(active: boolean) {
  return [
    'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
    active ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white',
  ]
}
</script>

<template>
  <aside class="w-64 bg-slate-900 text-slate-300 flex flex-col hidden md:flex shrink-0">
    <div class="p-4 border-b border-slate-800 flex items-center gap-3">
      <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
        <UiIcon name="plus" :size="20" />
      </div>
      <div>
        <h1 class="text-white font-bold tracking-wide">Clínica ERP</h1>
        <p class="text-xs text-slate-400">Logística & Farmacia</p>
      </div>
    </div>

    <nav class="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :class="linkClass(isActive(item.to))"
      >
        <UiIcon :name="item.icon" :size="18" />
        {{ item.label }}
      </NuxtLink>

      <div class="pt-4 pb-1">
        <p class="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Operaciones
        </p>
      </div>

      <NuxtLink
        v-for="item in operationItems"
        :key="item.to"
        :to="item.to"
        :class="linkClass(isActive(item.to))"
      >
        <UiIcon :name="item.icon" :size="18" />
        {{ item.label }}
      </NuxtLink>

      <div class="pt-4 pb-1">
        <p class="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Especiales
        </p>
      </div>

      <NuxtLink
        v-for="item in specialItems"
        :key="item.to"
        :to="item.to"
        :class="linkClass(isActive(item.to))"
      >
        <UiIcon :name="item.icon" :size="18" />
        {{ item.label }}
      </NuxtLink>
    </nav>

    <div class="p-4 border-t border-slate-800 space-y-1">
      <NuxtLink
        to="/pda"
        class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 hover:text-white transition-colors text-sm"
      >
        <UiIcon name="apps" :size="18" />
        Modo PDA
      </NuxtLink>
      <NuxtLink
        to="/configuracion"
        :class="linkClass(isActive('/configuracion'))"
      >
        <UiIcon name="settings" :size="18" />
        Configuración
      </NuxtLink>
    </div>
  </aside>
</template>
