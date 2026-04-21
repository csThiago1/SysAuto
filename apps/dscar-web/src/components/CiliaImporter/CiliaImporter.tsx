import { useState } from 'react';
import { AlertCircle, CheckCircle, Download, XCircle } from 'lucide-react';
import { useFetchCilia, useImportAttempts } from '../../hooks/useImports';
import { formatDateTime } from '../../utils/format';
import { XmlIfxUploader } from './XmlIfxUploader';

type Props = {
  onOpenServiceOrder?: (osId: number) => void;
};

export function CiliaImporter({ onOpenServiceOrder }: Props) {
  const [form, setForm] = useState({
    casualty_number: '',
    budget_number: '',
    version_number: '',
  });
  const fetch = useFetchCilia();
  const attempts = useImportAttempts({
    casualty_number: form.casualty_number || undefined,
  });

  const submit = () => {
    fetch.mutate({
      casualty_number: form.casualty_number,
      budget_number: form.budget_number,
      version_number: form.version_number ? parseInt(form.version_number, 10) : null,
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Central de Importações</h1>

      <XmlIfxUploader onOpenServiceOrder={onOpenServiceOrder} />

      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">
          Importar via API Cilia
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Busca uma versão específica. Nova versão → nova ServiceOrderVersion
          (ou OS nova se sinistro ainda não existir).
        </p>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Nº do sinistro</label>
            <input
              type="text"
              value={form.casualty_number}
              onChange={(e) => setForm({ ...form, casualty_number: e.target.value })}
              placeholder="ex: 406571903"
              className="w-full px-3 py-2 border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Nº do orçamento</label>
            <input
              type="text"
              value={form.budget_number}
              onChange={(e) => setForm({ ...form, budget_number: e.target.value })}
              placeholder="ex: 1446508"
              className="w-full px-3 py-2 border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Versão (opcional)</label>
            <input
              type="text"
              value={form.version_number}
              onChange={(e) => setForm({ ...form, version_number: e.target.value })}
              placeholder="vazio = atual"
              className="w-full px-3 py-2 border border-slate-300 rounded"
            />
          </div>
        </div>
        <button
          onClick={submit}
          disabled={fetch.isPending || !form.casualty_number || !form.budget_number}
          className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
        >
          <Download size={16} />
          {fetch.isPending ? 'Buscando…' : 'Buscar orçamento'}
        </button>
        {fetch.error && (
          <div className="mt-3 text-sm text-red-600">
            Erro: {(fetch.error as Error).message}
          </div>
        )}
        {fetch.data && fetch.data.parsed_ok && (
          <div className="mt-3 text-sm text-green-700">
            Orçamento importado! OS #{fetch.data.service_order}, versão #
            {fetch.data.version_created}.
            {onOpenServiceOrder && fetch.data.service_order && (
              <button
                onClick={() => onOpenServiceOrder(fetch.data!.service_order!)}
                className="ml-2 underline text-green-700 hover:text-green-900"
              >
                Abrir OS →
              </button>
            )}
          </div>
        )}
      </div>

      <h2 className="text-lg font-semibold text-slate-800 mb-3">Histórico de importações</h2>

      {attempts.isLoading ? (
        <div className="animate-pulse h-24 bg-slate-200 rounded" />
      ) : attempts.isError ? (
        <div className="text-red-600">
          Erro ao carregar histórico: {(attempts.error as Error).message}
        </div>
      ) : !attempts.data?.count ? (
        <div className="text-slate-500 text-center py-8">Nenhuma tentativa registrada.</div>
      ) : (
        <div className="space-y-2">
          {attempts.data.results.map((a) => (
            <div
              key={a.id}
              className="bg-white border border-slate-200 rounded p-3 flex items-start gap-3"
            >
              <div className="mt-1 flex-shrink-0">
                {a.parsed_ok ? (
                  <CheckCircle className="text-green-600" size={20} />
                ) : a.http_status === 404 ? (
                  <AlertCircle className="text-amber-500" size={20} />
                ) : (
                  <XCircle className="text-red-500" size={20} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <div className="font-medium text-slate-800">
                    Sinistro {a.casualty_number} · Orçamento {a.budget_number}
                    {a.version_number !== null && <span> v{a.version_number}</span>}
                  </div>
                  <div className="text-xs text-slate-500 flex-shrink-0">
                    {formatDateTime(a.created_at)}
                  </div>
                </div>
                <div className="text-sm text-slate-600">
                  {a.trigger_display} · {a.source_display} · HTTP {a.http_status ?? '—'}
                  {a.duration_ms !== null && <> · {a.duration_ms}ms</>}
                </div>
                {a.error_message && (
                  <div className="text-xs text-red-600 mt-1">
                    {a.error_type}: {a.error_message}
                  </div>
                )}
                {a.version_created !== null && (
                  <button
                    onClick={() =>
                      a.service_order !== null &&
                      onOpenServiceOrder?.(a.service_order)
                    }
                    className="text-xs text-green-700 hover:text-green-900 mt-1 underline"
                  >
                    ✓ Versão #{a.version_created} criada (abrir OS)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
