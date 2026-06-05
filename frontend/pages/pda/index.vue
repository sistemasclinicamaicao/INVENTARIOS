<script setup lang="ts">
import type { FlaticonIconName } from '~/utils/flaticon-icons'

definePageMeta({ layout: 'pda' })

const links: { to: string; label: string; icon: FlaticonIconName }[] = [
  { to: '/pda/conteo', label: 'Inventario cíclico', icon: 'clipboard-list' },
  { to: '/pda/recepcion', label: 'Recepción rápida', icon: 'barcode' },
  { to: '/pda/traslado', label: 'Recibir traslado', icon: 'box' },
]
</script>

<template>
  <div class="space-y-3">
    <h1 class="text-lg font-bold">Operaciones móvil</h1>
    <NuxtLink
      v-for="item in links"
      :key="item.to"
      :to="item.to"
      class="flex items-center gap-3 p-4 bg-slate-800 rounded-lg border border-slate-700 active:bg-slate-700"
    >
      <UiIcon :name="item.icon" :size="22" class="text-blue-400" />
      <span class="font-medium">{{ item.label }}</span>
    </NuxtLink>
    <NuxtLink to="/" class="block text-center text-xs text-slate-500 mt-6">Volver a escritorio</NuxtLink>
  </div>
</template>
