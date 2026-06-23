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

function lineLot(line: { lotNumber?: string | null; expiresAt?: string | null }) {
  if (!line.lotNumber) return ''
  const exp = line.expiresAt ? formatDateLatAm(line.expiresAt) : ''
  return exp ? `Lote:${line.lotNumber} Vence:${exp}` : `Lote:${line.lotNumber}`
}

function wrapText(text: string, maxLen = 32): string {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxLen) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word.length > maxLen ? word.slice(0, maxLen) : word
    }
  }
  if (current) lines.push(current)
  return lines.join('\n')
}

/** HTML autocontenido para impresora térmica 58 mm (sin escalar desde la página principal). */
function buildThermalPrintDocument(detail: ReceptionHistoryDetail): string {
  const linesHtml = detail.lines
    .map((line, idx) => {
      const lot = lineLot(line)
      const name = wrapText(line.productName, 32)
      return `
        <div class="item">
          <div class="row">${idx + 1}. ${escapeHtml(line.productCode)}</div>
          <div class="row small">${escapeHtml(name)}</div>
          <div class="row">Cant: ${escapeHtml(formatQty(line.qtyReceived))} ${escapeHtml(line.unit)}</div>
          ${lot ? `<div class="row small">${escapeHtml(lot)}</div>` : ''}
        </div>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Recibo ${escapeHtml(detail.number)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 58mm;
      max-width: 58mm;
      background: #fff;
      color: #000;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12pt;
      line-height: 1.45;
      font-weight: 600;
      padding: 2mm 1mm;
      -webkit-font-smoothing: none;
      -moz-osx-font-smoothing: unset;
      text-rendering: geometricPrecision;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .center { text-align: center; }
    .title { font-size: 13pt; font-weight: 700; letter-spacing: 0.5px; }
    .subtitle { font-size: 11pt; font-weight: 600; margin-bottom: 3mm; }
    .small { font-size: 10pt; font-weight: 600; }
    .row { margin: 0.8mm 0; word-break: break-word; }
    .sep {
      margin: 2.5mm 0;
      font-size: 10pt;
      letter-spacing: 1px;
      text-align: center;
      font-weight: 400;
    }
    .item {
      margin-bottom: 2.5mm;
      padding-bottom: 2mm;
    }
    .item + .item { border-top: 1px solid #000; padding-top: 2mm; }
    @page {
      size: 58mm auto;
      margin: 0;
    }
    @media print {
      html, body {
        width: 58mm;
        margin: 0;
        padding: 1mm;
      }
    }
  </style>
</head>
<body>
  <div class="center title">CLINICA ERP</div>
  <div class="center subtitle">Recepcion de mercancia</div>
  <div class="sep">------------------------------</div>
  <div class="row">Rec: ${escapeHtml(detail.number)}</div>
  <div class="row">Fecha: ${escapeHtml(formatDateTimeLatAm(detail.receivedAt))}</div>
  <div class="row">OC: ${escapeHtml(detail.ocNumber)}</div>
  <div class="row">Prov: ${escapeHtml(detail.supplierName)}</div>
  <div class="row">Bodega: ${escapeHtml(detail.warehouseCode)}</div>
  <div class="row">Recibio: ${escapeHtml(detail.receivedByName)}</div>
  ${detail.receivedByCedula ? `<div class="row small">CC: ${escapeHtml(detail.receivedByCedula)}</div>` : ''}
  <div class="sep">-------- ARTICULOS --------</div>
  ${linesHtml}
  <div class="sep">------------------------------</div>
  <div class="row">Total lineas: ${detail.lines.length}</div>
  <div class="center small" style="margin-top:3mm">Impreso: ${escapeHtml(printedAt.value)}</div>
  <script>
    window.onload = function () {
      setTimeout(function () {
        window.focus();
        window.print();
      }, 250);
    };
    window.onafterprint = function () { window.close(); };
  <\/script>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function doPrint() {
  if (!props.detail) return
  const html = buildThermalPrintDocument(props.detail)
  const win = window.open('', '_blank', 'width=280,height=720,noopener')
  if (!win) {
    alert('Permita ventanas emergentes para imprimir el recibo.')
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && detail"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40"
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
          <div class="thermal-receipt-preview">
            <p class="center title">CLÍNICA ERP</p>
            <p class="center subtitle">Recepción de mercancía</p>
            <p class="sep">------------------------------</p>
            <p>Rec: {{ detail.number }}</p>
            <p>Fecha: {{ formatDateTimeLatAm(detail.receivedAt) }}</p>
            <p>OC: {{ detail.ocNumber }}</p>
            <p class="wrap">Prov: {{ detail.supplierName }}</p>
            <p>Bodega: {{ detail.warehouseCode }}</p>
            <p>Recibió: {{ detail.receivedByName }}</p>
            <p v-if="detail.receivedByCedula" class="small">CC: {{ detail.receivedByCedula }}</p>
            <p class="sep">-------- ARTÍCULOS --------</p>
            <div v-for="(line, idx) in detail.lines" :key="line.id" class="item">
              <p>{{ idx + 1 }}. {{ line.productCode }}</p>
              <p class="small wrap">{{ line.productName }}</p>
              <p>Cant: {{ formatQty(line.qtyReceived) }} {{ line.unit }}</p>
              <p v-if="lineLot(line)" class="small">{{ lineLot(line) }}</p>
            </div>
            <p class="sep">------------------------------</p>
            <p>Total líneas: {{ detail.lines.length }}</p>
            <p class="center small">Impreso: {{ printedAt }}</p>
          </div>
        </div>
        <div class="px-4 py-3 border-t border-slate-200 space-y-2">
          <p class="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            En el diálogo de impresión: <strong>Escala 100%</strong>, márgenes <strong>Ninguno</strong> o
            <strong>Mínimos</strong>, y seleccione su impresora térmica 58 mm.
          </p>
          <div class="flex justify-end gap-2">
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
    </div>
  </Teleport>
</template>

<style scoped>
.thermal-receipt-preview {
  width: 58mm;
  max-width: 58mm;
  background: #fff;
  border: 1px solid #cbd5e1;
  padding: 3mm 2mm;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.45;
  color: #000;
}

.thermal-receipt-preview .center {
  text-align: center;
}

.thermal-receipt-preview .title {
  font-size: 13px;
  font-weight: 700;
}

.thermal-receipt-preview .subtitle {
  font-size: 11px;
  margin-bottom: 6px;
}

.thermal-receipt-preview .small {
  font-size: 10px;
}

.thermal-receipt-preview .wrap {
  word-break: break-word;
}

.thermal-receipt-preview .sep {
  text-align: center;
  font-size: 10px;
  margin: 6px 0;
  letter-spacing: 1px;
}

.thermal-receipt-preview .item {
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid #e2e8f0;
}

.thermal-receipt-preview .item:last-of-type {
  border-bottom: none;
}
</style>
