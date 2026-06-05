<script setup lang="ts">
definePageMeta({ layout: 'app' })

const { fetchApi } = useApi()
const summary = ref({ products: 0, warehouses: 0, requisitions: 0, open_orders: 0 })

onMounted(async () => {
  const { data } = await fetchApi<typeof summary.value>('/masters/summary')
  if (data) summary.value = data
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-slate-800">Maestros e importación</h2>
      <p class="text-slate-500 text-sm mt-1">
        Cargue la información real de la clínica. Los datos de demostración (Epinefrina, REQ-1042, etc.) no se usan aquí.
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="bg-white p-4 rounded-xl border border-slate-100">
        <p class="text-sm text-slate-500">Productos</p>
        <p class="text-2xl font-bold">{{ summary.products }}</p>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-100">
        <p class="text-sm text-slate-500">Bodegas</p>
        <p class="text-2xl font-bold">{{ summary.warehouses }}</p>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-100">
        <p class="text-sm text-slate-500">Requisiciones activas</p>
        <p class="text-2xl font-bold">{{ summary.requisitions }}</p>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-100">
        <p class="text-sm text-slate-500">OC abiertas</p>
        <p class="text-2xl font-bold">{{ summary.open_orders }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <NuxtLink
        to="/maestros/importar"
        class="bg-white p-6 rounded-xl border border-slate-100 hover:border-blue-300 transition flex gap-4 items-start"
      >
        <div class="bg-blue-50 p-3 rounded-lg text-blue-600">
          <UiIcon name="upload" :size="24" />
        </div>
        <div>
          <h3 class="font-semibold text-slate-800">Importar desde CSV</h3>
          <p class="text-sm text-slate-500 mt-1">
            Plantillas en <code class="text-xs bg-slate-100 px-1 rounded">data/plantillas/</code> (separador ;)
          </p>
        </div>
      </NuxtLink>

      <NuxtLink
        to="/maestros/bodegas"
        class="bg-white p-6 rounded-xl border border-slate-100 hover:border-blue-300 transition flex gap-4 items-start"
      >
        <div class="bg-teal-50 p-3 rounded-lg text-teal-600">
          <UiIcon name="box-alt" :size="24" />
        </div>
        <div>
          <h3 class="font-semibold text-slate-800">Bodegas y ubicaciones</h3>
          <p class="text-sm text-slate-500 mt-1">Centrales, satélite y políticas FIFO/FEFO</p>
        </div>
      </NuxtLink>

      <NuxtLink
        to="/maestros/productos"
        class="bg-white p-6 rounded-xl border border-slate-100 hover:border-blue-300 transition flex gap-4 items-start"
      >
        <div class="bg-green-50 p-3 rounded-lg text-green-600">
          <UiIcon name="box" :size="24" />
        </div>
        <div>
          <h3 class="font-semibold text-slate-800">Catálogo de productos</h3>
          <p class="text-sm text-slate-500 mt-1">Alta manual y consulta de su inventario real</p>
        </div>
      </NuxtLink>

      <NuxtLink
        to="/maestros/invima"
        class="bg-white p-6 rounded-xl border border-slate-100 hover:border-blue-300 transition flex gap-4 items-start"
      >
        <div class="bg-violet-50 p-3 rounded-lg text-violet-600">
          <UiIcon name="document" :size="24" />
        </div>
        <div>
          <h3 class="font-semibold text-slate-800">Referencia INVIMA</h3>
          <p class="text-sm text-slate-500 mt-1">Código único (CUM): vigentes, vencidos, renovación</p>
        </div>
      </NuxtLink>
    </div>

    <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
      <strong>Primera vez:</strong> ejecute <code class="bg-amber-100 px-1 rounded">limpiar-demo.bat</code> para borrar datos de ejemplo,
      luego importe sus archivos CSV o registre productos manualmente.
    </div>
  </div>
</template>
