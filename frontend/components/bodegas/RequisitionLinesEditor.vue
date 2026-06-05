<script setup lang="ts">
import type { RequisitionLineDraft } from '~/types/requisition-internal'
import type { ProductSearchHit } from '~/components/compras/ProductLineSearch.vue'

const props = withDefaults(
  defineProps<{
    lines?: RequisitionLineDraft[]
    catalogFarmacia?: boolean | null
  }>(),
  {
    lines: () => [],
    catalogFarmacia: null,
  },
)

const emit = defineEmits<{
  'update:lines': [lines: RequisitionLineDraft[]]
}>()

const showSearch = ref(false)

function onProductSelect(p: ProductSearchHit) {
  if (props.lines.some((l) => l.productId === p.id)) {
    showSearch.value = false
    return
  }
  emit('update:lines', [
    ...props.lines,
    {
      key: `${p.id}-${Date.now()}`,
      productId: p.id,
      code: p.code,
      name: p.name,
      qty: 1,
      unit: p.baseUnit || 'UND',
    },
  ])
  showSearch.value = false
}

function updateLine(key: string, field: 'qty' | 'unit', value: string | number) {
  emit(
    'update:lines',
    props.lines.map((l) => (l.key === key ? { ...l, [field]: value } : l)),
  )
}

function removeLine(key: string) {
  emit(
    'update:lines',
    props.lines.filter((l) => l.key !== key),
  )
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <h4 class="text-sm font-medium text-slate-700">Líneas de mercancía</h4>
      <button
        type="button"
        class="text-xs px-3 py-1.5 rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50 disabled:opacity-50"
        :disabled="catalogFarmacia !== true && catalogFarmacia !== false"
        @click="showSearch = !showSearch"
      >
        {{ showSearch ? 'Ocultar búsqueda' : '+ Agregar producto' }}
      </button>
    </div>

    <ComprasProductLineSearch
      v-if="showSearch"
      :catalog-farmacia="catalogFarmacia"
      @select="onProductSelect"
    />

    <p
      v-if="catalogFarmacia !== true && catalogFarmacia !== false"
      class="text-xs text-amber-700"
    >
      Seleccione la bodega origen para habilitar la búsqueda de productos.
    </p>

    <div v-if="!lines.length" class="text-xs text-slate-500 py-4 text-center border border-dashed rounded-lg">
      Agregue al menos un producto a la requisición.
    </div>

    <div v-else class="overflow-x-auto border border-slate-100 rounded-lg">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left">Código / Producto</th>
            <th class="px-3 py-2 w-24">Cantidad</th>
            <th class="px-3 py-2 w-24">Unidad</th>
            <th class="px-3 py-2 w-16" />
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="line in lines" :key="line.key">
            <td class="px-3 py-2">
              <span class="font-mono text-xs text-slate-500">{{ line.code }}</span>
              <span class="ml-2 text-slate-800">{{ line.name }}</span>
            </td>
            <td class="px-3 py-2">
              <input
                type="number"
                min="1"
                :value="line.qty"
                class="w-full p-1.5 border rounded text-xs text-center"
                @input="updateLine(line.key, 'qty', Number(($event.target as HTMLInputElement).value))"
              />
            </td>
            <td class="px-3 py-2">
              <input
                type="text"
                :value="line.unit"
                class="w-full p-1.5 border rounded text-xs"
                @input="updateLine(line.key, 'unit', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="px-3 py-2 text-right">
              <button
                type="button"
                class="text-xs text-red-600 hover:underline"
                @click="removeLine(line.key)"
              >
                Quitar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
