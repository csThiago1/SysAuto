// ── Legacy (compatibilidade) ───────────────────────────────────────────────────
export interface DashboardStats {
  total_open: number
  by_status: Record<string, number>
  today_deliveries: number
}

// ── Consultor ─────────────────────────────────────────────────────────────────
export interface RecentOSItem {
  id: string
  number: number
  plate: string
  customer_name: string
  status: string
  status_display: string
  days_in_shop: number
}

export interface ConsultantDashboardStats {
  role: "consultant"
  my_open: number
  my_deliveries_today: number
  my_overdue: number
  my_completed_week: number
  my_recent_os: RecentOSItem[]
}

// ── Gerente / Admin / Diretoria ───────────────────────────────────────────────
export interface OverdueOSItem {
  id: string
  number: number
  plate: string
  customer_name: string
  estimated_delivery_date: string
  days_overdue: number
  status: string
  status_display: string
}

export interface TeamMember {
  name: string
  delivered_month: number
  open_count: number
}

export interface BillingMonthPoint {
  month: string  // ex: "abr/26"
  amount: string
}

export interface ManagerDashboardStats {
  role: "manager"
  billing_month: string
  delivered_month: number
  avg_ticket: string
  overdue_count: number
  billing_by_type: { insurer: string; private: string }
  billing_last_6_months: BillingMonthPoint[]
  team_productivity: TeamMember[]
  overdue_os: OverdueOSItem[]
}

export type AnyDashboardStats = DashboardStats | ConsultantDashboardStats | ManagerDashboardStats
