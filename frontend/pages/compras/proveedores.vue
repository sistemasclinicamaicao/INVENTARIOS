<script setup lang="ts">
import type { Supplier } from '~/types/purchases'

definePageMeta({ layout: 'app' })

const { fetchApi } = useApi()

const suppliers = ref<Supplier[]>([])
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const form = ref({ code: '', name: '', taxId: '' })

async function load() {
  loading.value = true
  const { data, error: err } = await fetchApi<Supplier[]>('/purchases/suppliers')
  if (err) error.value = err
  else if (data) suppliers.value = data
  loading.value = false
}

async function onSubmit() {
  if (!form.value.code.trim() || !form.value.name.trim()) {
    error.value = 'Código y nombre son obligatorios'
    return
  }
  saving.value = true
  error.value = null
  const { error: err } = await fetchApi('/purchases/suppliers', {
    method: 'POST',
    body: {
      code: form.value.code.trim(),
      name: form.value.name.trim(),
      taxId: form.value.taxId.trim() || undefined,
    },
  })
  saving.value = false
  if (err) {
    error.value = err
    return
  }
  form.value = { code: '', name: '', taxId: '' }
  await load()
}

onMounted(() => load())
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <UiIcon name="truck-side" :size="28" class="text-orange-600" />
        Proveedores
      </h2>
      <p class="text-slate-500 text-sm mt-1">
        Catálogo usado al crear órdenes de compra y en recepción.
      </p>
    </div>

    <div
      v-if="error"
      class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
    >
      {{ error }}
    </div>

    <form
      class="bg-white rounded-xl border border-slate-100 p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
      @submit.prevent="onSubmit"
    >
      <div>
        <label class="block text-xs font-medium text-slate-500 mb-1">Código</label>
        <input
          v-model="form.code"
          type="text"
          class="w-full p-2 border border-slate-300 rounded text-sm uppercase"
          placeholder="PHARMAMED"
        />
      </div>
      <div class="md:col-span-2">
        <label class="block text-xs font-medium text-slate-500 mb-1">Nombre</label>
        <input
          v-model="form.name"
          type="text"
          class="w-full p-2 border border-slate-300 rounded text-sm"
          placeholder="PharmaMed S.A."
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-500 mb-1">NIT (opcional)</label>
        <input
          v-model="form.taxId"
          type="text"
          class="w-full p-2 border border-slate-300 rounded text-sm"
        />
      </div>
      <button
        type="submit"
        class="md:col-span-4 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        :disabled="saving"
      >
        <UiIcon name="plus" :size="18" />
        {{ saving ? 'Guardando...' : 'Agregar proveedor' }}
      </button>
    </form>

    <div class="bg-white rounded-xl border border-slate-100 overflow-hidden">
      <div v-if="loading" class="p-8 text-center text-slate-500">Cargando...</div>
      <table v-else-if="suppliers.length" class="w-full text-sm">
        <thead class="bg-slate-50 text-slate-600 text-left">
          <tr>
            <th class="px-4 py-3 font-medium">Código</th>
            <th class="px-4 py-3 font-medium">Nombre</th>
            <th class="px-4 py-3 font-medium">NIT</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="s in suppliers" :key="s.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-mono text-xs">{{ s.code }}</td>
            <td class="px-4 py-3 font-medium">{{ s.name }}</td>
            <td class="px-4 py-3 text-slate-500">{{ s.taxId ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="p-8 text-center text-slate-400">Sin proveedores registrados.</p>
    </div>
  </div>
</template>
