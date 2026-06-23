<script setup lang="ts">
import type { ReceptionHistoryDetail } from '~/types/reception-history'
import { formatDateLatAm, formatDateTimeLatAm, formatQty } from '~/utils/locale-format'

const props = defineProps<{
  open: boolean
  detail: ReceptionHistoryDetail | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const printedAt = computed(() => formatDateTimeLatAm(new Date().toISOString()))

function close() {
  emit('update:open', false)
}

function doPrint() {
  window.print()
}

function lineLot(line: { lotNumber?: string | null; expiresAt?: string | null }) {
  if (!line.lotNumber) return ''
  const exp = line.expiresAt ? formatDateLatAm(line.expiresAt) : ''
  return exp ? `L:${line.lotNumber} V:${exp}` : `L:${line.lotNumber}`
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && detail"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 print:hidden"
      @click.self="close"
    >
      <div class="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div class="px-4 py-3 border-b border-slate-200 flex justify-between items-center">
          <h3 class="font-semibold text-slate-800">Vista previa — Recibo 58 mm</h3>
          <button type="button" class="text-slate-400 hover:text-slate-600 text-xl leading-none" @click="close">
            ×
          </button>
        </div>
        <div class="p-4 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
          <div class="thermal-receipt-preview bg-white shadow border border-slate-200 p-3 text-[11px] font-mono leading-snug text-black w-[58mm]">
            <p class="text-center font-bold text-xs">CLÍNICA ERP</p>
            <p class="text-center text-[10px] mb-2">Recepción de mercancía</p>
            <p class="border-t border-dashed border-black pt-1 mt-1">Rec: {{ detail.number }}</p>
            <p>Fecha: {{ formatDateTimeLatAm(detail.receivedAt) }}</p>
            <p>OC: {{ detail.ocNumber }}</p>
            <p class="break-words">Prov: {{ detail.supplierName }}</p>
            <p>Bodega: {{ detail.warehouseCode }}</p>
            <p>Recibió: {{ detail.receivedByName }}</p>
            <p v-if="detail.receivedByCedula" class="text-[10px]">CC: {{ detail.receivedByCedula }}</p>
            <p class="border-t border-dashed border-black my-2 pt-1 font-bold">ARTÍCULOS</p>
            <div
              v-for="(line, idx) in detail.lines"
              :key="line.id"
              class="mb-2 border-b border-dotted border-slate-300 pb-1"
            >
              <p>{{ idx + 1 }}. {{ line.productCode }}</p>
              <p class="text-[10px] break-words">{{ line.productName.slice(0, 42) }}</p>
              <p>Cant: {{ formatQty(line.qtyReceived) }} {{ line.unit }}</p>
              <p v-if="lineLot(line)" class="text-[10px]">{{ lineLot(line) }}</p>
            </div>
            <p class="border-t border-dashed border-black pt-1 mt-2">
              Total líneas: {{ detail.lines.length }}
            </p>
            <p class="text-[10px] text-center mt-2">Impreso: {{ printedAt }}</p>
          </div>
        </div>
        <div class="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            class="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600"
            @click="close"
          >
            Cerrar
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
            @click="doPrint"
          >
            Imprimir recibo
          </button>
        </div>
      </div>
    </div>

    <div v-if="open && detail" id="thermal-receipt-print" class="hidden print:block">
      <div class="thermal-receipt-print">
        <p class="center bold">CLÍNICA ERP</p>
        <p class="center small">Recepción de mercancía</p>
        <p class="dash">Rec: {{ detail.number }}</p>
        <p>Fecha: {{ formatDateTimeLatAm(detail.receivedAt) }}</p>
        <p>OC: {{ detail.ocNumber }}</p>
        <p>Prov: {{ detail.supplierName }}</p>
        <p>Bodega: {{ detail.warehouseCode }}</p>
        <p>Recibió: {{ detail.receivedByName }}</p>
        <p v-if="detail.receivedByCedula" class="small">CC: {{ detail.receivedByCedula }}</p>
        <p class="dash bold">ARTÍCULOS</p>
        <div v-for="(line, idx) in detail.lines" :key="line.id" class="item">
          <p>{{ idx + 1 }}. {{ line.productCode }}</p>
          <p class="small wrap">{{ line.productName }}</p>
          <p>Cant: {{ formatQty(line.qtyReceived) }} {{ line.unit }}</p>
          <p v-if="lineLot(line)" class="small">{{ lineLot(line) }}</p>
        </div>
        <p class="dash">Total líneas: {{ detail.lines.length }}</p>
        <p class="center small">Impreso: {{ printedAt }}</p>
      </div>
    </div>
  </Teleport>
</template>

<style>
@media print {
  @page {
    size: 58mm auto;
    margin: 2mm;
  }

  body * {
    visibility: hidden;
  }

  #thermal-receipt-print,
  #thermal-receipt-print * {
    visibility: visible;
  }

  #thermal-receipt-print {
    position: absolute;
    left: 0;
    top: 0;
    width: 58mm;
  }

  .thermal-receipt-print {
    font-family: 'Courier New', Courier, monospace;
    font-size: 10px;
    line-height: 1.35;
    color: #000;
    width: 54mm;
  }

  .thermal-receipt-print .center {
    text-align: center;
  }

  .thermal-receipt-print .bold {
    font-weight: bold;
  }

  .thermal-receipt-print .small {
    font-size: 9px;
  }

  .thermal-receipt-print .wrap {
    word-break: break-word;
  }

  .thermal-receipt-print .dash {
    border-top: 1px dashed #000;
    margin: 4px 0;
    padding-top: 4px;
  }

  .thermal-receipt-print .item {
    margin-bottom: 6px;
    padding-bottom: 4px;
    border-bottom: 1px dotted #999;
  }
}
</style>
