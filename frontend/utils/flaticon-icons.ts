/**
 * Flaticon Uicons — Regular Rounded (fi-rr-*)
 * @see https://www.flaticon.es/uicons
 * @see https://www.flaticon.es/icon-fonts-mas-descargados
 */
export const FLATICON_ICONS = {
  home: 'home',
  search: 'search',
  bell: 'bell',
  settings: 'settings',
  apps: 'apps',
  box: 'box',
  'box-alt': 'box-alt',
  pills: 'pills',
  medicine: 'medicine',
  'arrow-down': 'arrow-down',
  'arrow-up': 'arrow-up',
  document: 'document',
  upload: 'upload',
  plus: 'plus',
  trash: 'trash',
  check: 'check',
  'check-circle': 'check-circle',
  barcode: 'barcode',
  marker: 'marker',
  clipboard: 'clipboard',
  'clipboard-list': 'clipboard-list',
  shield: 'shield',
  'shield-check': 'shield-check',
  database: 'database',
  'truck-side': 'truck-side',
  'triangle-warning': 'triangle-warning',
  print: 'print',
  truck: 'truck-side',
  user: 'user',
  users: 'users',
} as const

export type FlaticonIconName = keyof typeof FLATICON_ICONS
