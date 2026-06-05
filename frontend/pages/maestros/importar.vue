<script setup lang="ts">
definePageMeta({ layout: 'app' })

const { fetchApi } = useApi()
const type = ref<'productos' | 'inventario'>('productos')
const csvText = ref('')
const message = ref('')
const error = ref('')

async function importCsv() {
  error.value = ''
  message.value = ''
  const { data, error: err } = await fetchApi<{ message: string; inserted: number }>(
    '/masters/import/csv',
    { method: 'POST', body: { type: type.value, content: csvText.value } },
  )
  if (err) {
    error.value = err
    return
  }
  message.value = data?.message ?? 'Importación completada'
}
</script>

<template>
  <div class="max-w-3xl space-y-6">
    <div>
      <NuxtLink to="/maestros" class="text-sm text-blue-600 hover:underline">← Maestros</NuxtLink>
      <h2 class="text-2xl font-bold text-slate-800 mt-2">Importar datos reales (CSV)</h2>
      <p class="text-slate-500 text-sm">
        Use las plantillas en <code class="bg-slate-100 px-1 rounded">data/plantillas/</code>.
        Guardar en Excel como CSV UTF-8 con separador punto y coma (;).
      </p>
    </div>

    <div class="bg-white p-6 rounded-xl border border-slate-100 space-y-4">
      <div>
        <label class="block text-xs font-medium text-slate-500 mb-1">Tipo de importación</label>
        <select v-model="type" class="w-full p-2 border rounded-lg text-sm">
          <option value="productos">Productos (catálogo)</option>
          <option value="inventario">Inventario inicial (saldos)</option>
        </select>
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-500 mb-1">Contenido CSV</label>
        <textarea
          v-model="csvText"
          rows="12"
          class="w-full p-3 border rounded-lg font-mono text-xs"
          placeholder="Pegue aquí el contenido del CSV o copie desde Excel..."
        />
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <p v-if="message" class="text-sm text-green-600">{{ message }}</p>

      <button
        type="button"
        class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        @click="importCsv"
      >
        Importar a base de datos
      </button>
    </div>
  </div>
</template>
