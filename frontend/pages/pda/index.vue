<script setup lang="ts">
import { usePdaModules } from '~/composables/pda/usePdaModules'

definePageMeta({ layout: 'pda' })

const { modules } = usePdaModules()
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-lg font-bold">Operaciones móvil</h1>
    <p class="text-xs text-slate-400">
      Flujos de campo con escáner. Solo se muestran módulos según sus permisos.
    </p>

    <div v-if="!modules.length" class="text-sm text-amber-400 bg-amber-950/30 border border-amber-800 rounded-lg p-3">
      No tiene permisos para operaciones PDA. Contacte al administrador.
    </div>

    <NuxtLink
      v-for="item in modules"
      :key="item.id"
      :to="item.to"
      class="flex items-start gap-3 p-4 bg-slate-800 rounded-lg border border-slate-700 active:bg-slate-700"
    >
      <UiIcon :name="item.icon" :size="22" class="text-blue-400 shrink-0 mt-0.5" />
      <div>
        <span class="font-medium block">{{ item.label }}</span>
        <span class="text-xs text-slate-400">{{ item.description }}</span>
      </div>
    </NuxtLink>

    <NuxtLink to="/" class="block text-center text-xs text-slate-500 mt-6 hover:text-slate-300">
      Volver a escritorio
    </NuxtLink>
  </div>
</template>
