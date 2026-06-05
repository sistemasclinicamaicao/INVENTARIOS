<script setup lang="ts">
const route = useRoute()
const isFullWidth = computed(() => route.meta.fullWidth === true)
</script>

<template>
  <div class="flex h-screen bg-slate-100 font-sans text-slate-900">
    <LayoutAppSidebar />
    <main class="flex-1 flex flex-col h-screen overflow-hidden">
      <LayoutAppHeader />
      <div class="flex-1 overflow-auto p-4 bg-slate-50/50">
        <div :class="isFullWidth ? 'w-full' : 'max-w-[90rem] mx-auto w-full'">
          <slot />
        </div>
      </div>
    </main>
  </div>
</template>
