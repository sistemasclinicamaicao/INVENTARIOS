<script setup lang="ts">

import type { RequisitionRow } from '~/types/dashboard'



defineProps<{

  requisitions: RequisitionRow[]

}>()



const priorityClass: Record<string, string> = {

  ALTA: 'bg-red-100 text-red-800',

  MEDIA: 'bg-orange-100 text-orange-800',

  NORMAL: 'bg-slate-100 text-slate-700',

}

</script>



<template>

  <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">

    <div class="p-4 border-b border-slate-100 flex items-center gap-2">

      <UiIcon name="apps" :size="20" class="text-blue-500" />

      <h3 class="font-semibold text-slate-800">Requisiciones Internas Pendientes</h3>

    </div>

    <div v-if="!requisitions.length" class="p-6 text-center text-slate-400 text-sm">

      No hay requisiciones pendientes.

    </div>

    <table v-else class="w-full text-sm">

      <thead class="bg-slate-50 text-slate-600 text-left">

        <tr>

          <th class="px-4 py-3 font-medium">ID</th>

          <th class="px-4 py-3 font-medium">Destino</th>

          <th class="px-4 py-3 font-medium">Prioridad</th>

        </tr>

      </thead>

      <tbody class="divide-y divide-slate-100">

        <tr v-for="req in requisitions" :key="req.id" class="hover:bg-slate-50">

          <td class="px-4 py-3 font-mono text-xs font-medium">{{ req.id }}</td>

          <td class="px-4 py-3">{{ req.destination }}</td>

          <td class="px-4 py-3">

            <span

              class="text-xs px-2 py-0.5 rounded-full font-semibold"

              :class="priorityClass[req.priority] ?? priorityClass.NORMAL"

            >

              {{ req.priority }}

            </span>

          </td>

        </tr>

      </tbody>

    </table>

  </div>

</template>

