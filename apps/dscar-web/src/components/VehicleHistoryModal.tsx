import React from 'react';
import { ServiceOrder, Part } from '../types';
import { formatCurrency } from '../utils';
import { Car, Calendar, Wrench, Package, X } from 'lucide-react';

type VehicleHistoryModalProps = {
  plate: string;
  vehicleName: string;
  orders: ServiceOrder[];
  parts: Part[];
  onClose: () => void;
};

export function VehicleHistoryModal({ plate, vehicleName, orders, parts, onClose }: VehicleHistoryModalProps) {
  // Filter orders by plate and sort by date descending
  const vehicleOrders = orders
    .filter(o => o.plate.toUpperCase() === plate.toUpperCase())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalSpent = vehicleOrders.reduce((acc, o) => acc + o.totalValue, 0);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Car size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Histórico do Veículo</h2>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="font-medium text-slate-700">{vehicleName}</span>
                <span>•</span>
                <span className="font-mono uppercase">{plate}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <p className="text-xs text-slate-500 font-medium mb-1">Total de Visitas</p>
              <p className="text-xl font-bold text-slate-900">{vehicleOrders.length}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <p className="text-xs text-slate-500 font-medium mb-1">Total Gasto</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(totalSpent)}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <p className="text-xs text-slate-500 font-medium mb-1">Última Visita</p>
              <p className="text-xl font-bold text-slate-900">
                {vehicleOrders.length > 0 ? new Date(vehicleOrders[0].createdAt).toLocaleDateString('pt-BR') : '-'}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {vehicleOrders.map(order => (
              <div key={order.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-sm font-bold text-slate-700 shadow-sm">
                      {order.id}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-slate-500">
                      <Calendar size={14} />
                      {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(order.totalValue)}</span>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                      {order.status}
                    </span>
                  </div>
                </div>
                
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Serviços */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                      <Wrench size={14} className="text-primary" />
                      Serviços Realizados
                    </h4>
                    {order.services.length > 0 ? (
                      <ul className="space-y-2">
                        {order.services.map((s, i) => (
                          <li key={i} className="flex justify-between text-sm">
                            <span className="text-slate-700">{s.name}</span>
                            <span className="font-medium text-slate-900">{formatCurrency(s.price)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-400 italic">Nenhum serviço</p>
                    )}
                  </div>

                  {/* Peças */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                      <Package size={14} className="text-secondary" />
                      Peças Utilizadas
                    </h4>
                    {order.parts.length > 0 ? (
                      <ul className="space-y-2">
                        {order.parts.map((p, i) => {
                          const partDetails = parts.find(pt => pt.id === p.partId);
                          return (
                            <li key={i} className="flex justify-between text-sm">
                              <span className="text-slate-700">
                                {p.quantity}x {partDetails?.name || p.partId}
                              </span>
                              <span className="font-medium text-slate-900">{formatCurrency(p.price * p.quantity)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-400 italic">Nenhuma peça</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {vehicleOrders.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                Nenhum histórico encontrado para este veículo.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
