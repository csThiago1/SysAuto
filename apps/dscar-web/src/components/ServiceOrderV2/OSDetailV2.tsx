// apps/dscar-web/src/components/ServiceOrderV2/OSDetailV2.tsx
import { useState } from 'react';
import { useServiceOrderV2 } from '../../hooks/useServiceOrderV2';
import { OSTimeline } from './OSTimeline';
import { OSVersionsTab } from './OSVersionsTab';
import { OSPaymentsTab } from './OSPaymentsTab';
import { OSComplementForm } from './OSComplementForm';
import { formatBRL } from '../../utils/format';

type Tab = 'versions' | 'timeline' | 'payments' | 'complement';

export function OSDetailV2({ osId }: { osId: number }) {
  const { data: os, isLoading, error } = useServiceOrderV2(osId);
  const [tab, setTab] = useState<Tab>('versions');

  if (isLoading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-64 mb-4" />
        <div className="h-48 bg-slate-200 rounded" />
      </div>
    );
  }
  if (error) return <div className="p-6 text-red-600">Erro: {(error as Error).message}</div>;
  if (!os) return <div className="p-6">OS não encontrada.</div>;

  const v = os.active_version;
  const isSeguradora = os.customer_type === 'SEGURADORA';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{os.os_number}</h1>
          <p className="text-slate-600">
            {os.customer_name} · {os.vehicle_description} ·{' '}
            <span className="font-mono">{os.vehicle_plate}</span>
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                isSeguradora ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
              }`}
            >
              {os.customer_type}
            </span>
            {isSeguradora && (
              <span className="text-sm text-slate-500">
                {os.insurer_name} · Sinistro {os.casualty_number}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-500">Status Kanban</div>
          <div className="text-lg font-semibold">{os.status_display}</div>
          {v && <div className="text-xl font-bold text-red-600 mt-1">{formatBRL(v.net_total)}</div>}
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 mb-4">
        {(['versions', 'timeline', 'payments', 'complement'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              tab === t
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            {t === 'versions'
              ? 'Versoes'
              : t === 'timeline'
              ? 'Timeline'
              : t === 'payments'
              ? 'Pagamentos'
              : 'Complemento'}
          </button>
        ))}
      </div>

      {tab === 'versions' && <OSVersionsTab osId={osId} version={v} />}
      {tab === 'timeline' && <OSTimeline osId={osId} />}
      {tab === 'payments' && <OSPaymentsTab osId={osId} />}
      {tab === 'complement' && isSeguradora && <OSComplementForm osId={osId} />}
      {tab === 'complement' && !isSeguradora && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
          Complemento particular so se aplica a OS de seguradora.
        </div>
      )}
    </div>
  );
}
