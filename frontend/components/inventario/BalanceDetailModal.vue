<script setup lang="ts">
import type { InventoryBalanceRow } from '~/types/inventory'
import { formatCop, formatDateLatAm, formatQty } from '~/utils/locale-format'

const open = defineModel<boolean>('open', { default: false })

defineProps<{
  row: InventoryBalanceRow | null
}>()

const policyLabels: Record<string, string> = {
  FIFO: 'FIFO (primero en entrar)',
  FEFO: 'FEFO (primero en vencer)',
}

function yesNo(v: boolean | undefined | null) {
  if (v == null) return '—'
  return v ? 'Sí' : 'No'
}

type DetailField = {
  label: string
  value: string
  mono?: boolean
  warn?: boolean
  /** Ocupa el ancho completo del grid de la sección */
  full?: boolean
}

type DetailSection = {
  title: string
  fields: DetailField[]
}

function detailSections(row: InventoryBalanceRow): DetailSection[] {
  return [
    {
      title: 'Producto',
      fields: [
        { label: 'Código', value: row.productCode, mono: true },
        { label: 'Unidad base', value: row.unit },
        { label: 'Nombre', value: row.productName, full: true },
        { label: 'Descripción', value: row.productDescription?.trim() || '—', full: true },
      ],
    },
    {
      title: 'Bodega y ubicación',
      fields: [
        { label: 'Bodega', value: `${row.warehouseName} (${row.warehouseCode})` },
        { label: 'Tipo', value: row.warehouseType ?? '—' },
        {
          label: 'Política bodega',
          value: policyLabels[row.warehousePolicy ?? ''] ?? row.warehousePolicy ?? '—',
        },
        {
          label: 'Ubicación',
          value: row.locationCode
            ? `${row.locationCode}${row.locationName ? ` — ${row.locationName}` : ''}`
            : '—',
          mono: true,
        },
      ],
    },
    {
      title: 'Lote',
      fields: [
        { label: 'Número de lote', value: row.lotNumber ?? '—', mono: true },
        { label: 'Vencimiento', value: formatDateLatAm(row.expiresAt) },
        { label: 'Código interno', value: row.lotInternalBarcode ?? '—', mono: true },
      ],
    },
    {
      title: 'Existencias',
      fields: [
        { label: 'Cantidad', value: `${formatQty(row.qty)} ${row.unit}` },
        { label: 'Stock mínimo', value: `${formatQty(row.minStock)} ${row.unit}` },
        {
          label: 'Estado',
          value: row.lowStock ? 'Bajo mínimo' : 'Normal',
          warn: row.lowStock,
        },
      ],
    },
    {
      title: 'Valores',
      fields: [
        { label: 'Valor unitario', value: formatCop(row.unitPrice) },
        { label: 'Valor inventario', value: formatCop(row.lineValue) },
      ],
    },
    {
      title: 'Atributos',
      fields: [
        { label: 'Catálogo farmacia', value: yesNo(row.isFarmacia) },
        { label: 'Requiere lote', value: yesNo(row.requiresLot) },
        { label: 'Controlado', value: yesNo(row.isControlado) },
        {
          label: 'Política producto',
          value: policyLabels[row.productPolicy ?? ''] ?? row.productPolicy ?? '—',
        },
      ],
    },
  ]
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && row"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50"
      @click.self="open = false"
    >
      <div
        class="bg-white rounded-xl shadow-xl w-full max-w-4xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="balance-detail-title"
      >
        <div class="px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <h3 id="balance-detail-title" class="font-bold text-slate-900 text-lg">
            Detalle de saldo
          </h3>
          <p class="text-sm text-slate-600 mt-1">
            <span class="font-mono text-indigo-700">{{ row.productCode }}</span>
            <span class="mx-1.5 text-slate-300">·</span>
            <span>{{ row.productName }}</span>
          </p>
        </div>

        <div class="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          <section
            v-for="section in detailSections(row)"
            :key="section.title"
            class="rounded-lg border border-slate-100 overflow-hidden"
          >
            <h4 class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 px-3 py-2 border-b border-slate-100">
              {{ section.title }}
            </h4>
            <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 p-3">
              <div
                v-for="field in section.fields"
                :key="field.label"
                :class="field.full ? 'sm:col-span-2 lg:col-span-3' : ''"
              >
                <dt class="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                  {{ field.label }}
                </dt>
                <dd
                  class="mt-0.5 text-sm text-slate-800 break-words"
                  :class="[
                    field.mono ? 'font-mono text-xs' : '',
                    field.warn ? 'text-amber-800 font-semibold' : '',
                  ]"
                >
                  {{ field.value }}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <div class="px-6 py-4 border-t border-slate-100 flex justify-end shrink-0 bg-slate-50/50">
          <button
            type="button"
            class="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            @click="open = false"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
