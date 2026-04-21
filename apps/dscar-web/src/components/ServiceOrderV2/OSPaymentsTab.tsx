// apps/dscar-web/src/components/ServiceOrderV2/OSPaymentsTab.tsx
import { useState } from 'react';
import { usePayments, useRecordPayment } from '../../hooks/usePayments';
import { formatBRL, formatDateTime } from '../../utils/format';

export function OSPaymentsTab({ osId }: { osId: number }) {
  const { data, isLoading, error } = usePayments(osId);
  const record = useRecordPayment();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    payer_block: 'PARTICULAR',
    amount: '',
    method: 'PIX',
    reference: '',
  });

  const submit = () => {
    record.mutate(
      { serviceOrderId: osId, ...form },
      {
        onSuccess: () => {
          setShowForm(false);
          setForm({ payer_block: 'PARTICULAR', amount: '', method: 'PIX', reference: '' });
        },
      },
    );
  };

  if (isLoading) {
    return <div className="animate-pulse h-24 bg-slate-200 rounded" />;
  }
  if (error) {
    return <div className="text-red-600">Erro: {(error as Error).message}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Pagamentos registrados</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          + Registrar pagamento
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.payer_block}
              onChange={(e) => setForm({ ...form, payer_block: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded"
            >
              <option value="PARTICULAR">Particular</option>
              <option value="SEGURADORA">Seguradora</option>
              <option value="COMPLEMENTO_PARTICULAR">Complemento Particular</option>
              <option value="FRANQUIA">Franquia</option>
            </select>
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded"
            >
              <option value="PIX">Pix</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="CARTAO">Cartao</option>
              <option value="BOLETO">Boleto</option>
              <option value="TRANSFERENCIA">Transferencia</option>
            </select>
          </div>
          <input
            type="text"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="Valor (ex: 1000.50)"
            className="w-full px-3 py-2 border border-slate-300 rounded"
          />
          <input
            type="text"
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            placeholder="Referencia (opcional)"
            className="w-full px-3 py-2 border border-slate-300 rounded"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={record.isPending || !form.amount}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {record.isPending ? 'Registrando...' : 'Registrar'}
            </button>
          </div>
          {record.error && (
            <div className="text-sm text-red-600">{(record.error as Error).message}</div>
          )}
        </div>
      )}

      {!data || data.count === 0 ? (
        <div className="text-slate-500 text-center py-8">Nenhum pagamento registrado.</div>
      ) : (
        <div className="space-y-2">
          {data.results.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-slate-200 rounded p-3 flex justify-between items-center"
            >
              <div>
                <div className="font-medium">
                  {p.method_display} &middot; {p.payer_block_display}
                </div>
                <div className="text-xs text-slate-500">
                  {formatDateTime(p.received_at)}
                  {p.reference && ` · ${p.reference}`}
                </div>
              </div>
              <div className="text-lg font-bold text-green-600">{formatBRL(p.amount)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
