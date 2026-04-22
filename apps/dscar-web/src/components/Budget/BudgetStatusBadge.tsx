// apps/dscar-web/src/components/Budget/BudgetStatusBadge.tsx
import type { BudgetVersionStatus } from '../../schemas/budgets';
import { clsx } from 'clsx';

const STATUS_STYLES: Record<BudgetVersionStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  expired: 'bg-amber-100 text-amber-700 border-amber-200',
  revision: 'bg-purple-100 text-purple-700 border-purple-200',
  superseded: 'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_LABELS: Record<BudgetVersionStatus, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  expired: 'Expirado',
  revision: 'Em Revisão',
  superseded: 'Superado',
};

export function BudgetStatusBadge({ status }: { status: BudgetVersionStatus }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
