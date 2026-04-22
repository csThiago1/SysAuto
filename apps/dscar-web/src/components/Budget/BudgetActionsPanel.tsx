// apps/dscar-web/src/components/Budget/BudgetActionsPanel.tsx
import { useState } from 'react';
import type { Budget, BudgetVersion } from '../../schemas/budgets';
import {
  useSendBudgetVersion,
  useApproveBudgetVersion,
  useRejectBudgetVersion,
  useReviseBudgetVersion,
} from '../../hooks/useBudget';
import { budgetPdfUrl } from '../../api/budgets';
import { Send, Check, X, RefreshCw, FileText } from 'lucide-react';

export function BudgetActionsPanel({
  budget,
  version,
}: {
  budget: Budget;
  version: BudgetVersion;
}) {
  const send = useSendBudgetVersion();
  const approve = useApproveBudgetVersion();
  const reject = useRejectBudgetVersion();
  const revise = useReviseBudgetVersion();
  const [approvedBy, setApprovedBy] = useState('');
  const [showApproveDialog, setShowApproveDialog] = useState(false);

  const canSend = version.status === 'draft';
  const canAct = version.status === 'sent';

  const mutationError =
    send.error ?? approve.error ?? reject.error ?? revise.error;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-wrap gap-2">
      {canSend && (
        <button
          onClick={() =>
            send.mutate({ budgetId: budget.id, versionId: version.id })
          }
          disabled={send.isPending}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Send size={16} />
          {send.isPending ? 'Enviando...' : 'Enviar ao cliente'}
        </button>
      )}

      {canAct && (
        <>
          <button
            onClick={() => setShowApproveDialog(true)}
            className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
          >
            <Check size={16} /> Aprovar
          </button>
          <button
            onClick={() =>
              reject.mutate({ budgetId: budget.id, versionId: version.id })
            }
            disabled={reject.isPending}
            className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            <X size={16} />
            {reject.isPending ? 'Rejeitando...' : 'Rejeitar'}
          </button>
          <button
            onClick={() =>
              revise.mutate({ budgetId: budget.id, versionId: version.id })
            }
            disabled={revise.isPending}
            className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={16} />
            {revise.isPending ? 'Enviando revisão...' : 'Revisão'}
          </button>
        </>
      )}

      {version.pdf_s3_key && (
        <a
          href={budgetPdfUrl(budget.id, version.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-md hover:bg-slate-800 transition-colors"
        >
          <FileText size={16} /> Ver PDF
        </a>
      )}

      {mutationError && (
        <div className="w-full mt-2 text-sm text-red-600">
          {(mutationError as Error).message}
        </div>
      )}

      {showApproveDialog && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowApproveDialog(false)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4 text-slate-800">
              Aprovar orçamento
            </h3>
            <p className="text-sm text-slate-600 mb-3">
              Como foi aprovado pelo cliente?
            </p>
            <input
              type="text"
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
              placeholder="Ex: WhatsApp, presencial, e-mail..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md mb-4 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowApproveDialog(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  approve.mutate({
                    budgetId: budget.id,
                    versionId: version.id,
                    approved_by: approvedBy.trim() || 'não informado',
                  });
                  setShowApproveDialog(false);
                }}
                disabled={approve.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {approve.isPending ? 'Aprovando...' : 'Confirmar aprovação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
