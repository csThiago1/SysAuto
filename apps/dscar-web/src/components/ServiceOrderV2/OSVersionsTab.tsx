// apps/dscar-web/src/components/ServiceOrderV2/OSVersionsTab.tsx
import type { ServiceOrderVersion } from '../../schemas/serviceOrders';
import { useApproveVersion } from '../../hooks/useServiceOrderV2';
import { formatBRL, formatDateTime } from '../../utils/format';

export function OSVersionsTab({
  osId,
  version,
}: {
  osId: number;
  version: ServiceOrderVersion | null;
}) {
  const approve = useApproveVersion();

  if (!version) {
    return <div className="text-slate-500">OS ainda sem versão ativa.</div>;
  }

  const needsApproval =
    version.status === 'em_analise' ||
    version.status === 'pending' ||
    version.status === 'analisado';

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="text-lg font-semibold text-slate-800">{version.status_label}</div>
            <div className="text-sm text-slate-500">
              Fonte: {version.source} &middot; criada em {formatDateTime(version.created_at)}
            </div>
          </div>
          {needsApproval && (
            <button
              onClick={() =>
                approve.mutate({ serviceOrderId: osId, versionId: version.id })
              }
              disabled={approve.isPending}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {approve.isPending ? 'Aprovando...' : 'Aprovar versão'}
            </button>
          )}
        </div>
        {approve.error && (
          <div className="mt-2 text-sm text-red-600">{(approve.error as Error).message}</div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div>
            <div className="text-xs text-slate-500">Seguradora</div>
            <div className="font-semibold">{formatBRL(version.total_seguradora)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Complemento</div>
            <div className="font-semibold">{formatBRL(version.total_complemento_particular)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Franquia</div>
            <div className="font-semibold">{formatBRL(version.total_franquia)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Total</div>
            <div className="font-bold text-red-600">{formatBRL(version.net_total)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded p-4">
        <h3 className="font-semibold text-slate-800 mb-3">Itens da versão</h3>
        {version.items.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum item.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th className="text-left pb-2">Item</th>
                <th className="text-left pb-2">Bloco</th>
                <th className="text-right pb-2">Qtd</th>
                <th className="text-right pb-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {version.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2">
                    <div className="font-medium">{item.description}</div>
                    {item.external_code && (
                      <div className="text-xs text-slate-500 font-mono">{item.external_code}</div>
                    )}
                  </td>
                  <td className="py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs ${
                        item.payer_block === 'SEGURADORA'
                          ? 'bg-blue-100 text-blue-700'
                          : item.payer_block === 'COMPLEMENTO_PARTICULAR'
                          ? 'bg-purple-100 text-purple-700'
                          : item.payer_block === 'FRANQUIA'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {item.payer_block}
                    </span>
                  </td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right font-semibold">{formatBRL(item.net_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
