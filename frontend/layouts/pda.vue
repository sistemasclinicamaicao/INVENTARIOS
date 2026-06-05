<template>
  <div class="min-h-screen bg-slate-900 text-white font-sans max-w-[360px] mx-auto">
    <header class="h-12 flex items-center px-3 border-b border-slate-700 bg-slate-800">
      <NuxtLink to="/pda" class="text-sm font-bold text-blue-400">PDA Clínica</NuxtLink>
    </header>
    <main class="p-3 pb-8">
      <slot />
    </main>
  </div>
</template>
