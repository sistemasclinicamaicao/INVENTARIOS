<script setup lang="ts">
import type { PoLineFulfillment, ReceptionLine, ReceptionLineAction } from '~/types/reception'

export type { ReceptionLine }

const props = defineProps<{
  lines: ReceptionLine[]
  isFarmaciaWarehouse?: boolean
}>()

const emit = defineEmits<{
  'update:lines': [lines: ReceptionLine[]]
  printSticker: [lineId: string]
}>()

const fulfillmentLabels: Record<PoLineFulfillment, string> = {
  PENDING: 'Pendiente',
  PARTIAL: 'Parcial',
  COMPLETE: 'Completo',
  SURPLUS: 'Excedente',
  NOT_ARRIVED: 'No llegó (hist.)',
}

const fulfillmentClasses: Record<PoLineFulfillment, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  PARTIAL: 'bg-amber-100 text-amber-800',
  COMPLETE: 'bg-green-100 text-green-800',
  SURPLUS: 'bg-red-100 text-red-800',
  NOT_ARRIVED: 'bg-slate-200 text-slate-500 line-through',
}

function isCompleteLine(line: ReceptionLine) {
  if (line.lineAction === 'complete') return true
  return line.fulfillmentStatus === 'COMPLETE' || line.fulfillmentStatus === 'SURPLUS'
}

function pendingQty(line: ReceptionLine) {
  return Math.max(0, line.qtyErp - (line.qtyAlreadyReceived ?? 0))
}

function patchLine(id: string, patch: Partial<ReceptionLine>) {
  emit(
    'update:lines',
    props.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
  )
}

function updateLine(id: string, field: keyof ReceptionLine, value: string | number) {
  patchLine(id, { [field]: value } as Partial<ReceptionLine>)
}

function setLineAction(line: ReceptionLine, action: ReceptionLineAction) {
  if (action === 'receive') {
    const switching = line.lineAction !== 'receive'
    patchLine(line.id, {
      lineAction: 'receive',
      qtyReceived: switching ? pendingQty(line) : line.qtyReceived,
    })
    return
  }
  if (action === 'not_arrived') {
    patchLine(line.id, { lineAction: 'not_arrived', qtyReceived: 0, lotNumber: '', expiresAt: '' })
    return
  }
  patchLine(line.id, { lineAction: 'defer', qtyReceived: 0 })
}

function lotClasses(line: ReceptionLine) {
  const needsLot =
    props.isFarmaciaWarehouse && line.requiresLot && line.lineAction === 'receive'
  const empty = needsLot && !line.lotNumber?.trim()
  return empty ? 'border-red-300 bg-red-50' : 'border-slate-300'
}

function expiryClasses(line: ReceptionLine) {
  const needsLot =
    props.isFarmaciaWarehouse && line.requiresLot && line.lineAction === 'receive'
  const empty = needsLot && !line.expiresAt?.trim()
  return empty ? 'border-red-300 bg-red-50' : 'border-slate-300'
}

function rowClasses(line: ReceptionLine) {
  if (isCompleteLine(line)) return 'bg-green-50/50'
  if (line.fulfillmentStatus === 'PARTIAL') return 'bg-amber-50/50'
  if (line.lineAction === 'not_arrived') return 'bg-slate-50 opacity-75'
  if (line.lineAction === 'receive') return 'bg-green-50/40'
  return 'bg-white'
}

function fulfillmentBadge(status?: PoLineFulfillment) {
  const s = status ?? 'PENDING'
  return { label: fulfillmentLabels[s], cls: fulfillmentClasses[s] }
}

function isReceiveDisabled(line: ReceptionLine) {
  return line.lineAction === 'not_arrived'
}
</script>

<template>
  <h3 class="text-base font-semibold text-slate-800 mb-2 border-b pb-1.5">
    Detalles de Recepción
  </h3>
  <p class="text-[11px] text-slate-500 mb-2">
    Pulse <strong>Recibir</strong> en cada artículo que llegó en este despacho, ajuste la cantidad y complete lote si aplica.
    Los demás quedan en <strong>Pendiente</strong> hasta otra entrega.
  </p>
  <div class="overflow-x-auto">
    <table class="w-full text-sm text-left">
      <thead class="text-xs text-slate-500 bg-slate-100">
        <tr>
          <th class="px-2 py-2 w-24 text-center">Acción</th>
          <th class="px-2 py-2">Código / Producto</th>
          <th class="px-2 py-2 w-16 text-center">CXC</th>
          <th class="px-2 py-2 w-16 text-center">Rec.</th>
          <th class="px-2 py-2 w-20 text-center">Estado</th>
          <th class="px-2 py-2 w-20 text-right">V. unit.</th>
          <th class="px-2 py-2 w-24">Cant. recibir</th>
          <th v-if="isFarmaciaWarehouse" class="px-2 py-2">Lote</th>
          <th v-if="isFarmaciaWarehouse" class="px-2 py-2">Vence</th>
          <th v-if="isFarmaciaWarehouse" class="px-2 py-2 text-center w-10" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="line in lines" :key="line.id" class="border-b" :class="rowClasses(line)">
          <td class="px-2 py-2">
            <div v-if="isCompleteLine(line)" class="flex items-center justify-center">
              <span class="text-[10px] text-green-700 font-medium">Recibido</span>
            </div>
            <div v-else class="flex items-center justify-center gap-1">
              <button
                type="button"
                class="p-1.5 rounded border transition"
                :class="
                  line.lineAction === 'receive'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-green-700 border-green-300 hover:bg-green-50'
                "
                :title="`Recibir (pendiente ${pendingQty(line)})`"
                @click="setLineAction(line, 'receive')"
              >
                <UiIcon name="check-circle" :size="16" />
              </button>
              <button
                type="button"
                class="p-1.5 rounded border transition"
                :class="
                  line.lineAction === 'not_arrived'
                    ? 'bg-slate-600 text-white border-slate-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                "
                title="No llegó en este despacho (sigue pendiente en la OC)"
                @click="setLineAction(line, 'not_arrived')"
              >
                <UiIcon name="triangle-warning" :size="16" />
              </button>
              <button
                type="button"
                class="p-1 rounded text-[10px] text-slate-400 hover:text-slate-600 underline"
                title="Pendiente para otra entrega"
                @click="setLineAction(line, 'defer')"
              >
                ···
              </button>
            </div>
          </td>
          <td class="px-2 py-2">
            <p class="font-medium text-slate-800 text-xs">{{ line.code }} — {{ line.name }}</p>
            <p class="text-[10px] text-slate-500">{{ line.presentation }}</p>
          </td>
          <td class="px-2 py-2 text-center font-medium tabular-nums text-xs">{{ line.qtyErp }}</td>
          <td class="px-2 py-2 text-center text-slate-600 tabular-nums text-xs">
            <span>{{ line.qtyAlreadyReceived ?? 0 }}</span>
            <span v-if="line.fulfillmentStatus === 'PARTIAL'" class="text-amber-700">
              / {{ line.qtyErp }}
            </span>
          </td>
          <td class="px-2 py-2 text-center">
            <span
              class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
              :class="fulfillmentBadge(line.fulfillmentStatus).cls"
            >
              {{ fulfillmentBadge(line.fulfillmentStatus).label }}
            </span>
          </td>
          <td class="px-2 py-2 text-right text-slate-600 tabular-nums text-xs">
            {{ line.unitPrice != null ? Number(line.unitPrice).toLocaleString('es-CO') : '—' }}
          </td>
          <td class="px-2 py-2">
            <span v-if="isCompleteLine(line)" class="block text-center text-xs text-slate-400">—</span>
            <input
              v-else
              type="number"
              :value="line.qtyReceived"
              min="0"
              :max="pendingQty(line)"
              :disabled="isReceiveDisabled(line) || line.lineAction !== 'receive'"
              class="w-full p-1 border rounded text-center text-xs focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
              :class="line.lineAction === 'receive' ? 'border-blue-400' : 'border-slate-200'"
              @input="updateLine(line.id, 'qtyReceived', Number(($event.target as HTMLInputElement).value))"
            />
          </td>
          <td v-if="isFarmaciaWarehouse" class="px-2 py-2">
            <input
              v-if="line.requiresLot && line.lineAction === 'receive'"
              type="text"
              :value="line.lotNumber"
              placeholder="Lote"
              class="w-full p-1 border rounded text-xs uppercase focus:ring-2 focus:ring-blue-500"
              :class="lotClasses(line)"
              @input="updateLine(line.id, 'lotNumber', ($event.target as HTMLInputElement).value)"
            />
            <span v-else class="text-[10px] text-slate-400">—</span>
          </td>
          <td v-if="isFarmaciaWarehouse" class="px-2 py-2">
            <input
              v-if="line.requiresLot && line.lineAction === 'receive'"
              type="date"
              :value="line.expiresAt"
              class="w-full p-1 border rounded text-xs focus:ring-2 focus:ring-blue-500"
              :class="expiryClasses(line)"
              @input="updateLine(line.id, 'expiresAt', ($event.target as HTMLInputElement).value)"
            />
            <span v-else class="text-[10px] text-slate-400">—</span>
          </td>
          <td v-if="isFarmaciaWarehouse" class="px-2 py-2 text-center">
            <button
              v-if="line.lineAction === 'receive'"
              type="button"
              class="text-slate-400 hover:text-blue-600 p-1"
              title="Imprimir Sticker"
              @click="emit('printSticker', line.id)"
            >
              <UiIcon name="print" :size="16" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
