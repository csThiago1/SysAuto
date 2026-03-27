import React from 'react';
import { ServiceOrder, Person, Part } from '../types';
import { formatCurrency, cn } from '../utils';
import { Car, Calendar, Wrench, Package, X, User, DollarSign, FileText } from 'lucide-react';

type ClientHistoryModalProps = {
  client: Person;
  orders: ServiceOrder[];
  parts: Part[];
  onClose: () => void;
};

export function ClientHistoryModal({ client, orders, parts, onClose }: ClientHistoryModalProps) {
  // Filter orders by client and sort by date descending
  const clientOrders = orders
    .filter(o => o.clientId === client.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalSpent = clientOrders.reduce((acc, o) => acc + o.totalValue, 0);

  return (
    <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-surface flex justify-between items-center bg-page-bg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xl uppercase">
              {client.name.substring(0, 2)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Histórico do Cliente</h2>
              <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                <span className="font-medium text-slate-700">{client.name}</span>
                <span>•</span>
                <span>{client.phone}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-surface rounded-xl transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-white">
          <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-page-bg p-5 rounded-2xl border border-surface">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <FileText size={16} />
                </div>
                <p className="text-sm text-slate-500 font-medium">Total de O.S</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">{clientOrders.length}</p>
            </div>
            <div className="bg-page-bg p-5 rounded-2xl border border-surface">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <DollarSign size={16} />
                </div>
                <p className="text-sm text-slate-500 font-medium">Total Gasto</p>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalSpent)}</p>
            </div>
            <div className="bg-page-bg p-5 rounded-2xl border border-surface">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Calendar size={16} />
                </div>
                <p className="text-sm text-slate-500 font-medium">Última Visita</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {clientOrders.length > 0 ? new Date(clientOrders[0].createdAt).toLocaleDateString('pt-BR') : '-'}
              </p>
            </div>
          </div>

          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Wrench className="text-primary" size={20} />
            Ordens de Serviço
          </h3>

          {clientOrders.length > 0 ? (
            <div className="space-y-4">
              {clientOrders.map(order => (
                <div key={order.id} className="bg-white border border-surface rounded-2xl overflow-hidden shadow-sm hover:border-primary/30 transition-colors">
                  <div className="p-5 border-b border-surface bg-page-bg flex flex-wrap gap-4 justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="bg-white border border-surface px-3 py-1.5 rounded-lg text-sm font-bold text-slate-700 shadow-sm">
                        {order.id}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Car size={16} className="text-slate-400" />
                        <span className="font-bold text-slate-800">{order.vehicle}</span>
                        <span className="font-mono bg-white px-2 py-0.5 rounded border border-surface text-xs">
                          {order.plate}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-sm text-slate-500">
                        <Calendar size={14} />
                        {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                      </div>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                        order.status === 'Veículo Entregue' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {order.status}
                      </span>
                      <span className="text-lg font-bold text-slate-900 ml-2">
                        {formatCurrency(order.totalValue)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Serviços */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                        <Wrench size={14} className="text-primary" />
                        Serviços Realizados ({order.services.length})
                      </h4>
                      {order.services.length > 0 ? (
                        <ul className="space-y-2">
                          {order.services.map((s, i) => (
                            <li key={i} className="flex justify-between text-sm bg-page-bg px-3 py-2 rounded-lg">
                              <span className="text-slate-700">{s.name}</span>
                              <span className="font-medium text-slate-900">{formatCurrency(s.price)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-400 italic bg-page-bg px-3 py-2 rounded-lg">Nenhum serviço registrado.</p>
                      )}
                    </div>
                    
                    {/* Peças */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                        <Package size={14} className="text-secondary" />
                        Peças Utilizadas ({order.parts.length})
                      </h4>
                      {order.parts.length > 0 ? (
                        <ul className="space-y-2">
                          {order.parts.map((p, i) => {
                            const partDetails = parts.find(pt => pt.id === p.partId);
                            return (
                              <li key={i} className="flex justify-between text-sm bg-page-bg px-3 py-2 rounded-lg">
                                <span className="text-slate-700">
                                  {p.quantity}x {partDetails?.name || p.partId}
                                </span>
                                <span className="font-medium text-slate-900">{formatCurrency(p.price * p.quantity)}</span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-400 italic bg-page-bg px-3 py-2 rounded-lg">Nenhuma peça registrada.</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-page-bg rounded-2xl border border-dashed border-surface">
              <Car size={48} className="mx-auto text-slate-300 mb-4" />
              <h4 className="text-lg font-medium text-slate-700">Nenhum histórico encontrado</h4>
              <p className="text-slate-500 mt-1">Este cliente ainda não possui ordens de serviço registradas.</p>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-surface bg-page-bg flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 text-slate-700 font-medium hover:bg-slate-300 rounded-xl transition-colors text-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
