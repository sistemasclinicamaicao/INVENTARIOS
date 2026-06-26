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

function lineLotRowsHtml(line: { lotNumber?: string | null; expiresAt?: string | null }): string {
  if (!line.lotNumber) return ''
  let html = `<tr class="lot-row"><td colspan="3">Lote: ${escapeHtml(line.lotNumber)}</td></tr>`
  if (line.expiresAt) {
    html += `<tr class="lot-row item-end"><td colspan="3">Vence: ${escapeHtml(formatDateLatAm(line.expiresAt))}</td></tr>`
  } else {
    html = html.replace('class="lot-row"', 'class="lot-row item-end"')
  }
  return html
}

function formatLineQty(line: { qtyReceived: number; unit: string }): string {
  return formatQty(line.qtyReceived)
}

function buildItemRowsHtml(line: {
  productCode: string
  productName: string
  qtyReceived: number
  unit: string
  lotNumber?: string | null
  expiresAt?: string | null
}): string {
  const lot = lineLotRowsHtml(line)
  const endClass = lot ? '' : ' item-end'
  return `<tr class="item-row${endClass}">
    <td class="col-item">${escapeHtml(line.productCode)}</td>
    <td class="col-desc">${escapeHtml(line.productName)}</td>
    <td class="col-qty">${escapeHtml(formatLineQty(line))}</td>
  </tr>${lot}`
}

/** HTML autocontenido para impresora térmica 58 mm. */
function buildThermalPrintDocument(detail: ReceptionHistoryDetail): string {
  const linesHtml = detail.lines.map((line) => buildItemRowsHtml(line)).join('')

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
      font-size: 11pt;
      line-height: 1.4;
      font-weight: 600;
      padding: 2mm 6mm 2mm 2mm;
      overflow-x: hidden;
      -webkit-font-smoothing: none;
      -moz-osx-font-smoothing: unset;
      text-rendering: geometricPrecision;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .receipt {
      width: 48mm;
      max-width: 48mm;
    }
    .center { text-align: center; }
    .title { font-size: 12pt; font-weight: 700; letter-spacing: 0.3px; }
    .subtitle { font-size: 10pt; font-weight: 600; margin-bottom: 2.5mm; }
    .small { font-size: 9pt; font-weight: 600; white-space: pre-wrap; }
    .row { margin: 0.6mm 0; word-break: break-word; }
    .items-table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      margin-top: 1mm;
    }
    .items-table col.w-item { width: 11mm; }
    .items-table col.w-desc { width: auto; }
    .items-table col.w-qty { width: 7mm; }
    .items-table th,
    .items-table td {
      vertical-align: top;
      padding: 0.4mm 0.5mm 0.4mm 0;
    }
    .items-table td.col-desc,
    .items-table th:not(.r):not(:first-child) {
      word-break: break-word;
    }
    .items-table thead th {
      font-size: 7pt;
      font-weight: 700;
      border-bottom: 1px solid #000;
      padding-bottom: 1mm;
    }
    .items-table thead th:first-child {
      white-space: nowrap;
    }
    .items-table .col-item {
      font-size: 7pt;
      font-weight: 700;
      white-space: nowrap;
      word-break: keep-all;
      overflow: hidden;
      line-height: 1.2;
    }
    .items-table .col-desc {
      font-size: 7pt;
      font-weight: 600;
      line-height: 1.25;
    }
    .items-table .col-qty,
    .items-table th.r {
      text-align: right;
      font-size: 8pt;
      font-weight: 700;
      white-space: nowrap;
      padding-right: 0;
    }
    .items-table tr.lot-row td {
      font-size: 9pt;
      font-weight: 600;
      line-height: 1.3;
      padding: 0.2mm 0 0.3mm 0;
      white-space: nowrap;
    }
    .items-table tr.item-end td {
      border-bottom: 1px dotted #000;
      padding-bottom: 1.2mm;
    }
    .sep {
      margin: 2mm 0;
      font-size: 9pt;
      text-align: center;
      font-weight: 400;
    }
    @page {
      size: 58mm auto;
      margin: 0;
    }
    @media print {
      html {
        -webkit-text-size-adjust: 100%;
        text-size-adjust: 100%;
      }
      html, body {
        width: 58mm;
        margin: 0;
        padding: 1.5mm 6mm 1.5mm 2mm;
        overflow-x: hidden;
      }
      .receipt {
        width: 48mm;
        max-width: 48mm;
      }
      .items-table col.w-item { width: 11mm; }
      .items-table col.w-qty { width: 7mm; }
      .items-table .col-item {
        font-size: 7pt;
        white-space: nowrap;
        word-break: keep-all;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
  <div class="center title">CLINICA ERP</div>
  <div class="center subtitle">Recepcion de mercancia</div>
  <div class="sep">------------------------</div>
  <div class="row">Rec: ${escapeHtml(detail.number)}</div>
  <div class="row">Fecha: ${escapeHtml(formatDateTimeLatAm(detail.receivedAt))}</div>
  <div class="row">OC: ${escapeHtml(detail.ocNumber)}</div>
  <div class="row">Prov: ${escapeHtml(detail.supplierName)}</div>
  <div class="row">Bodega: ${escapeHtml(detail.warehouseCode)}</div>
  <div class="row">Recibio: ${escapeHtml(detail.receivedByName)}</div>
  ${detail.receivedByCedula ? `<div class="row small">CC: ${escapeHtml(detail.receivedByCedula)}</div>` : ''}
  <div class="sep">------ ARTICULOS ------</div>
  <table class="items-table">
    <colgroup>
      <col class="w-item" />
      <col class="w-desc" />
      <col class="w-qty" />
    </colgroup>
    <thead>
      <tr>
        <th>ITEM</th>
        <th>DESCRIP</th>
        <th class="r">Cant</th>
      </tr>
    </thead>
    <tbody>${linesHtml}</tbody>
  </table>
  <div class="sep">------------------------</div>
  <div class="row">Total lineas: ${detail.lines.length}</div>
  <div class="center small" style="margin-top:2.5mm">Impreso: ${escapeHtml(printedAt.value)}</div>
  </div>
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
  const iframe = document.createElement('iframe')
  iframe.setAttribute(
    'style',
    'position:fixed;left:0;top:0;width:0;height:0;border:0;visibility:hidden',
  )
  iframe.setAttribute('title', 'Impresión recibo térmico')
  document.body.appendChild(iframe)

  const frameWindow = iframe.contentWindow
  const frameDoc = frameWindow?.document
  if (!frameWindow || !frameDoc) {
    iframe.remove()
    alert('No se pudo preparar la impresión. Intente de nuevo.')
    return
  }

  frameDoc.open()
  frameDoc.write(html)
  frameDoc.close()

  const triggerPrint = () => {
    try {
      frameWindow.focus()
      frameWindow.print()
    } finally {
      window.setTimeout(() => iframe.remove(), 1500)
    }
  }

  if (frameDoc.readyState === 'complete') {
    window.setTimeout(triggerPrint, 200)
  } else {
    iframe.onload = () => window.setTimeout(triggerPrint, 200)
  }
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
            <div class="receipt-inner">
            <p class="center title">CLÍNICA ERP</p>
            <p class="center subtitle">Recepción de mercancía</p>
            <p class="sep">------------------------</p>
            <p>Rec: {{ detail.number }}</p>
            <p>Fecha: {{ formatDateTimeLatAm(detail.receivedAt) }}</p>
            <p>OC: {{ detail.ocNumber }}</p>
            <p class="wrap">Prov: {{ detail.supplierName }}</p>
            <p>Bodega: {{ detail.warehouseCode }}</p>
            <p>Recibió: {{ detail.receivedByName }}</p>
            <p v-if="detail.receivedByCedula" class="small">CC: {{ detail.receivedByCedula }}</p>
            <p class="sep">------ ARTÍCULOS ------</p>
            <table class="items-table">
              <colgroup>
                <col class="w-item" />
                <col class="w-desc" />
                <col class="w-qty" />
              </colgroup>
              <thead>
                <tr>
                  <th>ITEM</th>
                  <th>DESCRIP</th>
                  <th class="r">Cant</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="line in detail.lines" :key="line.id">
                  <tr class="item-row" :class="{ 'item-end': !line.lotNumber }">
                    <td class="col-item">{{ line.productCode }}</td>
                    <td class="col-desc">{{ line.productName }}</td>
                    <td class="col-qty">{{ formatLineQty(line) }}</td>
                  </tr>
                  <tr v-if="line.lotNumber" class="lot-row" :class="{ 'item-end': !line.expiresAt }">
                    <td colspan="3">Lote: {{ line.lotNumber }}</td>
                  </tr>
                  <tr v-if="line.expiresAt" class="lot-row item-end">
                    <td colspan="3">Vence: {{ formatDateLatAm(line.expiresAt) }}</td>
                  </tr>
                </template>
              </tbody>
            </table>
            <p class="sep">------------------------</p>
            <p>Total líneas: {{ detail.lines.length }}</p>
            <p class="center small">Impreso: {{ printedAt }}</p>
            </div>
          </div>
        </div>
        <div class="px-4 py-3 border-t border-slate-200 space-y-2">
          <p class="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Se abrirá el diálogo de impresión directamente (sin ventana en blanco). Use
            <strong>Escala 100%</strong>, márgenes <strong>Ninguno</strong> o <strong>Mínimos</strong>,
            y seleccione su impresora térmica 58 mm.
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
  padding: 3mm 6mm 3mm 2mm;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  color: #000;
  overflow-x: hidden;
}

.thermal-receipt-preview .receipt-inner {
  width: 48mm;
  max-width: 48mm;
}

.thermal-receipt-preview .center {
  text-align: center;
}

.thermal-receipt-preview .title {
  font-size: 12px;
  font-weight: 700;
}

.thermal-receipt-preview .subtitle {
  font-size: 10px;
  margin-bottom: 6px;
}

.thermal-receipt-preview .small {
  font-size: 9px;
}

.thermal-receipt-preview .items-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  margin-top: 4px;
}

.thermal-receipt-preview .items-table col.w-item {
  width: 11mm;
}

.thermal-receipt-preview .items-table col.w-desc {
  width: auto;
}

.thermal-receipt-preview .items-table col.w-qty {
  width: 7mm;
}

.thermal-receipt-preview .items-table th,
.thermal-receipt-preview .items-table td {
  vertical-align: top;
  padding: 2px 2px 2px 0;
}

.thermal-receipt-preview .items-table td.col-desc {
  word-break: break-word;
}

.thermal-receipt-preview .items-table thead th {
  font-size: 7px;
  font-weight: 700;
  border-bottom: 1px solid #000;
  padding-bottom: 2px;
}

.thermal-receipt-preview .items-table thead th:first-child {
  white-space: nowrap;
}

.thermal-receipt-preview .items-table .col-item {
  font-size: 7px;
  font-weight: 700;
  white-space: nowrap;
  word-break: keep-all;
  overflow: hidden;
  line-height: 1.2;
}

.thermal-receipt-preview .items-table .col-desc {
  font-size: 7px;
  font-weight: 600;
  line-height: 1.25;
}

.thermal-receipt-preview .items-table .col-qty,
.thermal-receipt-preview .items-table th.r {
  text-align: right;
  font-size: 8px;
  font-weight: 700;
  white-space: nowrap;
  padding-right: 0;
}

.thermal-receipt-preview .items-table tr.lot-row td {
  font-size: 9px;
  font-weight: 600;
  line-height: 1.3;
  padding: 1px 0 2px 0;
  white-space: nowrap;
}

.thermal-receipt-preview .items-table tr.item-end td {
  border-bottom: 1px dotted #cbd5e1;
  padding-bottom: 4px;
}

.thermal-receipt-preview .wrap {
  word-break: break-word;
}

.thermal-receipt-preview .sep {
  text-align: center;
  font-size: 9px;
  margin: 6px 0;
}
</style>
