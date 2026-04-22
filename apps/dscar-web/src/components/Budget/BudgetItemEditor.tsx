// apps/dscar-web/src/components/Budget/BudgetItemEditor.tsx
import { useState } from 'react';
import type { Budget, BudgetVersion } from '../../schemas/budgets';
import { useCreateBudgetItem } from '../../hooks/useBudget';
import { useOperationTypes, useLaborCategories } from '../../hooks/useReferenceData';
import { formatBRL } from '../../utils/format';
import { Plus } from 'lucide-react';

interface FormState {
  description: string;
  quantity: string;
  unit_price: string;
  operation_type_code: string;
  labor_category_code: string;
  hours: string;
  hourly_rate: string;
}

const INITIAL_FORM: FormState = {
  description: '',
  quantity: '1',
  unit_price: '',
  operation_type_code: 'TROCA',
  labor_category_code: 'FUNILARIA',
  hours: '1',
  hourly_rate: '40',
};

export function BudgetItemEditor({
  budget,
  version,
}: {
  budget: Budget;
  version: BudgetVersion;
}) {
  const readOnly = version.status !== 'draft';
  const create = useCreateBudgetItem();
  const { data: ops } = useOperationTypes();
  const { data: cats } = useLaborCategories();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const addItem = () => {
    const qty = parseFloat(form.quantity);
    const price = parseFloat(form.unit_price);
    if (Number.isNaN(qty) || Number.isNaN(price)) return;
    const netPrice = (qty * price).toFixed(2);

    create.mutate(
      {
        budgetId: budget.id,
        versionId: version.id,
        description: form.description,
        quantity: form.quantity,
        unit_price: form.unit_price,
        net_price: netPrice,
        item_type: 'PART',
        operations: [
          {
            operation_type_code: form.operation_type_code,
            labor_category_code: form.labor_category_code,
            hours: form.hours,
            hourly_rate: form.hourly_rate,
          },
        ],
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setForm(INITIAL_FORM);
        },
      },
    );
  };

  return (
    <div>
      {version.items.length === 0 ? (
        <p className="text-sm text-slate-500 py-4 text-center">
          Nenhum item adicionado ainda.
        </p>
      ) : (
        <div className="space-y-2 mb-4">
          {version.items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between items-start border-b border-slate-100 pb-2"
            >
              <div className="flex-1 min-w-0 pr-4">
                <div className="font-medium text-slate-800">{item.description}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {item.quantity} × {formatBRL(item.unit_price)}
                  {item.operations.map((op) => (
                    <span key={op.id} className="ml-2">
                      · {op.operation_type.label}/{op.labor_category.label}{' '}
                      {op.hours}h
                    </span>
                  ))}
                </div>
              </div>
              <div className="font-semibold text-slate-800 shrink-0">
                {formatBRL(item.net_price)}
              </div>
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 text-red-600 hover:text-red-800 font-medium transition-colors"
            >
              <Plus size={16} /> Adicionar item
            </button>
          ) : (
            <div className="border border-slate-200 rounded-md p-4 bg-slate-50 space-y-3">
              <input
                type="text"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Descrição (ex: AMORTECEDOR DIANT ESQ)"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Quantidade
                  </label>
                  <input
                    type="text"
                    value={form.quantity}
                    onChange={(e) => setField('quantity', e.target.value)}
                    placeholder="Ex: 1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Preço unitário (R$)
                  </label>
                  <input
                    type="text"
                    value={form.unit_price}
                    onChange={(e) => setField('unit_price', e.target.value)}
                    placeholder="Ex: 250.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Tipo de operação
                  </label>
                  <select
                    value={form.operation_type_code}
                    onChange={(e) => setField('operation_type_code', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-white"
                  >
                    {ops?.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Categoria de mão-de-obra
                  </label>
                  <select
                    value={form.labor_category_code}
                    onChange={(e) => setField('labor_category_code', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-white"
                  >
                    {cats?.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Horas MO
                  </label>
                  <input
                    type="text"
                    value={form.hours}
                    onChange={(e) => setField('hours', e.target.value)}
                    placeholder="Ex: 2"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Valor/hora (R$)
                  </label>
                  <input
                    type="text"
                    value={form.hourly_rate}
                    onChange={(e) => setField('hourly_rate', e.target.value)}
                    placeholder="Ex: 40"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setForm(INITIAL_FORM);
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={addItem}
                  disabled={create.isPending || !form.description.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {create.isPending ? 'Adicionando...' : 'Adicionar'}
                </button>
              </div>

              {create.error && (
                <div className="text-sm text-red-600">
                  {(create.error as Error).message}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
