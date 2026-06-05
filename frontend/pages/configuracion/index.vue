<script setup lang="ts">
definePageMeta({ layout: 'app' })

const apiBase = useApiBase()
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <UiIcon name="settings" :size="28" class="text-slate-600" />
        Configuración
      </h2>
      <p class="text-slate-500 text-sm mt-1">
        Maestros, importación de datos reales y parámetros del sistema.
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <NuxtLink
        to="/compras/proveedores"
        class="bg-white p-6 rounded-xl border border-slate-100 hover:border-blue-300 transition flex gap-4 items-start"
      >
        <div class="bg-orange-50 p-3 rounded-lg text-orange-600">
          <UiIcon name="truck-side" :size="24" />
        </div>
        <div>
          <h3 class="font-semibold text-slate-800">Proveedores</h3>
          <p class="text-sm text-slate-500 mt-1">Catálogo para órdenes de compra</p>
        </div>
      </NuxtLink>

      <NuxtLink
        to="/compras/ordenes"
        class="bg-white p-6 rounded-xl border border-slate-100 hover:border-blue-300 transition flex gap-4 items-start"
      >
        <div class="bg-indigo-50 p-3 rounded-lg text-indigo-600">
          <UiIcon name="document" :size="24" />
        </div>
        <div>
          <h3 class="font-semibold text-slate-800">Órdenes de compra</h3>
          <p class="text-sm text-slate-500 mt-1">OC, proveedor y bodega destino</p>
        </div>
      </NuxtLink>

      <NuxtLink
        to="/maestros"
        class="bg-white p-6 rounded-xl border border-slate-100 hover:border-blue-300 transition flex gap-4 items-start"
      >
        <div class="bg-blue-50 p-3 rounded-lg text-blue-600">
          <UiIcon name="database" :size="24" />
        </div>
        <div>
          <h3 class="font-semibold text-slate-800">Maestros</h3>
          <p class="text-sm text-slate-500 mt-1">Resumen de productos, bodegas y requisiciones</p>
        </div>
      </NuxtLink>

      <NuxtLink
        to="/maestros/importar"
        class="bg-white p-6 rounded-xl border border-slate-100 hover:border-blue-300 transition flex gap-4 items-start"
      >
        <div class="bg-green-50 p-3 rounded-lg text-green-600">
          <UiIcon name="upload" :size="24" />
        </div>
        <div>
          <h3 class="font-semibold text-slate-800">Importar CSV</h3>
          <p class="text-sm text-slate-500 mt-1">Plantillas en <code class="text-xs bg-slate-100 px-1 rounded">data/plantillas/</code></p>
        </div>
      </NuxtLink>

      <NuxtLink
        to="/maestros/productos"
        class="bg-white p-6 rounded-xl border border-slate-100 hover:border-blue-300 transition flex gap-4 items-start"
      >
        <div class="bg-purple-50 p-3 rounded-lg text-purple-600">
          <UiIcon name="box" :size="24" />
        </div>
        <div>
          <h3 class="font-semibold text-slate-800">Catálogo de productos</h3>
          <p class="text-sm text-slate-500 mt-1">Alta manual y consulta</p>
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
          <p class="text-sm text-slate-500 mt-1">Listados código único (sin cruce con inventario aún)</p>
        </div>
      </NuxtLink>

      <NuxtLink
        to="/configuracion/integraciones"
        class="bg-white p-6 rounded-xl border border-slate-100 hover:border-blue-300 transition flex gap-4 items-start"
      >
        <div class="bg-teal-50 p-3 rounded-lg text-teal-600">
          <UiIcon name="settings" :size="24" />
        </div>
        <div>
          <h3 class="font-semibold text-slate-800">Integraciones</h3>
          <p class="text-sm text-slate-500 mt-1">Conexión ERP principal, sondeo OC, RRHH/HIS</p>
        </div>
      </NuxtLink>
    </div>

    <div class="bg-slate-800 text-slate-300 rounded-xl p-5 text-sm font-mono">
      <p class="text-slate-400 text-xs uppercase mb-2">Conexión</p>
      <p>API vía proxy: <code>{{ apiBase }}</code> (NestJS en puerto 3050)</p>
    </div>

    <p class="text-xs text-slate-400">
      Iconos:
      <a href="https://www.flaticon.com/uicons" class="text-blue-600 hover:underline" target="_blank" rel="noopener">Flaticon Uicons</a>
      (Regular Rounded). Busque más en
      <a href="https://www.flaticon.es/icon-fonts-mas-descargados" class="text-blue-600 hover:underline" target="_blank" rel="noopener">fuentes más descargadas</a>.
    </p>
  </div>
</template>
