export interface DashboardStats {
  pendingRequisitions: number
  deliveriesToday: number
  lowStock: number
  expiringSoon: number
}

export interface ExpiryAlertApi {
  id: string
  productName: string
  lotNumber: string
  daysUntilExpiry: number
  expiresAt: string
  qty: number
  unit: string
  severity: 'critical' | 'warning'
}

export interface ExpiryAlertView {
  id: string
  productName: string
  lotNumber: string
  daysLabel: string
  expiresAt: string
  qty: string
  severity: 'critical' | 'warning'
}

export interface RequisitionRow {
  id: string
  destination: string
  priority: 'ALTA' | 'MEDIA' | 'NORMAL'
}

export interface UserHeader {
  fullName: string
  roleLabel: string
  initials: string
  notificationCount: number
}
