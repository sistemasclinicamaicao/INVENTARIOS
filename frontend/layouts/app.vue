<script setup lang="ts">
const route = useRoute()
const isFullWidth = computed(() => route.meta.fullWidth === true)
const isCompactContent = computed(() => route.meta.compactContent === true)
</script>

<template>
  <div class="flex h-screen bg-slate-100 font-sans text-slate-900">
    <LayoutAppSidebar />
    <main class="flex-1 flex flex-col h-screen overflow-hidden">
      <LayoutAppHeader />
      <div
        class="flex-1 overflow-auto bg-slate-50/50 min-h-0"
        :class="isCompactContent ? 'p-2' : 'p-4'"
      >
        <div
          :class="[
            isFullWidth ? 'w-full h-full min-h-0' : 'max-w-[90rem] mx-auto w-full',
          ]"
        >
          <slot />
        </div>
      </div>
    </main>
  </div>
</template>
