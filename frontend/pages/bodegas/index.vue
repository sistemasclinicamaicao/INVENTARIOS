<script setup lang="ts">
import type {
  CentralWarehouseOption,
  InternalRequisitionRow,
  RequisitionHeaderDraft,
  RequisitionLineDraft,
  SatellitesResponse,
  SatelliteWarehouse,
} from '~/types/requisition-internal'

definePageMeta({ layout: 'app' })

const { fetchApi } = useApi()

const loading = ref(true)
const error = ref<string | null>(null)
const successMsg = ref<string | null>(null)
const creating = ref(false)

const nextNumber = ref('')
const satelliteWarehouses = ref<SatelliteWarehouse[]>([])
const allWarehouses = ref<CentralWarehouseOption[]>([])
const requisitions = ref<InternalRequisitionRow[]>([])

const header = ref<RequisitionHeaderDraft>({
  sourceWarehouseId: '',
  destWarehouseId: '',
  priority: 'NORMAL',
})

const lines = ref<RequisitionLineDraft[]>([])

const CENTRAL_TYPES = ['CENTRAL_ALMACEN', 'CENTRAL_FARMACIA']

const centralWarehouses = computed(() =>
  allWarehouses.value.filter((w) => CENTRAL_TYPES.includes(w.type)),
)

const selectedSource = computed(() =>
  centralWarehouses.value.find((w) => w.id === header.value.sourceWarehouseId),
)

const catalogFarmacia = computed<boolean | null>(() => {
  const src = selectedSource.value
  if (!src) return null
  return src.type === 'CENTRAL_FARMACIA'
})

async function load() {
  loading.value = true
  error.value = null
  const [satRes, whRes, nextRes] = await Promise.all([
    fetchApi<SatellitesResponse>('/warehouse/satellites'),
    fetchApi<CentralWarehouseOption[]>('/masters/warehouses'),
    fetchApi<{ number: string }>('/operations/requisitions/next-number'),
  ])

  const errors: string[] = []
  if (satRes.error) errors.push(satRes.error)
  if (whRes.error) errors.push(whRes.error)
  if (nextRes.error) errors.push(nextRes.error)

  if (satRes.data) {
    satelliteWarehouses.value = satRes.data.warehouses ?? []
    requisitions.value = satRes.data.requisitions ?? []
  } else {
    satelliteWarehouses.value = []
    requisitions.value = []
  }

  if (whRes.data) {
    allWarehouses.value = whRes.data.map((w) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      type: w.type,
    }))
  }

  if (nextRes.data?.number) nextNumber.value = nextRes.data.number

  if (errors.length) {
    error.value = errors[0] ?? 'No se pudo conectar con la API'
  }

  loading.value = false
}

async function createRequisition() {
  if (!header.value.sourceWarehouseId || !header.value.destWarehouseId) {
    error.value = 'Seleccione bodega origen y destino satélite'
    return
  }
  if (!lines.value.length) {
    error.value = 'Agregue al menos un producto a la requisición'
    return
  }
  if (lines.value.some((l) => l.qty < 1)) {
    error.value = 'Todas las líneas deben tener cantidad mayor a cero'
    return
  }

  creating.value = true
  error.value = null
  successMsg.value = null

  const { data, error: err } = await fetchApi<{ number: string }>('/operations/requisitions', {
    method: 'POST',
    body: {
      sourceWarehouseId: header.value.sourceWarehouseId,
      destWarehouseId: header.value.destWarehouseId,
      priority: header.value.priority,
      lines: lines.value.map((l) => ({
        productId: l.productId,
        qtyRequested: l.qty,
        unit: l.unit || 'UND',
      })),
    },
  })

  creating.value = false
  if (err || !data) {
    error.value = err ?? 'No se pudo crear la requisición'
    return
  }

  const createdNumber = data.number
  successMsg.value = `Requisición ${createdNumber} creada correctamente`
  lines.value = []
  header.value = { ...header.value, priority: 'NORMAL' }
  await load()
}

onMounted(() => load())
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <UiIcon name="box" :size="28" class="text-teal-600" />
        Bodegas Satélite
      </h2>
      <p class="text-slate-500 text-sm mt-1">
        Requisiciones internas desde bodega central hacia puntos periféricos (Urgencias, UCI, Quirófanos).
      </p>
    </div>

    <div v-if="loading" class="text-center py-12 text-slate-500">Cargando bodegas...</div>

    <template v-else>
      <div
        v-if="error"
        class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
      >
        {{ error }}
      </div>
      <div
        v-if="successMsg"
        class="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm"
      >
        {{ successMsg }}
      </div>

      <div class="bg-white rounded-xl border border-slate-100 p-6 space-y-5">
        <h3 class="font-semibold text-slate-800">Nueva requisición interna</h3>

        <BodegasRequisitionHeaderForm
          v-model="header"
          :next-number="nextNumber"
          :central-warehouses="centralWarehouses"
          :satellite-warehouses="satelliteWarehouses"
        />

        <BodegasRequisitionLinesEditor
          v-model:lines="lines"
          :catalog-farmacia="catalogFarmacia"
        />

        <div class="flex justify-end pt-2">
          <button
            type="button"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700"
            :disabled="creating || !(lines?.length)"
            @click="createRequisition"
          >
            {{ creating ? 'Creando...' : 'Crear requisición' }}
          </button>
        </div>
      </div>

      <BodegasSatelliteWarehouseCards :warehouses="satelliteWarehouses" />

      <BodegasRequisitionHistoryTable :requisitions="requisitions" />
    </template>
  </div>
</template>
