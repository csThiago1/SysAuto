// apps/dscar-web/src/components/Budget/BudgetDetail.tsx
import { useBudget } from '../../hooks/useBudget';
import { BudgetStatusBadge } from './BudgetStatusBadge';
import { BudgetActionsPanel } from './BudgetActionsPanel';
import { BudgetItemEditor } from './BudgetItemEditor';
import { formatBRL, formatDate, formatDateTime } from '../../utils/format';

export function BudgetDetail({ budgetId }: { budgetId: number }) {
  const { data: budget, isLoading, error } = useBudget(budgetId);

  if (isLoading) {
    return (
      <div className="p-6 animate-pulse max-w-6xl mx-auto">
        <div className="h-8 bg-slate-200 rounded w-64 mb-2" />
        <div className="h-5 bg-slate-200 rounded w-96 mb-6" />
        <div className="h-14 bg-slate-200 rounded mb-4" />
        <div className="h-32 bg-slate-200 rounded mb-4" />
        <div className="h-24 bg-slate-200 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-600">
        Erro ao carregar orçamento: {(error as Error).message}
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="p-6 text-slate-500 text-center py-12">
        Orçamento não encontrado.
      </div>
    );
  }

  const v = budget.active_version;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{budget.number}</h1>
          <p className="text-slate-600 mt-1">
            {budget.customer_name} · {budget.vehicle_description} ·{' '}
            <span className="font-mono">{budget.vehicle_plate}</span>
          </p>
          {v && (
            <div className="mt-2 flex items-center gap-2">
              <BudgetStatusBadge status={v.status} />
              <span className="text-sm text-slate-500">
                v{v.version_number} · criado em {formatDateTime(v.created_at)}
              </span>
            </div>
          )}
        </div>
      </div>

      {v ? (
        <>
          {/* Actions */}
          <BudgetActionsPanel budget={budget} version={v} />

          {/* Items */}
          <div className="mt-6 bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-lg font-semibold mb-4 text-slate-800">Itens</h2>
            <BudgetItemEditor budget={budget} version={v} />
          </div>

          {/* Totals */}
          <div className="mt-6 bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-slate-500">Peças</div>
                <div className="font-semibold text-slate-800">
                  {formatBRL(v.parts_total)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Mão-de-obra</div>
                <div className="font-semibold text-slate-800">
                  {formatBRL(v.labor_total)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Desconto</div>
                <div className="font-semibold text-slate-800">
                  − {formatBRL(v.discount_total)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Validade</div>
                <div className="font-semibold text-slate-800">
                  {formatDate(v.valid_until)}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-300 flex justify-between items-center">
              <span className="text-slate-600 font-medium">Total</span>
              <span className="text-2xl font-bold text-red-600">
                {formatBRL(v.net_total)}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-6 text-center py-8 text-slate-500">
          Este orçamento não possui versão ativa.
        </div>
      )}
    </div>
  );
}
