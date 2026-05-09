import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverdueOS {
  id: string;
  number: number;
  plate: string;
  customer_name: string;
  estimated_delivery_date: string;
  days_overdue: number;
  status: string;
  status_display: string;
}

interface TeamMember {
  name: string;
  delivered_month: number;
  open_count: number;
}

interface BillingMonth {
  month: string;
  amount: string;
}

export interface ManagerStats {
  role: 'manager';
  total_open: number;
  by_status: Record<string, number>;
  scheduled_today: number;
  billing_month: string;
  delivered_month: number;
  avg_ticket: string;
  overdue_count: number;
  billing_by_type: { insurer: string; private: string };
  billing_last_6_months: BillingMonth[];
  team_productivity: TeamMember[];
  overdue_os: OverdueOS[];
}

interface RecentOS {
  id: string;
  number: number;
  plate: string;
  customer_name: string;
  status: string;
  status_display: string;
  days_in_shop: number;
}

interface NextDelivery {
  id: string;
  number: number;
  plate: string;
  customer_name: string;
  status: string;
  status_display: string;
  estimated_delivery_date: string;
}

export interface ConsultantStats {
  role: 'consultant';
  my_open: number;
  my_deliveries_today: number;
  my_overdue: number;
  my_completed_week: number;
  my_by_status: Record<string, number>;
  my_waiting_auth: number;
  my_waiting_parts: number;
  my_scheduled_today: number;
  my_next_deliveries: NextDelivery[];
  my_recent_os: RecentOS[];
}

interface TechnicianOS {
  id: string;
  number: number;
  plate: string;
  vehicle: string;
  status: string;
  status_display: string;
}

export interface TechnicianStats {
  role: 'technician';
  total_open: number;
  today_deliveries: number;
  my_open: number;
  my_deliveries_today: number;
  my_by_status: Record<string, number>;
  my_os: TechnicianOS[];
  my_next_os: { plate: string; status: string; status_display: string } | null;
  my_completed_month: number;
  my_avg_days: number;
}

export type DashboardStats = ManagerStats | ConsultantStats | TechnicianStats;

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isManager(stats: DashboardStats): stats is ManagerStats {
  return stats.role === 'manager';
}

export function isConsultant(stats: DashboardStats): stats is ConsultantStats {
  return stats.role === 'consultant';
}

export function isTechnician(stats: DashboardStats): stats is TechnicianStats {
  return stats.role === 'technician';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => api.get<DashboardStats>('/service-orders/dashboard/stats'),
    staleTime: 1000 * 60 * 2,
  });
}
