import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CalendarOS } from '@paddock/types';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function useCalendar(startDate: Date, endDate: Date) {
  const start = formatDateKey(startDate);
  const end = formatDateKey(endDate);

  return useQuery({
    queryKey: ['agenda', start, end] as const,
    queryFn: () =>
      api.get<CalendarOS[]>(
        `/service-orders/calendar?date_start=${start}&date_end=${end}`,
      ),
    staleTime: 60_000,
  });
}

export interface AgendaEvent {
  type: 'entry' | 'delivery';
  os: CalendarOS;
  datetime: Date | null;
  timeStr: string | null;
}

/** Converte CalendarOS[] em mapa YYYY-MM-DD → AgendaEvent[] */
export function buildAgendaEventsMap(
  items: CalendarOS[],
): Record<string, AgendaEvent[]> {
  const map: Record<string, AgendaEvent[]> = {};

  const push = (key: string, event: AgendaEvent) => {
    if (!map[key]) map[key] = [];
    map[key].push(event);
  };

  for (const os of items) {
    if (os.scheduling_date) {
      const dt = new Date(os.scheduling_date);
      const key = formatDateKey(dt);
      push(key, {
        type: 'entry',
        os,
        datetime: dt,
        timeStr: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
      });
    }

    if (os.delivery_date) {
      const dt = new Date(os.delivery_date);
      const key = formatDateKey(dt);
      push(key, {
        type: 'delivery',
        os,
        datetime: dt,
        timeStr: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
      });
    } else if (os.estimated_delivery_date) {
      const key = os.estimated_delivery_date.substring(0, 10);
      push(key, { type: 'delivery', os, datetime: null, timeStr: null });
    }
  }

  return map;
}
