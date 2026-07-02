<script setup lang="ts">
definePageMeta({ layout: 'pda' })

const { fetchApi } = useApi()

interface RequisitionRow {
  id: string
  number: string
  status: string
  priority: string
  source: string
  destination: string
}

interface PickingLine {
  id: string
  code: string
  name: string
  qtyToPick: number
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

const queue = ref<RequisitionRow[]>([])
const picking = ref<PickingOrder | null>(null)
const loading = ref(true)
const saving = ref(false)
const message = ref('')
const error = ref('')
const transferNumber = ref('')

async function loadQueue() {
  loading.value = true
  error.value = ''
  const { data, error: err } = await fetchApi<RequisitionRow[]>(
    '/operations/requisitions?status=PENDING',
  )
  loading.value = false
  if (err) error.value = err
  else if (data) queue.value = data
}

async function startPicking(reqNumber: string) {
  saving.value = true
  error.value = ''
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
    message.value = `${data.pickingNumber} — ${data.policy}`
  }
}

async function confirmPicking() {
  if (!picking.value) return
  saving.value = true
  error.value = ''
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
  message.value = `Despachado. Traslado: ${transferNumber.value}`
  picking.value = null
  await loadQueue()
}

function onScanReq(code: string) {
  const c = code.trim().toUpperCase()
  const match = queue.value.find((r) => r.number.toUpperCase() === c || r.id.toUpperCase() === c)
  if (match) startPicking(match.number)
  else if (c.startsWith('REQ')) startPicking(c)
  else error.value = `Requisición no encontrada: ${code}`
}

onMounted(() => loadQueue())
</script>

<template>
  <div class="space-y-4">
    <PdaBackLink />
    <h2 class="font-bold text-base">Picking / despacho</h2>

    <PdaScanField
      placeholder="Escanear REQ-…"
      :disabled="saving || !!picking"
      @scan="onScanReq"
    />

    <PdaStatusMessage :message="message" :error="error" />

    <template v-if="picking">
      <div class="text-xs text-slate-400 border border-slate-700 rounded-lg p-2">
        <p>{{ picking.requisitionNumber }}</p>
        <p>{{ picking.lines.length }} línea(s) — política {{ picking.policy }}</p>
      </div>
      <ul class="space-y-2 max-h-[40vh] overflow-y-auto text-sm">
        <li
          v-for="line in picking.lines"
          :key="line.id"
          class="p-2 border border-slate-700 rounded-lg"
        >
          <p class="font-mono text-xs text-blue-300">{{ line.code }}</p>
          <p class="text-slate-300 truncate">{{ line.name }}</p>
          <p class="text-xs text-slate-500">Cant: {{ line.qtyToPick }} · Lote {{ line.suggestedLotNumber }}</p>
        </li>
      </ul>
      <button
        type="button"
        class="w-full py-3 bg-orange-500 rounded-lg font-medium disabled:opacity-50"
        :disabled="saving"
        @click="confirmPicking"
      >
        {{ saving ? 'Confirmando…' : 'Confirmar despacho' }}
      </button>
    </template>

    <template v-else>
      <p v-if="loading" class="text-sm text-slate-500">Cargando cola…</p>
      <ul v-else class="space-y-2">
        <li
          v-for="req in queue"
          :key="req.id"
          class="p-3 border border-slate-700 rounded-lg active:bg-slate-800"
          @click="startPicking(req.number)"
        >
          <p class="font-medium text-sm">{{ req.number }}</p>
          <p class="text-xs text-slate-400">{{ req.source }} → {{ req.destination }}</p>
          <p class="text-[10px] text-slate-500 mt-1">Prioridad {{ req.priority }}</p>
        </li>
        <li v-if="!queue.length" class="text-sm text-slate-500">Sin requisiciones pendientes</li>
      </ul>
    </template>
  </div>
</template>
