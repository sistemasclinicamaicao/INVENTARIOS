<script setup lang="ts">
export interface ProductSearchHit {
  id: string
  code: string
  name: string
  baseUnit: string
}

const props = defineProps<{
  /** true = farmacia, false = almacén; sin valor = sin filtro */
  catalogFarmacia?: boolean | null
}>()

const emit = defineEmits<{
  select: [product: ProductSearchHit]
}>()

const { fetchApi } = useApi()
const query = ref('')
const results = ref<ProductSearchHit[]>([])
const searching = ref(false)
const open = ref(false)

const catalogHint = computed(() => {
  if (props.catalogFarmacia === true) return 'Catálogo farmacia'
  if (props.catalogFarmacia === false) return 'Catálogo almacén general'
  return 'Seleccione bodega destino para filtrar catálogo'
})

let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(query, (q) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (!q.trim()) {
    results.value = []
    open.value = false
    return
  }
  if (props.catalogFarmacia !== true && props.catalogFarmacia !== false) {
    results.value = []
    open.value = false
    return
  }
  debounceTimer = setTimeout(async () => {
    searching.value = true
    const cat = props.catalogFarmacia ? 'true' : 'false'
    const { data } = await fetchApi<ProductSearchHit[]>(
      `/masters/products/search?q=${encodeURIComponent(q.trim())}&limit=20&isFarmacia=${cat}`,
    )
    results.value = data ?? []
    open.value = (data?.length ?? 0) > 0
    searching.value = false
  }, 300)
})

function pick(p: ProductSearchHit) {
  emit('select', p)
  query.value = ''
  results.value = []
  open.value = false
}
</script>

<template>
  <div class="relative">
    <label class="block text-xs font-medium text-slate-500 mb-1">
      Buscar producto ({{ catalogHint }})
    </label>
    <input
      v-model="query"
      type="search"
      :placeholder="
        catalogFarmacia === true || catalogFarmacia === false
          ? 'Código o nombre en catálogo de bodega…'
          : 'Primero seleccione bodega destino'
      "
      class="w-full p-2 border border-slate-300 rounded text-sm"
      :disabled="catalogFarmacia !== true && catalogFarmacia !== false"
      autocomplete="off"
      @focus="open = results.length > 0"
    />
    <p v-if="searching" class="text-xs text-slate-400 mt-1">Buscando…</p>
    <ul
      v-if="open && results.length"
      class="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto text-sm"
    >
      <li
        v-for="p in results"
        :key="p.id"
        class="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0"
        @mousedown.prevent="pick(p)"
      >
        <span class="font-mono text-xs text-slate-500">{{ p.code }}</span>
        <span class="ml-2">{{ p.name }}</span>
      </li>
    </ul>
  </div>
</template>
