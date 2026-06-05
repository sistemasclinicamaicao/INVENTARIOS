<script setup lang="ts">

import type { ExpiryAlertView } from '~/types/dashboard'



defineProps<{

  alerts: ExpiryAlertView[]

}>()

</script>



<template>

  <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">

    <div class="p-4 border-b border-slate-100 flex items-center gap-2">

      <UiIcon name="pills" :size="20" class="text-red-500" />

      <h3 class="font-semibold text-slate-800">Alertas de Vencimiento (FEFO)</h3>

    </div>

    <div v-if="!alerts.length" class="p-6 text-center text-slate-400 text-sm">

      No hay lotes próximos a vencer con stock.

    </div>

    <ul v-else class="divide-y divide-slate-100">

      <li

        v-for="alert in alerts"

        :key="alert.id"

        class="p-4 flex justify-between items-center"

        :class="alert.severity === 'critical' ? 'bg-red-50' : 'bg-orange-50'"

      >

        <div>

          <p class="font-medium text-slate-800">{{ alert.productName }}</p>

          <p class="text-xs text-slate-500">

            Lote {{ alert.lotNumber }} · Vence {{ alert.expiresAt }}

          </p>

        </div>

        <div class="text-right">

          <span

            class="text-xs font-bold px-2 py-1 rounded"

            :class="alert.severity === 'critical' ? 'bg-red-200 text-red-800' : 'bg-orange-200 text-orange-800'"

          >

            {{ alert.daysLabel }}

          </span>

          <p class="text-sm text-slate-600 mt-1">{{ alert.qty }}</p>

        </div>

      </li>

    </ul>

  </div>

</template>

