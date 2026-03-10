import { useState } from 'react';
import { Part } from '../types';
import { formatCurrency, cn } from '../utils';
import { Plus, Search, Package, AlertTriangle, Edit2, DollarSign, Truck } from 'lucide-react';
import { PartModal } from './PartModal';

type InventoryProps = {
  parts: Part[];
  addPart: (part: Omit<Part, 'id'>) => void;
  updatePart: (part: Part) => void;
};

export function Inventory({ parts, addPart, updatePart }: InventoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);

  const handleEdit = (part: Part) => {
    setEditingPart(part);
    setIsModalOpen(true);
  };

  const handleSave = (partData: Omit<Part, 'id'> | Part) => {
    if ('id' in partData) {
      updatePart(partData as Part);
    } else {
      addPart(partData);
    }
  };

  const filteredParts = parts.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Estoque</h1>
          <p className="text-slate-500 text-sm mt-1">Gestão de peças e insumos da oficina.</p>
        </div>
        <button 
          onClick={() => {
            setEditingPart(null);
            setIsModalOpen(true);
          }}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={18} />
          Adicionar Peça
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-2xl border border-surface shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Package size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total de Itens</p>
            <h3 className="text-2xl font-bold text-slate-900">{parts.length}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-surface shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
            <Package size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Valor em Estoque</p>
            <h3 className="text-2xl font-bold text-slate-900">
              {formatCurrency(parts.reduce((acc, p) => acc + (p.price * p.quantity), 0))}
            </h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-surface shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Estoque Baixo</p>
            <h3 className="text-2xl font-bold text-slate-900">
              {parts.filter(p => p.quantity < 10).length}
            </h3>
          </div>
        </div>
      </div>

      <div className="bg-white border border-surface rounded-2xl p-4 flex items-center gap-6 shadow-sm mb-6 flex-wrap">
        <div className="flex items-center gap-2 text-slate-700 font-medium">
          <Search size={18} className="text-primary" />
          Filtros:
        </div>
        
        <div className="flex items-center gap-4 flex-1 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou SKU..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-surface shadow-sm flex-1 flex flex-col overflow-hidden">

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-page-bg text-slate-500 font-medium border-b border-surface">
              <tr>
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4">Nome da Peça</th>
                <th className="px-6 py-4">Fornecedor</th>
                <th className="px-6 py-4 text-right">Quantidade</th>
                <th className="px-6 py-4 text-right">Custo Unitário</th>
                <th className="px-6 py-4 text-right">Custo Total</th>
                <th className="px-6 py-4 text-right">Preço Venda</th>
                <th className="px-6 py-4 text-right">Lucro</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface">
              {filteredParts.map(part => {
                const profit = part.price - (part.cost || 0);
                const profitMargin = part.price > 0 ? (profit / part.price) * 100 : 0;
                
                return (
                  <tr key={part.id} className="hover:bg-page-bg/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{part.sku}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{part.name}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {part.supplier ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Truck size={14} className="text-slate-400" />
                          {part.supplier}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Não informado</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center",
                        part.quantity < 10 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                      )}>
                        {part.quantity} un
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600">
                      {part.cost ? formatCurrency(part.cost) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600 font-medium">
                      {part.cost ? formatCurrency(part.cost * part.quantity) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900">
                      {formatCurrency(part.price)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className={cn("font-medium text-sm", profit > 0 ? "text-emerald-600" : "text-slate-500")}>
                          {formatCurrency(profit)}
                        </span>
                        {part.cost && part.cost > 0 && (
                          <span className="text-[10px] font-bold text-slate-400">
                            {profitMargin.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex items-center bg-page-bg border border-surface rounded-lg overflow-hidden mr-2">
                          <button 
                            onClick={() => updatePart({ ...part, quantity: Math.max(0, part.quantity - 1) })}
                            className="p-1 hover:bg-surface text-slate-500 transition-colors border-r border-surface"
                            title="Remover 1 un"
                          >
                            <span className="text-lg leading-none font-bold">-</span>
                          </button>
                          <button 
                            onClick={() => updatePart({ ...part, quantity: part.quantity + 1 })}
                            className="p-1 hover:bg-surface text-slate-500 transition-colors"
                            title="Adicionar 1 un"
                          >
                            <span className="text-lg leading-none font-bold">+</span>
                          </button>
                        </div>
                        <button 
                          onClick={() => handleEdit(part)}
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Editar Peça"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredParts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    Nenhuma peça encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <PartModal 
          part={editingPart} 
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSave} 
        />
      )}
    </div>
  );
}
