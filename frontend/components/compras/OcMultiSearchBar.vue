<script setup lang="ts">
import type { OcConsultEntry } from '~/types/erp-cxc'

const draft = defineModel<string>('draft', { default: '' })

defineProps<{
  entries: OcConsultEntry[]
  loading?: boolean
  referenceWarehouse?: string
  compact?: boolean
}>()

const emit = defineEmits<{
  add: []
  search: []
  remove: [number: string]
  clear: []
}>()

function normalizeOc(v: string) {
  return v.trim().toUpperCase()
}

function chipClass(entry: OcConsultEntry) {
  if (entry.loading) return 'bg-slate-100 text-slate-600 border-slate-200'
  if (entry.error) return 'bg-red-50 text-red-800 border-red-200'
  if (entry.result?.found) return 'bg-green-50 text-green-800 border-green-200'
  return 'bg-amber-50 text-amber-800 border-amber-200'
}

function onEnter() {
  emit('search')
}
</script>

<template>
  <div :class="compact ? 'space-y-1.5' : 'space-y-2'">
    <label v-if="!compact" class="block text-xs font-medium text-slate-500">
      Ordenes de compra (remisión)
    </label>
    <div class="flex flex-wrap gap-1.5">
      <input
        v-model="draft"
        type="text"
        :placeholder="compact ? 'Nº OC' : '0100031792'"
        :class="[
          'flex-1 min-w-[120px] border border-slate-300 rounded font-mono uppercase bg-white',
          compact ? 'px-2 py-1 text-xs' : 'p-2 text-sm',
        ]"
        @keyup.enter="onEnter"
      />
      <button
        type="button"
        title="Añadir OC a la lista"
        :class="[
          'border border-indigo-300 text-indigo-700 font-bold hover:bg-indigo-50 disabled:opacity-50',
          compact ? 'px-2 py-1 rounded text-xs' : 'px-3 py-2 rounded text-sm',
        ]"
        :disabled="!normalizeOc(draft)"
        @click="emit('add')"
      >
        +
      </button>
      <button
        type="button"
        :class="[
          'bg-indigo-600 text-white whitespace-nowrap disabled:opacity-50 hover:bg-indigo-700',
          compact ? 'px-2.5 py-1 rounded text-xs' : 'px-3 py-2 rounded text-sm',
        ]"
        :disabled="loading || (!entries.length && !normalizeOc(draft))"
        @click="emit('search')"
      >
        {{ loading ? (compact ? '…' : 'Consultando…') : 'Buscar' }}
      </button>
      <button
        v-if="entries.length"
        type="button"
        :class="compact ? 'px-1 py-1 text-[10px] text-slate-600 hover:underline' : 'px-3 py-2 text-slate-600 text-sm hover:underline'"
        @click="emit('clear')"
      >
        Limpiar
      </button>
    </div>

    <div v-if="entries.length" class="flex flex-wrap gap-1">
      <span
        v-for="entry in entries"
        :key="entry.number"
        :class="[
          'inline-flex items-center gap-0.5 font-mono border',
          compact ? 'px-1.5 py-0.5 rounded-full text-[10px]' : 'px-2 py-1 rounded-full text-xs',
          chipClass(entry),
        ]"
      >
        {{ entry.number }}
        <button
          type="button"
          class="hover:opacity-70 leading-none"
          title="Quitar"
          @click="emit('remove', entry.number)"
        >
          ×
        </button>
      </span>
    </div>
    <p
      v-else-if="referenceWarehouse && !compact"
      class="text-[10px] text-slate-500"
    >
      Pulse + para añadir otra OC con bodega <strong>{{ referenceWarehouse }}</strong>, luego Buscar si falta
      consultar.
    </p>
    <p v-else-if="!compact" class="text-[10px] text-slate-500">
      Escriba un consecutivo y pulse + (misma bodega destino en todas las OC), luego Buscar.
    </p>
  </div>
</template>
