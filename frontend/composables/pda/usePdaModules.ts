import type { FlaticonIconName } from '~/utils/flaticon-icons'

export type PdaModule = {
  id: string
  to: string
  label: string
  description: string
  icon: FlaticonIconName
  permission: string
}

const ALL_MODULES: PdaModule[] = [
  {
    id: 'recepcion',
    to: '/pda/recepcion',
    label: 'Recepción rápida',
    description: 'Escanear OC y confirmar ingreso',
    icon: 'barcode',
    permission: 'reception.manage',
  },
  {
    id: 'picking',
    to: '/pda/picking',
    label: 'Picking / despacho',
    description: 'Preparar requisición y generar traslado',
    icon: 'arrow-up',
    permission: 'picking.manage',
  },
  {
    id: 'traslado',
    to: '/pda/traslado',
    label: 'Recibir traslado',
    description: 'Confirmar TRF en bodega satélite',
    icon: 'truck-side',
    permission: 'picking.manage',
  },
  {
    id: 'conteo',
    to: '/pda/conteo',
    label: 'Inventario cíclico',
    description: 'Conteo y ajuste por escaneo',
    icon: 'clipboard-list',
    permission: 'inventory.view',
  },
  {
    id: 'inventario',
    to: '/pda/inventario',
    label: 'Consulta inventario',
    description: 'Saldos por producto y bodega',
    icon: 'database',
    permission: 'inventory.view',
  },
  {
    id: 'farmacia',
    to: '/pda/farmacia',
    label: 'Farmacia dispensar',
    description: 'Prescripciones pendientes HIS',
    icon: 'pills',
    permission: 'pharmacy.dispense',
  },
]

export function usePdaModules() {
  const session = useSessionStore()
  const modules = computed(() =>
    ALL_MODULES.filter((m) => session.can(m.permission)),
  )
  return { modules, allModules: ALL_MODULES }
}
