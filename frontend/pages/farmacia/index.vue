<script setup lang="ts">
definePageMeta({ layout: 'app' })

interface ControlledProduct {
  id: string
  code: string
  name: string
  description: string | null
  totalStock: number
  minStock: number
}

interface Prescription {
  id: string
  externalId: string | null
  patientId: string
  status: string
  createdAt: string
  lines: number
}

interface LogEntry {
  validatedAt: string
  notes: string | null
  productName: string
  validatorName: string
}

const { fetchApi } = useApi()

const tab = ref<'stock' | 'rx' | 'log'>('stock')
const loading = ref(true)
const error = ref<string | null>(null)
const products = ref<ControlledProduct[]>([])
const prescriptions = ref<Prescription[]>([])
const log = ref<LogEntry[]>([])
const selectedRxId = ref('')
const rxDetail = ref<{
  id: string
  patientId: string
  lines: { productId: string; code: string; name: string; isControlado: boolean; doseQty: number }[]
} | null>(null)
const farmWarehouseId = ref('')
const validatorCedula = ref('')
const dispensing = ref(false)

async function loadRxDetail(id: string) {
  selectedRxId.value = id
  const { data } = await fetchApi<typeof rxDetail.value>(`/pharmacy/prescriptions/${id}`)
  rxDetail.value = data
}

async function dispenseRx() {
  if (!rxDetail.value || !farmWarehouseId.value) {
    error.value = 'Seleccione prescripción y bodega farmacia'
    return
  }
  const hasCtrl = rxDetail.value.lines.some((l) => l.isControlado)
  dispensing.value = true
  const { error: err } = await fetchApi('/pharmacy/dispense', {
    method: 'POST',
    body: {
      prescriptionId: rxDetail.value.id,
      warehouseId: farmWarehouseId.value,
      validatorUserId: hasCtrl ? undefined : undefined,
      notes: hasCtrl ? `Validador: ${validatorCedula.value}` : undefined,
      lines: rxDetail.value.lines.map((l) => ({
        productId: l.productId,
        qty: Number(l.doseQty),
      })),
    },
  })
  dispensing.value = false
  if (err) error.value = err
  else {
    rxDetail.value = null
    selectedRxId.value = ''
    await load()
  }
}

async function load() {
  loading.value = true
  error.value = null
  const [prodRes, rxRes, logRes] = await Promise.all([
    fetchApi<ControlledProduct[]>('/pharmacy/controlled-products'),
    fetchApi<Prescription[]>('/pharmacy/prescriptions-pending'),
    fetchApi<LogEntry[]>('/pharmacy/controlled-log'),
  ])
  if (prodRes.error) error.value = prodRes.error
  if (prodRes.data) products.value = prodRes.data
  if (rxRes.data) prescriptions.value = rxRes.data
  if (logRes.data) log.value = logRes.data
  loading.value = false
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
}

onMounted(async () => {
  const { data: wh } = await fetchApi<{ id: string; code: string }[]>('/masters/warehouses')
  const farm = wh?.find((w) => w.code === 'BC-FARM')
  if (farm) farmWarehouseId.value = farm.id
  await load()
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <UiIcon name="pills" :size="28" class="text-purple-600" />
        Farmacia (Controlados)
      </h2>
      <p class="text-slate-500 text-sm mt-1">
        Inventario de medicamentos controlados, prescripciones pendientes y bitácora de validación.
      </p>
    </div>

    <div class="flex gap-2 border-b border-slate-200">
      <button
        type="button"
        class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition"
        :class="tab === 'stock' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-700'"
        @click="tab = 'stock'"
      >
        Stock controlados
      </button>
      <button
        type="button"
        class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition"
        :class="tab === 'rx' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-700'"
        @click="tab = 'rx'"
      >
        Prescripciones
        <span
          v-if="prescriptions.length"
          class="ml-1 bg-purple-100 text-purple-800 text-xs px-1.5 py-0.5 rounded-full"
        >{{ prescriptions.length }}</span>
      </button>
      <button
        type="button"
        class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition"
        :class="tab === 'log' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-700'"
        @click="tab = 'log'"
      >
        Bitácora
      </button>
    </div>

    <div v-if="loading" class="text-center py-12 text-slate-500">Cargando farmacia...</div>

    <template v-else>
      <div
        v-if="error"
        class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
      >
        {{ error }}
      </div>

      <div v-if="tab === 'stock'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-if="!products.length"
          class="md:col-span-2 bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400"
        >
          No hay productos marcados como controlados. En el catálogo active
          <code class="text-xs bg-slate-100 px-1 rounded">is_controlado</code> o importe su maestro.
        </div>
        <div
          v-for="p in products"
          :key="p.id"
          class="bg-white rounded-xl border border-slate-100 p-5 shadow-sm"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <h3 class="font-semibold text-slate-800">{{ p.name }}</h3>
              <p class="text-xs text-slate-400">{{ p.code }}</p>
            </div>
            <UiIcon
              name="shield-check"
              :size="22"
              :class="p.totalStock > 0 ? 'text-green-600' : 'text-slate-300'"
            />
          </div>
          <p v-if="p.description" class="text-sm text-slate-500 mt-2">{{ p.description }}</p>
          <div class="mt-4 flex justify-between text-sm">
            <span class="text-slate-500">Stock total</span>
            <span
              class="font-bold"
              :class="p.totalStock < p.minStock ? 'text-amber-600' : 'text-slate-800'"
            >
              {{ p.totalStock.toLocaleString() }}
            </span>
          </div>
        </div>
      </div>

      <div v-else-if="tab === 'rx'" class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div v-if="!prescriptions.length" class="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
          <UiIcon name="clipboard-list" :size="40" class="opacity-40" />
          Sin prescripciones pendientes del HIS.
        </div>
        <table v-else class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th class="px-4 py-3 font-medium">ID externo</th>
              <th class="px-4 py-3 font-medium">Paciente</th>
              <th class="px-4 py-3 font-medium">Líneas</th>
              <th class="px-4 py-3 font-medium">Fecha</th>
              <th class="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="rx in prescriptions"
              :key="rx.id"
              class="hover:bg-slate-50 cursor-pointer"
              @click="loadRxDetail(rx.id)"
            >
              <td class="px-4 py-3 font-mono text-xs">{{ rx.externalId ?? rx.id.slice(0, 8) }}</td>
              <td class="px-4 py-3">{{ rx.patientId }}</td>
              <td class="px-4 py-3">{{ rx.lines }}</td>
              <td class="px-4 py-3">{{ formatDate(rx.createdAt) }}</td>
              <td class="px-4 py-3">
                <span class="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full">{{ rx.status }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div
          v-if="rxDetail"
          class="p-4 border-t border-slate-100 bg-purple-50/50 space-y-3"
        >
          <h4 class="font-semibold text-slate-800">Dispensar — paciente {{ rxDetail.patientId }}</h4>
          <ul class="text-sm space-y-1">
            <li v-for="l in rxDetail.lines" :key="l.productId">
              {{ l.code }} {{ l.name }} — {{ l.doseQty }}
              <span v-if="l.isControlado" class="text-red-600 text-xs">(controlado)</span>
            </li>
          </ul>
          <input
            v-if="rxDetail.lines.some((l) => l.isControlado)"
            v-model="validatorCedula"
            type="text"
            placeholder="Cédula segundo validador"
            class="w-full p-2 border rounded text-sm"
          />
          <button
            type="button"
            class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50"
            :disabled="dispensing"
            @click="dispenseRx"
          >
            {{ dispensing ? 'Dispensando...' : 'Confirmar dispensación' }}
          </button>
        </div>
      </div>

      <div v-else class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div v-if="!log.length" class="p-12 text-center text-slate-400">
          La bitácora de doble validación aparecerá al dispensar controlados.
        </div>
        <ul v-else class="divide-y divide-slate-100">
          <li v-for="(entry, i) in log" :key="i" class="px-4 py-3 text-sm">
            <div class="flex justify-between gap-4">
              <span class="font-medium text-slate-800">{{ entry.productName }}</span>
              <span class="text-slate-400 shrink-0">{{ formatDate(entry.validatedAt) }}</span>
            </div>
            <p class="text-slate-500 mt-0.5">
              Validado por {{ entry.validatorName }}
              <span v-if="entry.notes"> — {{ entry.notes }}</span>
            </p>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
