<script setup lang="ts">
import type { RequisitionRow } from '~/types/dashboard'

interface PickingLine {
  id: string
  productId: string
  code: string
  name: string
  qtyToPick: number
  qtyPicked: number
  suggestedLotId: string
  suggestedLotNumber: string
  suggestedExpiresAt: string | null
}

interface PickingOrder {
  pickingOrderId: string
  pickingNumber: string
  requisitionNumber: string
  policy: string
  lines: PickingLine[]
}

definePageMeta({ layout: 'app' })

const { fetchApi } = useApi()

const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const requisitions = ref<RequisitionRow[]>([])
const picking = ref<PickingOrder | null>(null)
const transferNumber = ref('')
const scanInput = ref('')
const scanMsg = ref('')

const priorityClass: Record<string, string> = {
  ALTA: 'border-l-red-500 bg-red-50/50',
  MEDIA: 'border-l-amber-500 bg-amber-50/50',
  NORMAL: 'border-l-slate-300',
}

async function loadQueue() {
  loading.value = true
  error.value = null
  const { data, error: err } = await fetchApi<RequisitionRow[]>('/dashboard/requisitions')
  if (err) error.value = err
  else if (data) requisitions.value = data
  loading.value = false
}

async function startPicking(reqNumber: string) {
  saving.value = true
  error.value = null
  const { data, error: err } = await fetchApi<PickingOrder>(
    `/picking/start/${encodeURIComponent(reqNumber)}`,
    { method: 'POST' },
  )
  saving.value = false
  if (err) {
    error.value = err
    return
  }
  if (data) {
    picking.value = data
    scanMsg.value = `Picking ${data.pickingNumber} — política ${data.policy}`
  }
}

async function confirmPicking() {
  if (!picking.value) return
  saving.value = true
  error.value = null
  const { data, error: err } = await fetchApi<{ transferNumber: string }>(
    `/picking/order/${picking.value.pickingOrderId}/confirm`,
    {
      method: 'POST',
      body: {
        lines: picking.value.lines.map((l) => ({
          pickingLineId: l.id,
          qtyPicked: l.qtyToPick,
          lotId: l.suggestedLotId,
        })),
      },
    },
  )
  saving.value = false
  if (err) {
    error.value = err
    return
  }
  transferNumber.value = data?.transferNumber ?? ''
  picking.value = null
  scanMsg.value = `Despachado. Traslado: ${transferNumber.value}`
  await loadQueue()
}

function onScan() {
  const code = scanInput.value.trim().toUpperCase()
  if (!code) return
  const match = requisitions.value.find((r) => r.id.toUpperCase() === code)
  if (match) {
    startPicking(match.id)
  } else if (code.startsWith('REQ')) {
    startPicking(code)
  } else {
    scanMsg.value = `No se encontró requisición ${code}`
  }
  scanInput.value = ''
}

onMounted(() => loadQueue())
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <UiIcon name="arrow-up" :size="28" class="text-blue-600" />
        Picking / Despacho
      </h2>
      <p class="text-slate-500 text-sm mt-1">
        FEFO/FIFO automático al iniciar picking. Satélite confirma en
        <NuxtLink to="/pda/traslado" class="text-blue-600 hover:underline">PDA → Recibir traslado</NuxtLink>.
      </p>
    </div>

    <div class="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
      <label class="text-sm font-medium text-slate-700 flex items-center gap-2 mb-2">
        <UiIcon name="barcode" :size="18" />
        Escanear requisición
      </label>
      <form class="flex gap-2" @submit.prevent="onScan">
        <input
          v-model="scanInput"
          type="text"
          placeholder="REQ-…"
          class="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
          Iniciar
        </button>
      </form>
      <p v-if="scanMsg" class="text-sm text-slate-600 mt-2">{{ scanMsg }}</p>
      <p v-if="transferNumber" class="text-sm text-green-700 mt-1 font-mono">
        Último traslado: {{ transferNumber }}
      </p>
    </div>

    <div
      v-if="error"
      class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
    >
      {{ error }}
    </div>

    <div v-if="picking" class="bg-white rounded-xl border border-blue-200 p-6 space-y-4">
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-bold text-slate-800">{{ picking.requisitionNumber }}</h3>
          <p class="text-sm text-slate-500">{{ picking.pickingNumber }} · {{ picking.policy }}</p>
        </div>
        <button
          type="button"
          class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
          :disabled="saving"
          @click="confirmPicking"
        >
          <UiIcon name="check-circle" :size="18" />
          {{ saving ? 'Despachando...' : 'Confirmar despacho' }}
        </button>
      </div>
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-left">
          <tr>
            <th class="px-3 py-2">Producto</th>
            <th class="px-3 py-2">Lote FEFO/FIFO</th>
            <th class="px-3 py-2 text-right">Cant.</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="line in picking.lines" :key="line.id">
            <td class="px-3 py-2">
              <div class="font-medium">{{ line.name }}</div>
              <div class="text-xs text-slate-400">{{ line.code }}</div>
            </td>
            <td class="px-3 py-2">
              {{ line.suggestedLotNumber }}
              <span v-if="line.suggestedExpiresAt" class="text-xs text-slate-500 block">
                Vence {{ line.suggestedExpiresAt }}
              </span>
            </td>
            <td class="px-3 py-2 text-right font-medium">{{ line.qtyToPick }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="loading" class="text-center py-8 text-slate-500">Cargando cola...</div>
    <div v-else-if="!picking" class="space-y-3">
      <p class="text-sm text-slate-500">Requisiciones pendientes ({{ requisitions.length }})</p>
      <button
        v-for="req in requisitions"
        :key="req.id"
        type="button"
        class="w-full text-left bg-white rounded-xl border p-4 border-l-4 hover:shadow-md transition"
        :class="priorityClass[req.priority] ?? priorityClass.NORMAL"
        @click="startPicking(req.id)"
      >
        <span class="font-mono font-bold">{{ req.id }}</span>
        <span class="text-sm text-slate-600 block mt-1">→ {{ req.destination }}</span>
      </button>
      <p v-if="!requisitions.length" class="text-center text-slate-400 py-8">
        Sin requisiciones. Cree una en
        <NuxtLink to="/bodegas" class="text-blue-600 underline">Bodegas Satélite</NuxtLink>.
      </p>
    </div>
  </div>
</template>
