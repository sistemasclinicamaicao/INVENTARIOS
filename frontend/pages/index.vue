<script setup lang="ts">
import type {
  DashboardStats,
  ExpiryAlertApi,
  ExpiryAlertView,
  RequisitionRow,
} from '~/types/dashboard'

definePageMeta({ layout: 'app' })

const { fetchApi } = useApi()

const loading = ref(true)
const error = ref<string | null>(null)

const stats = ref<DashboardStats>({
  pendingRequisitions: 0,
  deliveriesToday: 0,
  lowStock: 0,
  expiringSoon: 0,
})
const expiryAlerts = ref<ExpiryAlertView[]>([])
const requisitions = ref<RequisitionRow[]>([])

function mapAlert(a: ExpiryAlertApi): ExpiryAlertView {
  const [y, m, d] = a.expiresAt.split('-')
  return {
    id: a.id,
    productName: a.productName,
    lotNumber: a.lotNumber,
    daysLabel: `${a.daysUntilExpiry} Días`,
    expiresAt: d && m && y ? `${d}/${m}/${y}` : a.expiresAt,
    qty: `${a.qty} ${a.unit}`,
    severity: a.severity,
  }
}

async function loadDashboard() {
  loading.value = true
  error.value = null

  const [statsRes, alertsRes, reqsRes] = await Promise.all([
    fetchApi<DashboardStats>('/dashboard/stats'),
    fetchApi<ExpiryAlertApi[]>('/dashboard/expiry-alerts'),
    fetchApi<RequisitionRow[]>('/dashboard/requisitions'),
  ])

  if (statsRes.error) error.value = statsRes.error
  else if (statsRes.data) stats.value = statsRes.data

  if (alertsRes.data) expiryAlerts.value = alertsRes.data.map(mapAlert)
  if (reqsRes.data) requisitions.value = reqsRes.data

  loading.value = false
}

const isEmpty = computed(
  () =>
    !loading.value
    && !error.value
    && stats.value.pendingRequisitions === 0
    && stats.value.deliveriesToday === 0
    && stats.value.lowStock === 0
    && stats.value.expiringSoon === 0
    && !expiryAlerts.value.length
    && !requisitions.value.length,
)

onMounted(() => loadDashboard())
</script>

<template>
  <div class="space-y-6">
    <div v-if="loading" class="text-center py-12 text-slate-500">Cargando panel...</div>

    <div
      v-else-if="error"
      class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
    >
      {{ error }}. Verifique que la API esté activa.
    </div>

    <template v-else>
      <div
        v-if="isEmpty"
        class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900"
      >
        No hay datos operativos aún.
        <NuxtLink to="/maestros" class="font-semibold underline ml-1">Cargue su información real</NuxtLink>
        (importar CSV o registrar productos). Si aún ve Epinefrina / REQ-1042, ejecute
        <code class="bg-blue-100 px-1 rounded">limpiar-demo.bat</code>.
      </div>

      <DashboardKpiCards
        :pending-requisitions="stats.pendingRequisitions"
        :deliveries-today="stats.deliveriesToday"
        :low-stock="stats.lowStock"
        :expiring-soon="stats.expiringSoon"
      />
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardExpiryAlerts :alerts="expiryAlerts" />
        <DashboardRequisitionsTable :requisitions="requisitions" />
      </div>
    </template>
  </div>
</template>
