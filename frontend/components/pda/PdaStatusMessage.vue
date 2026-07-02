<script setup lang="ts">
defineProps<{
  message?: string | null
  error?: string | null
}>()
</script>

<template>
  <p
    v-if="message"
    class="text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-800 rounded-lg px-3 py-2"
  >
    {{ message }}
  </p>
  <p
    v-if="error"
    class="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2"
  >
    {{ error }}
  </p>
</template>
