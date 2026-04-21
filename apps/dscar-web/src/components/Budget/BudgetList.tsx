// apps/dscar-web/src/components/Budget/BudgetList.tsx
import { useState } from 'react';
import { useBudgets } from '../../hooks/useBudget';
import { BudgetStatusBadge } from './BudgetStatusBadge';
import { formatBRL, formatDate } from '../../utils/format';
import { Search, Plus } from 'lucide-react';

export function BudgetList({ onOpen }: { onOpen?: (id: number) => void }) {
  const [search, setSearch] = useState('');
  const { data, isLoading, error } = useBudgets({ search });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse h-8 bg-slate-200 rounded mb-4 w-48" />
        <div className="animate-pulse h-10 bg-slate-200 rounded mb-4" />
        <div className="animate-pulse h-8 bg-slate-200 rounded mb-2" />
        <div className="animate-pulse h-8 bg-slate-200 rounded mb-2" />
        <div className="animate-pulse h-8 bg-slate-200 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-600">
        Erro ao carregar orçamentos: {(error as Error).message}
      </div>
    );
  }

  const budgets = data?.results ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Orçamentos</h1>
        <button className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors">
          <Plus size={18} /> Novo Orçamento
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por número, placa, cliente..."
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
        />
      </div>

      {budgets.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          Nenhum orçamento encontrado.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Número</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Veículo</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Validade</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {budgets.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-sm">{b.number}</td>
                  <td className="px-4 py-3">{b.customer_name}</td>
                  <td className="px-4 py-3 text-sm">
                    <div>{b.vehicle_description}</div>
                    <div className="text-slate-500 font-mono">{b.vehicle_plate}</div>
                  </td>
                  <td className="px-4 py-3">
                    {b.active_version && (
                      <BudgetStatusBadge status={b.active_version.status} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {b.active_version ? formatBRL(b.active_version.net_total) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {formatDate(b.active_version?.valid_until ?? null)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                      onClick={() => onOpen?.(b.id)}
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
