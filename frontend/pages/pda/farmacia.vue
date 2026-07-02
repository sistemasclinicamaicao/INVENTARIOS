<script setup lang="ts">
definePageMeta({ layout: 'pda' })

const { fetchApi } = useApi()

interface Prescription {
  id: string
  externalId: string | null
  patientId: string
  status: string
  createdAt: string
  lines: number
}

interface RxLine {
  productId: string
  code: string
  name: string
  isControlado: boolean
  doseQty: number
}

const prescriptions = ref<Prescription[]>([])
const selectedId = ref('')
const rxDetail = ref<{ id: string; patientId: string; lines: RxLine[] } | null>(null)
const farmWarehouseId = ref('')
const validatorCedula = ref('')
const loading = ref(true)
const dispensing = ref(false)
const message = ref('')
const error = ref('')

async function loadRxDetail(id: string) {
  selectedId.value = id
  const { data, error: err } = await fetchApi<typeof rxDetail.value>(
    `/pharmacy/prescriptions/${id}`,
  )
  if (err) error.value = err
  else rxDetail.value = data
}

async function dispense() {
  if (!rxDetail.value || !farmWarehouseId.value) {
    error.value = 'Seleccione prescripción y bodega farmacia'
    return
  }
  const hasCtrl = rxDetail.value.lines.some((l) => l.isControlado)
  if (hasCtrl && !validatorCedula.value.trim()) {
    error.value = 'Ingrese cédula del validador (controlados)'
    return
  }

  dispensing.value = true
  error.value = ''
  const { error: err } = await fetchApi('/pharmacy/dispense', {
    method: 'POST',
    body: {
      prescriptionId: rxDetail.value.id,
      warehouseId: farmWarehouseId.value,
      notes: hasCtrl ? `Validador: ${validatorCedula.value.trim()}` : undefined,
      lines: rxDetail.value.lines.map((l) => ({
        productId: l.productId,
        qty: Number(l.doseQty),
      })),
    },
  })
  dispensing.value = false
  if (err) {
    error.value = err
    return
  }
  message.value = 'Prescripción dispensada'
  rxDetail.value = null
  selectedId.value = ''
  validatorCedula.value = ''
  await loadList()
}

async function loadList() {
  loading.value = true
  const { data, error: err } = await fetchApi<Prescription[]>(
    '/pharmacy/prescriptions-pending',
  )
  loading.value = false
  if (err) error.value = err
  else if (data) prescriptions.value = data
}

onMounted(async () => {
  const { data: invWh } = await fetchApi<{ id: string; code: string }[]>(
    '/inventory/warehouses',
    { quiet: true },
  )
  let farm = invWh?.find((w) => w.code === 'BC-FARM')
  if (!farm) {
    const { data: masterWh } = await fetchApi<{ id: string; code: string }[]>(
      '/masters/warehouses',
      { quiet: true },
    )
    farm = masterWh?.find((w) => w.code === 'BC-FARM')
  }
  if (farm) farmWarehouseId.value = farm.id
  await loadList()
})
</script>

<template>
  <div class="space-y-4">
    <PdaBackLink />
    <h2 class="font-bold text-base">Farmacia — dispensar</h2>

    <PdaStatusMessage :message="message" :error="error" />

    <template v-if="rxDetail">
      <div class="border border-slate-700 rounded-lg p-3 text-sm">
        <p class="text-slate-400 text-xs">Paciente</p>
        <p class="font-medium">{{ rxDetail.patientId }}</p>
      </div>
      <ul class="space-y-2 max-h-[35vh] overflow-y-auto text-sm">
        <li
          v-for="line in rxDetail.lines"
          :key="line.productId"
          class="p-2 border border-slate-700 rounded-lg"
        >
          <p class="font-mono text-xs text-purple-300">{{ line.code }}</p>
          <p class="text-slate-300 truncate">{{ line.name }}</p>
          <p class="text-xs text-slate-500">
            Cant: {{ line.doseQty }}
            <span v-if="line.isControlado" class="text-amber-400"> · Controlado</span>
          </p>
        </li>
      </ul>
      <input
        v-if="rxDetail.lines.some((l) => l.isControlado)"
        v-model="validatorCedula"
        placeholder="Cédula validador"
        class="w-full p-3 rounded-lg bg-slate-800 border border-slate-600 text-sm"
      />
      <button
        type="button"
        class="w-full py-3 bg-purple-600 rounded-lg font-medium disabled:opacity-50"
        :disabled="dispensing"
        @click="dispense"
      >
        {{ dispensing ? 'Dispensando…' : 'Confirmar dispensación' }}
      </button>
      <button
        type="button"
        class="w-full py-2 text-sm text-slate-400"
        @click="rxDetail = null"
      >
        Cancelar
      </button>
    </template>

    <template v-else>
      <p v-if="loading" class="text-sm text-slate-500">Cargando…</p>
      <ul v-else class="space-y-2">
        <li
          v-for="rx in prescriptions"
          :key="rx.id"
          class="p-3 border border-slate-700 rounded-lg active:bg-slate-800"
          @click="loadRxDetail(rx.id)"
        >
          <p class="font-medium text-sm">Paciente {{ rx.patientId }}</p>
          <p class="text-xs text-slate-400">{{ rx.lines }} línea(s)</p>
        </li>
        <li v-if="!prescriptions.length" class="text-sm text-slate-500">
          Sin prescripciones pendientes
        </li>
      </ul>
    </template>
  </div>
</template>
