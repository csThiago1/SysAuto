import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface NotificationFeedItem {
  id: string;
  os_id: string;
  os_number: number;
  os_plate: string;
  os_make: string;
  os_model: string;
  os_customer_name: string;
  from_status: string;
  from_status_display: string;
  to_status: string;
  to_status_display: string;
  triggered_by_field: string;
  changed_by_name: string;
  created_at: string;
}

export function useNotificationFeed() {
  return useQuery({
    queryKey: ['notifications', 'feed'] as const,
    queryFn: () =>
      api.get<NotificationFeedItem[]>('/service-orders/notifications'),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
