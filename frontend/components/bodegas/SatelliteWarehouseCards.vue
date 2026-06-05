<script setup lang="ts">
import type { SatelliteWarehouse } from '~/types/requisition-internal'

withDefaults(
  defineProps<{
    warehouses?: SatelliteWarehouse[]
  }>(),
  { warehouses: () => [] },
)
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div
      v-for="w in warehouses"
      :key="w.id"
      class="bg-white rounded-xl border border-slate-100 p-5 shadow-sm"
    >
      <div class="flex items-center gap-3">
        <div class="bg-teal-50 p-2 rounded-lg text-teal-600">
          <UiIcon name="marker" :size="20" />
        </div>
        <div>
          <h3 class="font-semibold text-slate-800">{{ w.name }}</h3>
          <p class="text-xs text-slate-400">{{ w.code }} · {{ w.policy }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
