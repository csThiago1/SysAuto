// apps/dscar-web/src/components/ServiceOrderV2/OSTimeline.tsx
import { useOSEvents } from '../../hooks/useOSEvents';
import { formatDateTime } from '../../utils/format';
import {
  ArrowRight,
  FileText,
  Zap,
  Plus,
  Minus,
  Edit,
  Download,
  MessageSquare,
  Image,
  DollarSign,
  Receipt,
  PenTool,
  Link as LinkIcon,
} from 'lucide-react';
import type { EventType } from '../../schemas/serviceOrders';

const EVENT_ICONS: Record<EventType, typeof ArrowRight> = {
  STATUS_CHANGE: ArrowRight,
  AUTO_TRANSITION: Zap,
  VERSION_CREATED: Plus,
  VERSION_APPROVED: FileText,
  VERSION_REJECTED: Minus,
  ITEM_ADDED: Plus,
  ITEM_REMOVED: Minus,
  ITEM_EDITED: Edit,
  IMPORT_RECEIVED: Download,
  PARECER_ADDED: MessageSquare,
  PHOTO_UPLOADED: Image,
  PHOTO_REMOVED: Image,
  PAYMENT_RECORDED: DollarSign,
  FISCAL_ISSUED: Receipt,
  SIGNATURE_CAPTURED: PenTool,
  BUDGET_LINKED: LinkIcon,
};

export function OSTimeline({ osId }: { osId: number }) {
  const { data, isLoading, error } = useOSEvents(osId);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-12 bg-slate-200 rounded" />
        <div className="h-12 bg-slate-200 rounded" />
      </div>
    );
  }
  if (error) return <div className="text-red-600">Erro: {(error as Error).message}</div>;
  if (!data || data.count === 0) {
    return <div className="text-slate-500">Nenhum evento registrado.</div>;
  }

  return (
    <div className="space-y-2">
      {data.results.map((ev) => {
        const Icon = EVENT_ICONS[ev.event_type];
        return (
          <div key={ev.id} className="flex gap-3 p-3 bg-white border border-slate-200 rounded">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Icon size={16} className="text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <div className="font-medium text-slate-800">{ev.event_type_display}</div>
                <div className="text-xs text-slate-500">{formatDateTime(ev.created_at)}</div>
              </div>
              <div className="text-sm text-slate-600">
                Por <span className="font-medium">{ev.actor}</span>
                {ev.from_state && ev.to_state && (
                  <>
                    {' '}
                    &middot;{' '}
                    <span className="font-mono">{ev.from_state}</span>
                    {' '}
                    &rarr;{' '}
                    <span className="font-mono">{ev.to_state}</span>
                  </>
                )}
              </div>
              {Object.keys(ev.payload).length > 0 && (
                <details className="mt-1 text-xs">
                  <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                    detalhes
                  </summary>
                  <pre className="mt-1 bg-slate-50 p-2 rounded text-xs overflow-x-auto">
                    {JSON.stringify(ev.payload, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
