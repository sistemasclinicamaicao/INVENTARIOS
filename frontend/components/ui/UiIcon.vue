<script setup lang="ts">
import { FLATICON_ICONS, type FlaticonIconName } from '~/utils/flaticon-icons'

const props = withDefaults(
  defineProps<{
    name: FlaticonIconName
    size?: number
    class?: string
  }>(),
  { size: 18 },
)

const iconClass = computed(() => {
  const suffix = FLATICON_ICONS[props.name]
  return ['fi', `fi-rr-${suffix}`, props.class].filter(Boolean)
})
</script>

<template>
  <i
    :class="iconClass"
    :style="{ fontSize: `${size}px`, lineHeight: 1 }"
    aria-hidden="true"
  />
</template>
