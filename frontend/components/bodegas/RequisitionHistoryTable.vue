<script setup lang="ts">
import type { InternalRequisitionRow } from '~/types/requisition-internal'

const props = withDefaults(
  defineProps<{
    requisitions?: InternalRequisitionRow[]
  }>(),
  { requisitions: () => [] },
)

const priorityClass: Record<string, string> = {
  ALTA: 'bg-red-100 text-red-800',
  MEDIA: 'bg-amber-100 text-amber-800',
  NORMAL: 'bg-slate-100 text-slate-700',
}

const statusClass: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  IN_PICKING: 'bg-blue-100 text-blue-800',
  DISPATCHED: 'bg-green-100 text-green-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-slate-100 text-slate-500',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
  <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
    <div class="p-4 border-b border-slate-100 flex items-center gap-2">
      <UiIcon name="truck-side" :size="20" class="text-slate-500" />
      <h3 class="font-semibold text-slate-800">Requisiciones satélite</h3>
    </div>

    <div v-if="!requisitions.length" class="p-12 text-center text-slate-400">
      No hay requisiciones hacia o desde bodegas satélite. Cree una requisición con el formulario superior.
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-slate-600 text-left">
          <tr>
            <th class="px-4 py-3 font-medium">Nº</th>
            <th class="px-4 py-3 font-medium">Productos</th>
            <th class="px-4 py-3 font-medium">Origen</th>
            <th class="px-4 py-3 font-medium">Destino</th>
            <th class="px-4 py-3 font-medium">Prioridad</th>
            <th class="px-4 py-3 font-medium">Estado</th>
            <th class="px-4 py-3 font-medium">Fecha</th>
            <th class="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="r in requisitions" :key="r.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-mono text-xs font-medium">{{ r.id }}</td>
            <td class="px-4 py-3 text-xs text-slate-600">
              <span v-if="r.productsSummary">{{ r.productsSummary }}</span>
              <span v-else class="text-slate-400">—</span>
              <span v-if="r.lineCount && r.lineCount > 1" class="text-slate-400 ml-1">
                ({{ r.lineCount }} líneas)
              </span>
            </td>
            <td class="px-4 py-3">{{ r.source }}</td>
            <td class="px-4 py-3">{{ r.destination }}</td>
            <td class="px-4 py-3">
              <span
                class="text-xs px-2 py-0.5 rounded-full"
                :class="priorityClass[r.priority] ?? priorityClass.NORMAL"
              >
                {{ r.priority }}
              </span>
            </td>
            <td class="px-4 py-3">
              <span
                class="text-xs px-2 py-0.5 rounded-full"
                :class="statusClass[r.status] ?? 'bg-slate-100 text-slate-600'"
              >
                {{ r.status }}
              </span>
            </td>
            <td class="px-4 py-3 text-slate-500">{{ formatDate(r.createdAt) }}</td>
            <td class="px-4 py-3 text-right">
              <NuxtLink
                v-if="r.status === 'PENDING'"
                to="/picking"
                class="text-blue-600 text-xs hover:underline"
              >
                Picking →
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
