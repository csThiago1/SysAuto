import React, { useState } from 'react';
import { ServiceOrder, OSStatus, Person } from '../types';
import { formatCurrency, cn } from '../utils';
import { Clock, AlertCircle, CheckCircle2, Wrench, Car, CheckSquare, Shield, ArrowRightLeft, Image as ImageIcon, Package, DollarSign, UserPlus, Bell, X } from 'lucide-react';
import { FilterBar } from './FilterBar';
import { motion, AnimatePresence } from 'motion/react';

type KanbanProps = {
  orders: ServiceOrder[];
  people: Person[];
  updateOrderStatus: (orderId: string, newStatus: OSStatus, changedBy?: string, notes?: string) => void;
  updateOrder: (order: ServiceOrder) => void;
};

const COLUMNS: { id: OSStatus; label: string; icon: any; color: string; bg: string }[] = [
  { id: 'Em vistoria', label: 'Em Vistoria', icon: Clock, color: 'text-slate-600', bg: 'bg-slate-100' },
  { id: 'Aguardando Liberação', label: 'Aguardando Liberação', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-100' },
  { id: 'Aguardando Peças', label: 'Aguardando Peças', icon: CheckSquare, color: 'text-orange-600', bg: 'bg-orange-100' },
  { id: 'Em serviço', label: 'Em Serviço', icon: Wrench, color: 'text-secondary', bg: 'bg-secondary/10' },
  { id: 'Veículo Pronto', label: 'Veículo Pronto', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  { id: 'Veículo Entregue', label: 'Veículo Entregue', icon: Car, color: 'text-primary', bg: 'bg-primary/10' },
];

export function Kanban({ orders, people, updateOrderStatus, updateOrder }: KanbanProps) {
  // Filter State
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [filterType, setFilterType] = useState('Todas');
  const [filterInsurance, setFilterInsurance] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [activeEmployeeMenu, setActiveEmployeeMenu] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<{ orderId: string, status: OSStatus } | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [changedBy, setChangedBy] = useState('');

  const employees = people.filter(p => p.type === 'Colaborador');

  const filteredOrders = orders.filter(o => {
    let match = true;
    if (dateStart) {
      if (new Date(o.createdAt) < new Date(dateStart)) match = false;
    }
    if (dateEnd) {
      const end = new Date(dateEnd);
      end.setHours(23, 59, 59, 999);
      if (new Date(o.createdAt) > end) match = false;
    }
    if (filterType !== 'Todas') {
      if (o.osType !== filterType) match = false;
    }
    if (filterInsurance) {
      if (o.insuranceCompanyId !== filterInsurance) match = false;
    }
    return match;
  });

  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    e.dataTransfer.setData('orderId', orderId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: OSStatus) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData('orderId');
    if (orderId) {
      const order = orders.find(o => o.id === orderId);
      if (order && order.status !== status) {
        setStatusModal({ orderId, status });
      }
    }
  };

  const confirmStatusChange = () => {
    if (statusModal) {
      updateOrderStatus(statusModal.orderId, statusModal.status, changedBy.trim() || 'Sistema (Kanban)', statusNote.trim() || undefined);
      setStatusModal(null);
      setStatusNote('');
      setChangedBy('');
    }
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary tracking-tight">Kanban de O.S</h1>
        <p className="text-slate-500 text-sm mt-1">Arraste os cards ou use o botão de edição rápida para atualizar o status.</p>
      </div>

      <FilterBar 
        dateStart={dateStart} setDateStart={setDateStart}
        dateEnd={dateEnd} setDateEnd={setDateEnd}
        filterType={filterType} setFilterType={setFilterType}
        filterInsurance={filterInsurance} setFilterInsurance={setFilterInsurance}
        people={people}
      />

      <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
        {COLUMNS.map(column => {
          const columnOrders = filteredOrders.filter(o => o.status === column.id);
          const Icon = column.icon;

          return (
            <div 
              key={column.id}
              className="flex-shrink-0 w-80 flex flex-col bg-surface/30 rounded-2xl border border-surface"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="p-4 border-b border-surface flex items-center justify-between bg-white rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", column.bg, column.color)}>
                    <Icon size={16} />
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm">{column.label}</h3>
                </div>
                <span className="bg-surface text-slate-600 text-xs font-medium px-2 py-1 rounded-full">
                  {columnOrders.length}
                </span>
              </div>

              <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                {columnOrders.map(order => {
                  const client = people.find(p => p.id === order.clientId);
                  const employee = order.assignedEmployeeId ? people.find(p => p.id === order.assignedEmployeeId) : null;
                  const isMenuActive = activeMenu === order.id;
                  const isEmployeeMenuActive = activeEmployeeMenu === order.id;
                  
                  const checklist = order.checklist || [];
                  const completedChecklistCount = checklist.filter(i => i.completed).length;
                  const photos = order.photos || [];
                  const amountRemaining = order.totalValue - (order.amountPaid || 0);

                  return (
                    <div
                      key={order.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, order.id)}
                      className={cn(
                        "bg-white p-4 rounded-xl border shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all relative group",
                        order.priority === 'Urgente' ? "border-red-300 hover:border-red-400" :
                        order.priority === 'Alta' ? "border-orange-300 hover:border-orange-400" :
                        order.priority === 'Média' ? "border-blue-200 hover:border-blue-300" :
                        "border-surface hover:border-primary/30",
                        (isMenuActive || isEmployeeMenuActive) && "z-10"
                      )}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-6 h-6 rounded-md flex items-center justify-center shrink-0", 
                            order.osType === 'Seguradora' ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"
                          )}>
                            {order.osType === 'Seguradora' ? <Shield size={12} /> : <Wrench size={12} />}
                          </div>
                          <span className="text-xs font-bold text-slate-700">{order.id}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="relative">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveEmployeeMenu(isEmployeeMenuActive ? null : order.id);
                                setActiveMenu(null);
                              }}
                              className={cn(
                                "p-1 rounded-md transition-colors",
                                isEmployeeMenuActive ? "bg-primary text-white" : "text-slate-400 hover:bg-slate-100 hover:text-primary"
                              )}
                              title="Atribuir Colaborador"
                            >
                              <UserPlus size={14} />
                            </button>
                            
                            <AnimatePresence>
                              {isEmployeeMenuActive && (
                                <motion.div 
                                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                  transition={{ duration: 0.2 }}
                                  className="absolute right-0 top-full mt-1 w-56 bg-white border border-surface rounded-xl shadow-xl z-50 py-1 max-h-60 overflow-y-auto"
                                >
                                  <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-surface mb-1">
                                    Atribuir a:
                                  </p>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateOrder({ ...order, assignedEmployeeId: undefined });
                                      setActiveEmployeeMenu(null);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-500 hover:bg-page-bg hover:text-red-500 transition-colors"
                                  >
                                    Remover atribuição
                                  </button>
                                  {employees.map(emp => (
                                    <button
                                      key={emp.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateOrder({ ...order, assignedEmployeeId: emp.id });
                                        setActiveEmployeeMenu(null);
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-page-bg hover:text-primary transition-colors flex flex-col"
                                    >
                                      <span>{emp.name}</span>
                                      <span className="text-[10px] text-slate-400">{emp.role}</span>
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                          <span className="text-xs font-medium text-slate-900 bg-page-bg px-2 py-0.5 rounded">
                            {order.plate}
                          </span>
                          <div className="relative">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenu(isMenuActive ? null : order.id);
                                setActiveEmployeeMenu(null);
                              }}
                              className={cn(
                                "p-1 rounded-md transition-colors",
                                isMenuActive ? "bg-primary text-white" : "text-slate-400 hover:bg-slate-100 hover:text-primary"
                              )}
                              title="Alterar Status"
                            >
                              <ArrowRightLeft size={14} />
                            </button>
                            
                            <AnimatePresence>
                              {isMenuActive && (
                                <motion.div 
                                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                  transition={{ duration: 0.2 }}
                                  className="absolute right-0 top-full mt-1 w-48 bg-white border border-surface rounded-xl shadow-xl z-50 py-1"
                                >
                                  <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-surface mb-1">
                                    Mover para:
                                  </p>
                                  {COLUMNS.filter(c => c.id !== order.status).map(col => (
                                    <button
                                      key={col.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setStatusModal({ orderId: order.id, status: col.id });
                                        setActiveMenu(null);
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-page-bg hover:text-primary transition-colors flex items-center gap-2"
                                    >
                                      <div className={cn("w-2 h-2 rounded-full", col.bg.replace('/10', ''), col.color.replace('text-', 'bg-'))}></div>
                                      {col.label}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                      <h4 className="font-medium text-slate-900 text-sm mb-1">{order.vehicle}</h4>
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-xs text-slate-500 truncate flex-1">{client?.name || 'Cliente Desconhecido'}</p>
                        {order.priority && (
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0",
                            order.priority === 'Baixa' ? "bg-slate-100 text-slate-600" :
                            order.priority === 'Média' ? "bg-blue-100 text-blue-700" :
                            order.priority === 'Alta' ? "bg-orange-100 text-orange-700" :
                            "bg-red-100 text-red-700"
                          )}>
                            {order.priority}
                          </span>
                        )}
                        {order.serviceCategory && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium shrink-0">
                            {order.serviceCategory}
                          </span>
                        )}
                      </div>
                      
                      {order.observations && (
                        <p className="text-xs text-slate-500 mb-3 line-clamp-2 italic border-l-2 border-surface pl-2">
                          "{order.observations}"
                        </p>
                      )}
                      
                      {order.status === 'Veículo Entregue' && (
                        <div className="mb-3 px-2 py-1 bg-emerald-50 border border-emerald-100 rounded-md flex items-center gap-1.5">
                          <CheckCircle2 size={12} className="text-emerald-500" />
                          <span className="text-[10px] font-semibold text-emerald-700">
                            Concluído em: {new Date(order.updatedAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      )}

                      {employee && (
                        <div className="flex items-center gap-2 mb-3 p-1.5 bg-page-bg rounded-lg border border-surface">
                          <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[8px] font-bold">
                            {employee.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-700 leading-none">
                              {employee.name}
                            </span>
                            <span className="text-[8px] text-primary font-semibold uppercase tracking-tighter">
                              {employee.role}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 p-1.5 rounded-md border border-surface">
                          <Wrench size={12} className="text-primary" />
                          <span>{order.services.length} serv.</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 p-1.5 rounded-md border border-surface">
                          <Package size={12} className="text-secondary" />
                          <span>{order.parts.length} peças</span>
                        </div>
                        {checklist.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 p-1.5 rounded-md border border-surface">
                            <CheckSquare size={12} className={completedChecklistCount === checklist.length ? "text-emerald-500" : "text-amber-500"} />
                            <span>{completedChecklistCount}/{checklist.length} check</span>
                          </div>
                        )}
                        {photos.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 p-1.5 rounded-md border border-surface">
                            <ImageIcon size={12} className="text-blue-500" />
                            <span>{photos.length} fotos</span>
                          </div>
                        )}
                        {order.reminders && order.reminders.filter(r => !r.completed).length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 p-1.5 rounded-md border border-surface">
                            <Bell size={12} className="text-primary" />
                            <span>{order.reminders.filter(r => !r.completed).length} lemb.</span>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-surface">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total</span>
                          <span className="text-sm font-bold text-slate-900">
                            {formatCurrency(order.totalValue)}
                          </span>
                        </div>
                        {amountRemaining > 0 ? (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-red-400 uppercase tracking-wider font-semibold">Falta Pagar</span>
                            <span className="text-xs font-bold text-red-500">
                              {formatCurrency(amountRemaining)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-emerald-500 uppercase tracking-wider font-semibold">Status</span>
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              Pago
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {columnOrders.length === 0 && (
                  <div className="h-24 border-2 border-dashed border-surface rounded-xl flex items-center justify-center text-slate-400 text-sm">
                    Solte aqui
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Backdrop to close menu */}
      {(activeMenu || activeEmployeeMenu) && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setActiveMenu(null);
            setActiveEmployeeMenu(null);
          }}
        />
      )}

      {/* Status Change Modal */}
      <AnimatePresence>
        {statusModal && (
          <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-surface flex justify-between items-center bg-page-bg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <ArrowRightLeft size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-primary">Alterar Status</h2>
                    <p className="text-xs text-slate-500">O.S {statusModal.orderId} → {statusModal.status}</p>
                  </div>
                </div>
                <button onClick={() => setStatusModal(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Quem está alterando?</label>
                  <input 
                    type="text"
                    value={changedBy}
                    onChange={(e) => setChangedBy(e.target.value)}
                    placeholder="Nome do colaborador (opcional)"
                    className="w-full px-4 py-2.5 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nota / Observação (opcional)</label>
                  <textarea 
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Ex: Peças chegaram, iniciando serviço..."
                    className="w-full px-4 py-2.5 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all h-24 resize-none"
                  />
                </div>
              </div>

              <div className="p-4 bg-page-bg border-t border-surface flex gap-3">
                <button 
                  onClick={() => setStatusModal(null)}
                  className="flex-1 px-4 py-2.5 bg-white border border-surface text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmStatusChange}
                  className="flex-1 px-4 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors text-sm"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
