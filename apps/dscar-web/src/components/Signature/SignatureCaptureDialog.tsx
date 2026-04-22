import { useState } from 'react';
import { X } from 'lucide-react';
import { useCaptureSignature } from '../../hooks/useSignatures';
import type { SignatureDocumentType, SignatureMethod } from '../../schemas/signatures';
import { SignatureCanvas } from './SignatureCanvas';

type Props = {
  documentType: SignatureDocumentType;
  documentTypeLabel: string;
  serviceOrderId?: number;
  budgetId?: number;
  onClose: () => void;
  onCaptured?: (signatureId: number) => void;
};

/**
 * Dialog modal pra capturar assinatura via canvas.
 * Pode ser usado nos fluxos OS_OPEN, OS_DELIVERY, BUDGET_APPROVAL, etc.
 */
export function SignatureCaptureDialog({
  documentType,
  documentTypeLabel,
  serviceOrderId,
  budgetId,
  onClose,
  onCaptured,
}: Props) {
  const [signerName, setSignerName] = useState('');
  const [signerCpf, setSignerCpf] = useState('');
  const [pngBase64, setPngBase64] = useState<string | null>(null);
  const [method, setMethod] = useState<SignatureMethod>('CANVAS_TABLET');

  const capture = useCaptureSignature();

  const submit = () => {
    if (!signerName || !pngBase64) return;
    capture.mutate(
      {
        document_type: documentType,
        method,
        signer_name: signerName,
        signature_png_base64: pngBase64,
        service_order_id: serviceOrderId ?? null,
        budget_id: budgetId ?? null,
        signer_cpf: signerCpf,
      },
      {
        onSuccess: (data) => {
          onCaptured?.(data.id);
          onClose();
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Capturar assinatura
            </h2>
            <p className="text-sm text-slate-500">{documentTypeLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nome do assinante</label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full px-3 py-2 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">CPF (opcional)</label>
              <input
                type="text"
                value={signerCpf}
                onChange={(e) => setSignerCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full px-3 py-2 border border-slate-300 rounded"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Método de captura</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as SignatureMethod)}
              className="w-full px-3 py-2 border border-slate-300 rounded"
            >
              <option value="CANVAS_TABLET">Canvas em Tablet</option>
              <option value="REMOTE_LINK">Link Remoto</option>
              <option value="SCAN_PDF">Scan de PDF</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Assinatura</label>
            <SignatureCanvas onReady={setPngBase64} />
          </div>

          {capture.error && (
            <div className="text-sm text-red-600">
              Erro: {(capture.error as Error).message}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={!signerName || !pngBase64 || capture.isPending}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {capture.isPending ? 'Salvando…' : 'Confirmar assinatura'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
