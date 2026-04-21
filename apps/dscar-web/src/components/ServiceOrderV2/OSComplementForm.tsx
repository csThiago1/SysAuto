// apps/dscar-web/src/components/ServiceOrderV2/OSComplementForm.tsx
import { useState } from 'react';
import { useAddComplement } from '../../hooks/useServiceOrderV2';
import { Plus, Trash2 } from 'lucide-react';
import { formatBRL } from '../../utils/format';

interface ComplementItemDraft {
  description: string;
  quantity: string;
  unit_price: string;
  item_type: string;
}

export function OSComplementForm({ osId }: { osId: number }) {
  const add = useAddComplement();
  const [items, setItems] = useState<ComplementItemDraft[]>([]);
  const [newItem, setNewItem] = useState<ComplementItemDraft>({
    description: '',
    quantity: '1',
    unit_price: '',
    item_type: 'SERVICE',
  });

  const total = items.reduce(
    (sum, i) => sum + parseFloat(i.quantity || '0') * parseFloat(i.unit_price || '0'),
    0,
  );

  const addItemToList = () => {
    if (newItem.description && newItem.unit_price) {
      setItems([...items, newItem]);
      setNewItem({ description: '', quantity: '1', unit_price: '', item_type: 'SERVICE' });
    }
  };

  const submit = () => {
    const payload = items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit_price: i.unit_price,
      net_price: (parseFloat(i.quantity) * parseFloat(i.unit_price)).toFixed(2),
      item_type: i.item_type,
    }));
    add.mutate(
      { id: osId, items: payload, approvedBy: 'cliente' },
      {
        onSuccess: () => setItems([]),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
        O complemento adiciona itens cobrados do cliente (fora da cobertura da seguradora),
        criando nova versao da OS.
      </div>

      <div className="bg-white border border-slate-200 rounded p-4 space-y-3">
        <h3 className="font-semibold">Adicionar item de complemento</h3>
        <input
          type="text"
          value={newItem.description}
          onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
          placeholder="Descricao (ex: Pintura extra em roda)"
          className="w-full px-3 py-2 border border-slate-300 rounded"
        />
        <div className="grid grid-cols-3 gap-3">
          <input
            type="text"
            value={newItem.quantity}
            onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
            placeholder="Qtd"
            className="px-3 py-2 border border-slate-300 rounded"
          />
          <input
            type="text"
            value={newItem.unit_price}
            onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })}
            placeholder="Preco unit."
            className="px-3 py-2 border border-slate-300 rounded"
          />
          <select
            value={newItem.item_type}
            onChange={(e) => setNewItem({ ...newItem, item_type: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded"
          >
            <option value="SERVICE">Servico</option>
            <option value="PART">Peca</option>
            <option value="EXTERNAL_SERVICE">Servico Terceiro</option>
            <option value="FEE">Taxa</option>
          </select>
        </div>
        <button
          onClick={addItemToList}
          disabled={!newItem.description || !newItem.unit_price}
          className="bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-2"
        >
          <Plus size={16} /> Adicionar ao lote
        </button>
      </div>

      {items.length > 0 && (
        <div className="bg-white border border-slate-200 rounded p-4">
          <h3 className="font-semibold mb-3">Itens a adicionar ({items.length})</h3>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center py-2 border-b border-slate-100"
              >
                <div className="flex-1">
                  <div className="font-medium">{item.description}</div>
                  <div className="text-xs text-slate-500">
                    {item.quantity} &times; {formatBRL(item.unit_price)}
                  </div>
                </div>
                <div className="font-semibold">
                  {formatBRL(
                    (parseFloat(item.quantity) * parseFloat(item.unit_price)).toFixed(2),
                  )}
                </div>
                <button
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  className="ml-3 text-red-500 hover:text-red-700"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
            <span className="font-semibold">Total complemento</span>
            <span className="text-xl font-bold text-red-600">{formatBRL(total.toFixed(2))}</span>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={submit}
              disabled={add.isPending}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {add.isPending ? 'Adicionando...' : 'Confirmar complemento'}
            </button>
          </div>
          {add.error && (
            <div className="mt-2 text-sm text-red-600">{(add.error as Error).message}</div>
          )}
        </div>
      )}
    </div>
  );
}
