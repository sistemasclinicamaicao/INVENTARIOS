<script setup lang="ts">
import type { PurchaseOrderSummary } from '~/types/purchases'

const props = withDefaults(
  defineProps<{
    ocNumber: string
    supplierDisplay?: string
    warehouseDisplay?: string
    openOrders?: PurchaseOrderSummary[] | { number: string }[]
    ocLocked?: boolean
    loading?: boolean
  }>(),
  {
    supplierDisplay: '',
    warehouseDisplay: '',
    ocLocked: false,
    loading: false,
  },
)

const emit = defineEmits<{
  'update:ocNumber': [value: string]
  load: []
}>()

const oc = computed({
  get: () => props.ocNumber,
  set: (v) => emit('update:ocNumber', v),
})
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
    <div>
      <label class="block text-xs font-medium text-slate-500 mb-1">Orden de Compra (OC)</label>
      <input
        v-model="oc"
        type="text"
        list="oc-suggestions"
        placeholder="Ej. 0100031787"
        :readonly="ocLocked"
        class="w-full p-2 border border-slate-300 rounded bg-white text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
        @keyup.enter="emit('load')"
      />
      <datalist v-if="openOrders?.length" id="oc-suggestions">
        <option v-for="o in openOrders" :key="o.number" :value="o.number" />
      </datalist>
      <p v-if="ocLocked" class="text-[10px] text-slate-500 mt-0.5">
        OC cargada desde importación (no editable).
      </p>
    </div>
    <div>
      <label class="block text-xs font-medium text-slate-500 mb-1">Proveedor</label>
      <input
        type="text"
        readonly
        tabindex="-1"
        :value="supplierDisplay"
        placeholder="Cargue la OC para ver el proveedor"
        class="w-full p-2 border border-slate-200 rounded text-sm bg-slate-50 text-slate-800 cursor-default"
      />
      <p class="text-[10px] text-slate-500 mt-0.5">Definido en la OC (no editable).</p>
    </div>
    <div>
      <label class="block text-xs font-medium text-slate-500 mb-1">Bodega destino</label>
      <input
        type="text"
        readonly
        tabindex="-1"
        :value="warehouseDisplay"
        placeholder="Cargue la OC para ver la bodega"
        class="w-full p-2 border border-slate-200 rounded text-sm bg-slate-50 text-slate-800 cursor-default"
      />
      <p class="text-[10px] text-slate-500 mt-0.5">Según CXC: 02 Almacén, 10 Farmacia, 11 Confecciones.</p>
    </div>
    <div class="flex flex-col justify-end">
      <button
        type="button"
        class="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition font-medium text-sm disabled:opacity-50"
        :disabled="loading || !oc.trim() || ocLocked"
        @click="emit('load')"
      >
        {{ loading ? 'Cargando...' : 'Cargar Detalles' }}
      </button>
    </div>
  </div>
</template>
