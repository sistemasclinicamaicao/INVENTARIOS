<script setup lang="ts">

defineProps<{

  pendingRequisitions: number

  deliveriesToday: number

  lowStock: number

  expiringSoon: number

}>()

</script>



<template>

  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">

    <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">

      <div>

        <p class="text-sm text-slate-500 font-medium">Requisiciones Pendientes</p>

        <p class="text-3xl font-bold text-slate-800 mt-1">{{ pendingRequisitions }}</p>

      </div>

      <div class="bg-blue-50 p-3 rounded-lg text-blue-600">

        <UiIcon name="arrow-up" :size="24" />

      </div>

    </div>

    <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">

      <div>

        <p class="text-sm text-slate-500 font-medium">Entregas Hoy</p>

        <p class="text-3xl font-bold text-slate-800 mt-1">{{ deliveriesToday }}</p>

      </div>

      <div class="bg-green-50 p-3 rounded-lg text-green-600">

        <UiIcon name="check-circle" :size="24" />

      </div>

    </div>

    <div

      class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between border-l-4 border-l-orange-500"

    >

      <div>

        <p class="text-sm text-slate-500 font-medium">Stock Bajo (General)</p>

        <p class="text-3xl font-bold text-slate-800 mt-1">{{ lowStock }}</p>

      </div>

      <div class="bg-orange-50 p-3 rounded-lg text-orange-600">

        <UiIcon name="box" :size="24" />

      </div>

    </div>

    <div

      class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between border-l-4 border-l-red-500"

    >

      <div>

        <p class="text-sm text-slate-500 font-medium">Próximos a Vencer</p>

        <p class="text-3xl font-bold text-red-600 mt-1">{{ expiringSoon }}</p>

      </div>

      <div class="bg-red-50 p-3 rounded-lg text-red-600">

        <UiIcon name="triangle-warning" :size="24" />

      </div>

    </div>

  </div>

</template>

