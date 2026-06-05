<script setup lang="ts">
import { formatInvimaDate } from '~/composables/useInvimaExpired'

export interface ExpiredInvimaItem {
  cumCodigo?: string | null
  producto?: string | null
  registroSanitario?: string | null
  fechaVencimiento?: string | null
  listType?: string
  estadoRegistro?: string | null
}

const open = defineModel<boolean>('open', { default: false })

defineProps<{
  items: ExpiredInvimaItem[]
}>()

const listLabels: Record<string, string> = {
  VIGENTE: 'Vigentes',
  VENCIDO: 'Vencidos',
  RENOVACION: 'Renovación',
  OTRO_ESTADO: 'Otros estados',
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      @click.self="open = false"
    >
      <div
        class="bg-white rounded-xl shadow-xl max-w-lg w-full border border-red-200 overflow-hidden"
        role="alertdialog"
        aria-labelledby="invima-expired-title"
      >
        <div class="bg-red-50 px-5 py-4 border-b border-red-100 flex gap-3 items-start">
          <div class="bg-red-100 text-red-600 p-2 rounded-lg shrink-0">
            <UiIcon name="triangle-warning" :size="24" />
          </div>
          <div>
            <h3 id="invima-expired-title" class="font-bold text-red-900 text-lg">
              Medicamento vencido
            </h3>
            <p class="text-sm text-red-800 mt-1">
              El producto consultado aparece como vencido en los listados INVIMA. Revise antes de
              recibir o dispensar.
            </p>
          </div>
        </div>
        <ul class="max-h-64 overflow-y-auto divide-y divide-slate-100 text-sm">
          <li v-for="(item, i) in items" :key="i" class="px-5 py-3">
            <p class="font-mono text-xs text-slate-500">{{ item.cumCodigo ?? '—' }}</p>
            <p class="font-medium text-slate-800 mt-0.5">{{ item.producto ?? '—' }}</p>
            <p class="text-xs text-slate-600 mt-1">
              Registro: {{ item.registroSanitario ?? '—' }} · Vence:
              {{ formatInvimaDate(item.fechaVencimiento) }}
              <span v-if="item.listType" class="ml-1">
                ({{ listLabels[item.listType] ?? item.listType }})
              </span>
            </p>
          </li>
        </ul>
        <div class="px-5 py-4 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
            @click="open = false"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
