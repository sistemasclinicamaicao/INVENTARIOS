<script setup lang="ts">
definePageMeta({ layout: 'app' })

const { fetchApi } = useApi()
const products = ref<Array<Record<string, unknown>>>([])
const loading = ref(true)
const form = ref({
  code: '',
  name: '',
  description: '',
  baseUnit: 'UND',
  isFarmacia: true,
  requiresLote: true,
  isControlado: false,
  minStock: 0,
  barcode: '',
})
const msg = ref('')

async function load() {
  loading.value = true
  const { data } = await fetchApi<typeof products.value>('/masters/products')
  if (data) products.value = data
  loading.value = false
}

async function save() {
  msg.value = ''
  const { data, error } = await fetchApi('/masters/products', {
    method: 'POST',
    body: form.value,
  })
  if (error) {
    msg.value = error
    return
  }
  msg.value = `Producto ${(data as { code: string })?.code} guardado`
  form.value.code = ''
  form.value.name = ''
  await load()
}

onMounted(() => load())
</script>

<template>
  <div class="space-y-6">
    <div>
      <NuxtLink to="/maestros" class="text-sm text-blue-600 hover:underline">← Maestros</NuxtLink>
      <h2 class="text-2xl font-bold text-slate-800 mt-2">Productos (datos reales)</h2>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 bg-white rounded-xl border border-slate-100 overflow-hidden">
        <p v-if="loading" class="p-6 text-slate-500">Cargando...</p>
        <p v-else-if="!products.length" class="p-6 text-slate-500 text-sm">
          No hay productos. Importe CSV o agregue uno al lado.
        </p>
        <table v-else class="w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th class="px-4 py-2 text-left">Código</th>
              <th class="px-4 py-2 text-left">Nombre</th>
              <th class="px-4 py-2 text-right">Stock</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in products" :key="p.id as string" class="border-t">
              <td class="px-4 py-2 font-medium">{{ p.code }}</td>
              <td class="px-4 py-2">{{ p.name }}</td>
              <td class="px-4 py-2 text-right">{{ p.totalStock }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="bg-white p-5 rounded-xl border border-slate-100 h-fit">
        <h3 class="font-semibold text-slate-800 mb-3">Nuevo producto</h3>
        <div class="space-y-2 text-sm">
          <input v-model="form.code" placeholder="Código" class="w-full p-2 border rounded" />
          <input v-model="form.name" placeholder="Nombre" class="w-full p-2 border rounded" />
          <input v-model="form.description" placeholder="Presentación" class="w-full p-2 border rounded" />
          <input v-model="form.baseUnit" placeholder="Unidad (UND, CAJ...)" class="w-full p-2 border rounded" />
          <input v-model="form.barcode" placeholder="Código barras" class="w-full p-2 border rounded" />
          <label class="flex items-center gap-2">
            <input v-model="form.isFarmacia" type="checkbox" /> Farmacia
          </label>
          <label class="flex items-center gap-2">
            <input v-model="form.requiresLote" type="checkbox" /> Requiere lote
          </label>
          <button
            type="button"
            class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 mt-2"
            @click="save"
          >
            Guardar
          </button>
          <p v-if="msg" class="text-xs mt-2" :class="msg.includes('Error') || msg.includes('error') ? 'text-red-600' : 'text-green-600'">{{ msg }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
