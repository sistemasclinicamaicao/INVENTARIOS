<template>
  <div class="min-h-screen bg-slate-900 text-white font-sans max-w-[360px] mx-auto">
    <header class="h-12 flex items-center justify-between px-3 border-b border-slate-700 bg-slate-800">
      <NuxtLink to="/pda" class="text-sm font-bold text-blue-400">PDA Clínica</NuxtLink>
      <NuxtLink to="/" class="text-[10px] text-slate-500 hover:text-slate-300">Escritorio</NuxtLink>
    </header>
    <main class="p-3 pb-10">
      <slot />
    </main>
  </div>
</template>
