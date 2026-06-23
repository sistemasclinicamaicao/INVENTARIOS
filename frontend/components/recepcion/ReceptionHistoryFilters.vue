<script setup lang="ts">
import type { ReceptionHistoryFilters } from '~/types/reception-history'

interface WarehouseOption {
  id: string
  code: string
  name: string
}

const props = defineProps<{
  warehouses: WarehouseOption[]
  loading?: boolean
}>()

const emit = defineEmits<{
  search: [filters: ReceptionHistoryFilters]
}>()

const oc = ref('')
const warehouseId = ref('')
const from = ref('')
const to = ref('')

function submit() {
  emit('search', {
    oc: oc.value.trim(),
    warehouseId: warehouseId.value,
    from: from.value,
    to: to.value,
  })
}

function clear() {
  oc.value = ''
  warehouseId.value = ''
  from.value = ''
  to.value = ''
  submit()
}

onMounted(() => {
  submit()
})
</script>

<template>
  <div class="flex flex-wrap items-end gap-3 mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
    <label class="flex flex-col gap-1 text-xs font-medium text-slate-600 min-w-[10rem]">
      Nº OC
      <input
        v-model="oc"
        type="search"
        placeholder="Ej. 0100031787"
        class="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
        @keyup.enter="submit"
      />
    </label>
    <label class="flex flex-col gap-1 text-xs font-medium text-slate-600 min-w-[12rem]">
      Bodega
      <select
        v-model="warehouseId"
        class="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
      >
        <option value="">Todas</option>
        <option v-for="wh in warehouses" :key="wh.id" :value="wh.id">
          {{ wh.code }} — {{ wh.name }}
        </option>
      </select>
    </label>
    <label class="flex flex-col gap-1 text-xs font-medium text-slate-600">
      Desde
      <input
        v-model="from"
        type="date"
        class="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
      />
    </label>
    <label class="flex flex-col gap-1 text-xs font-medium text-slate-600">
      Hasta
      <input
        v-model="to"
        type="date"
        class="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
      />
    </label>
    <div class="flex gap-2">
      <button
        type="button"
        class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        :disabled="loading"
        @click="submit"
      >
        Buscar
      </button>
      <button
        type="button"
        class="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-white"
        :disabled="loading"
        @click="clear"
      >
        Limpiar
      </button>
    </div>
  </div>
</template>
