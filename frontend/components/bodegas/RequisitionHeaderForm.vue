<script setup lang="ts">
import type {
  CentralWarehouseOption,
  RequisitionHeaderDraft,
  RequisitionPriority,
  SatelliteWarehouse,
} from '~/types/requisition-internal'

const props = withDefaults(
  defineProps<{
    modelValue: RequisitionHeaderDraft
    nextNumber?: string
    centralWarehouses?: CentralWarehouseOption[]
    satelliteWarehouses?: SatelliteWarehouse[]
  }>(),
  {
    nextNumber: '',
    centralWarehouses: () => [],
    satelliteWarehouses: () => [],
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: RequisitionHeaderDraft]
}>()

function patch(partial: Partial<RequisitionHeaderDraft>) {
  emit('update:modelValue', { ...props.modelValue, ...partial })
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
    <div>
      <label class="block text-xs text-slate-500 mb-1">Número REQ</label>
      <input
        :value="nextNumber"
        type="text"
        readonly
        class="w-full p-2 border border-slate-200 rounded text-sm bg-slate-50 text-slate-700 font-mono uppercase"
      />
      <p class="text-[10px] text-slate-400 mt-0.5">Asignado al crear la requisición</p>
    </div>
    <div>
      <label class="block text-xs text-slate-500 mb-1">Bodega origen</label>
      <select
        :value="modelValue.sourceWarehouseId"
        class="w-full p-2 border rounded text-sm"
        @change="patch({ sourceWarehouseId: ($event.target as HTMLSelectElement).value })"
      >
        <option value="">— Seleccione —</option>
        <option v-for="w in centralWarehouses" :key="w.id" :value="w.id">
          {{ w.name }} ({{ w.code }})
        </option>
      </select>
    </div>
    <div>
      <label class="block text-xs text-slate-500 mb-1">Bodega destino (satélite)</label>
      <select
        :value="modelValue.destWarehouseId"
        class="w-full p-2 border rounded text-sm"
        @change="patch({ destWarehouseId: ($event.target as HTMLSelectElement).value })"
      >
        <option value="">— Seleccione —</option>
        <option v-for="w in satelliteWarehouses" :key="w.id" :value="w.id">
          {{ w.name }} ({{ w.code }})
        </option>
      </select>
    </div>
    <div>
      <label class="block text-xs text-slate-500 mb-1">Prioridad</label>
      <select
        :value="modelValue.priority"
        class="w-full p-2 border rounded text-sm"
        @change="patch({ priority: ($event.target as HTMLSelectElement).value as RequisitionPriority })"
      >
        <option value="ALTA">ALTA</option>
        <option value="MEDIA">MEDIA</option>
        <option value="NORMAL">NORMAL</option>
      </select>
    </div>
  </div>
</template>
