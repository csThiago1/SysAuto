// apps/dscar-web/src/components/ServiceOrderV2/OSDetailV2.tsx
import { useState } from 'react';
import { PenLine } from 'lucide-react';
import { useServiceOrderV2 } from '../../hooks/useServiceOrderV2';
import { OSTimeline } from './OSTimeline';
import { OSVersionsTab } from './OSVersionsTab';
import { OSPaymentsTab } from './OSPaymentsTab';
import { OSComplementForm } from './OSComplementForm';
import { SignatureCaptureDialog } from '../Signature/SignatureCaptureDialog';
import { formatBRL } from '../../utils/format';
import type { SignatureDocumentType } from '../../schemas/signatures';

type Tab = 'versions' | 'timeline' | 'payments' | 'complement';

const SIG_OPTIONS: Array<{ type: SignatureDocumentType; label: string }> = [
  { type: 'OS_OPEN', label: 'Recepção do Veículo' },
  { type: 'OS_DELIVERY', label: 'Entrega do Veículo' },
  { type: 'COMPLEMENT_APPROVAL', label: 'Aprovação de Complemento' },
  { type: 'INSURANCE_ACCEPTANCE', label: 'Aceite da Seguradora' },
];

export function OSDetailV2({ osId }: { osId: number }) {
  const { data: os, isLoading, error } = useServiceOrderV2(osId);
  const [tab, setTab] = useState<Tab>('versions');
  const [signatureOpt, setSignatureOpt] = useState<SignatureDocumentType | null>(null);
  const [sigMenuOpen, setSigMenuOpen] = useState(false);

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

          <div className="relative mt-3">
            <button
              onClick={() => setSigMenuOpen((s) => !s)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white text-sm rounded hover:bg-slate-800"
            >
              <PenLine size={14} />
              Capturar assinatura
            </button>
            {sigMenuOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded shadow-lg z-10">
                {SIG_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => {
                      setSignatureOpt(opt.type);
                      setSigMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {signatureOpt && (
        <SignatureCaptureDialog
          documentType={signatureOpt}
          documentTypeLabel={
            SIG_OPTIONS.find((o) => o.type === signatureOpt)?.label ?? signatureOpt
          }
          serviceOrderId={osId}
          onClose={() => setSignatureOpt(null)}
        />
      )}

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
              ? 'Versões'
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
          Complemento particular só se aplica a OS de seguradora.
        </div>
      )}
    </div>
  );
}
