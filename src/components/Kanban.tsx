import React, { useState } from 'react';
import { ServiceOrder, OSStatus, OS_STATUS_LABEL, VALID_TRANSITIONS, Person } from '../types';
import { formatCurrency, cn } from '../utils';
import {
  Clock, AlertCircle, CheckCircle2, Wrench, Car, CheckSquare, Shield,
  ArrowRightLeft, Image as ImageIcon, Package, DollarSign, UserPlus, Bell,
  X, Eye, Hammer, PaintBucket, Settings2, Sparkles, Droplets, Search, Ban,
} from 'lucide-react';
import { FilterBar } from './FilterBar';
import { motion, AnimatePresence } from 'motion/react';

type KanbanProps = {
  orders: ServiceOrder[];
  people: Person[];
  updateOrderStatus: (orderId: string, newStatus: OSStatus, changedBy?: string, notes?: string) => void;
  updateOrder: (order: ServiceOrder) => void;
};

type ColumnDef = {
  id: OSStatus;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  group: 'intake' | 'repair' | 'finish' | 'done';
};

const COLUMNS: ColumnDef[] = [
  { id: 'reception',      label: 'Recepção',          icon: Clock,        color: 'text-slate-600',   bg: 'bg-slate-100',    group: 'intake' },
  { id: 'initial_survey', label: 'Vistoria Inicial',   icon: Eye,          color: 'text-violet-600',  bg: 'bg-violet-100',   group: 'intake' },
  { id: 'budget',         label: 'Orçamento',          icon: DollarSign,   color: 'text-amber-600',   bg: 'bg-amber-100',    group: 'intake' },
  { id: 'waiting_parts',  label: 'Aguardando Peças',   icon: Package,      color: 'text-orange-600',  bg: 'bg-orange-100',   group: 'intake' },
  { id: 'repair',         label: 'Reparo',             icon: Wrench,       color: 'text-blue-600',    bg: 'bg-blue-100',     group: 'repair' },
  { id: 'mechanic',       label: 'Mecânica',           icon: Settings2,    color: 'text-cyan-600',    bg: 'bg-cyan-100',     group: 'repair' },
  { id: 'bodywork',       label: 'Funilaria',          icon: Hammer,       color: 'text-indigo-600',  bg: 'bg-indigo-100',   group: 'repair' },
  { id: 'painting',       label: 'Pintura',            icon: PaintBucket,  color: 'text-pink-600',    bg: 'bg-pink-100',     group: 'repair' },
  { id: 'assembly',       label: 'Montagem',           icon: Settings2,    color: 'text-teal-600',    bg: 'bg-teal-100',     group: 'finish' },
  { id: 'polishing',      label: 'Polimento',          icon: Sparkles,     color: 'text-yellow-600',  bg: 'bg-yellow-100',   group: 'finish' },
  { id: 'washing',        label: 'Lavagem',            icon: Droplets,     color: 'text-sky-600',     bg: 'bg-sky-100',      group: 'finish' },
  { id: 'final_survey',   label: 'Vistoria Final',     icon: Search,       color: 'text-purple-600',  bg: 'bg-purple-100',   group: 'finish' },
  { id: 'ready',          label: 'Pronto p/ Entrega',  icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100',  group: 'done' },
  { id: 'delivered',      label: 'Entregue',           icon: Car,          color: 'text-primary',     bg: 'bg-primary/10',   group: 'done' },
  { id: 'cancelled',      label: 'Cancelada',          icon: Ban,          color: 'text-red-500',     bg: 'bg-red-100',      group: 'done' },
];

const GROUP_LABELS: Record<string, string> = {
  intake: 'Entrada',
  repair: 'Reparo',
  finish: 'Acabamento',
  done:   'Concluído',
};

export function Kanban({ orders, people, updateOrderStatus, updateOrder }: KanbanProps) {
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [filterType, setFilterType] = useState('Todas');
  const [filterInsurance, setFilterInsurance] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [activeEmployeeMenu, setActiveEmployeeMenu] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<{ orderId: string; status: OSStatus } | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [changedBy, setChangedBy] = useState('');
  // Ocultar colunas vazias por padrão
  const [showEmpty, setShowEmpty] = useState(false);

  const employees = people.filter(p => p.type === 'Colaborador');

  const filteredOrders = orders.filter(o => {
    if (dateStart && new Date(o.createdAt) < new Date(dateStart)) return false;
    if (dateEnd) {
      const end = new Date(dateEnd);
      end.setHours(23, 59, 59, 999);
      if (new Date(o.createdAt) > end) return false;
    }
    if (filterType !== 'Todas' && o.osType !== filterType) return false;
    if (filterInsurance && o.insuranceCompanyId !== filterInsurance) return false;
    return true;
  });

  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    e.dataTransfer.setData('orderId', orderId);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (e: React.DragEvent, targetStatus: OSStatus) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData('orderId');
    if (!orderId) return;
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status === targetStatus) return;
    // Validar transição
    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(targetStatus)) {
      alert(`Transição inválida: ${OS_STATUS_LABEL[order.status]} → ${OS_STATUS_LABEL[targetStatus]}\nPermitidas: ${allowed.map(s => OS_STATUS_LABEL[s]).join(', ') || 'nenhuma'}`);
      return;
    }
    setStatusModal({ orderId, status: targetStatus });
  };

  const confirmStatusChange = () => {
    if (statusModal) {
      updateOrderStatus(
        statusModal.orderId,
        statusModal.status,
        changedBy.trim() || 'Sistema (Kanban)',
        statusNote.trim() || undefined,
      );
      setStatusModal(null);
      setStatusNote('');
      setChangedBy('');
    }
  };

  const visibleColumns = showEmpty
    ? COLUMNS
    : COLUMNS.filter(c => filteredOrders.some(o => o.status === c.id));

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Kanban de O.S</h1>
          <p className="text-slate-500 text-sm mt-1">
            Arraste os cards para avançar o status — transições inválidas são bloqueadas.
          </p>
        </div>
        <button
          onClick={() => setShowEmpty(v => !v)}
          className="text-xs font-medium text-slate-500 hover:text-primary bg-white border border-surface rounded-lg px-3 py-1.5 transition-colors"
        >
          {showEmpty ? 'Ocultar colunas vazias' : 'Mostrar todas as colunas'}
        </button>
      </div>

      <FilterBar
        dateStart={dateStart} setDateStart={setDateStart}
        dateEnd={dateEnd} setDateEnd={setDateEnd}
        filterType={filterType} setFilterType={setFilterType}
        filterInsurance={filterInsurance} setFilterInsurance={setFilterInsurance}
        people={people}
      />

      <div className="flex-1 flex gap-4 overflow-x-auto pb-4 mt-2">
        {visibleColumns.map(column => {
          const columnOrders = filteredOrders.filter(o => o.status === column.id);
          const Icon = column.icon;

          return (
            <div
              key={column.id}
              className="flex-shrink-0 w-72 flex flex-col bg-surface/30 rounded-2xl border border-surface"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="p-3 border-b border-surface flex items-center justify-between bg-white rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", column.bg, column.color)}>
                    <Icon size={14} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-xs leading-tight">{column.label}</h3>
                    <span className="text-[10px] text-slate-400">{GROUP_LABELS[column.group]}</span>
                  </div>
                </div>
                <span className="bg-surface text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full">
                  {columnOrders.length}
                </span>
              </div>

              <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
                {columnOrders.map(order => {
                  const client = people.find(p => p.id === order.clientId);
                  const employee = order.assignedEmployeeId ? people.find(p => p.id === order.assignedEmployeeId) : null;
                  const isMenuActive = activeMenu === order.id;
                  const isEmployeeMenuActive = activeEmployeeMenu === order.id;
                  const checklist = order.checklist ?? [];
                  const completedChecklistCount = checklist.filter(i => i.completed).length;
                  const photos = order.photos ?? [];
                  const amountRemaining = order.totalValue - (order.amountPaid ?? 0);
                  const allowedNext = VALID_TRANSITIONS[order.status] ?? [];

                  return (
                    <div
                      key={order.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, order.id)}
                      className={cn(
                        "bg-white p-3.5 rounded-xl border shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all relative group",
                        order.priority === 'Urgente' ? "border-red-300 hover:border-red-400" :
                        order.priority === 'Alta'    ? "border-orange-300 hover:border-orange-400" :
                        order.priority === 'Média'   ? "border-blue-200 hover:border-blue-300" :
                        "border-surface hover:border-primary/30",
                        (isMenuActive || isEmployeeMenuActive) && "z-10"
                      )}
                    >
                      {/* Header */}
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-1.5">
                          <div className={cn(
                            "w-5 h-5 rounded flex items-center justify-center shrink-0",
                            order.osType === 'Seguradora' ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"
                          )}>
                            {order.osType === 'Seguradora' ? <Shield size={10} /> : <Wrench size={10} />}
                          </div>
                          <span className="text-xs font-bold text-slate-700">{order.id}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Atribuir colaborador */}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveEmployeeMenu(isEmployeeMenuActive ? null : order.id);
                                setActiveMenu(null);
                              }}
                              className={cn(
                                "p-1 rounded transition-colors",
                                isEmployeeMenuActive ? "bg-primary text-white" : "text-slate-400 hover:bg-slate-100 hover:text-primary"
                              )}
                              title="Atribuir colaborador"
                            >
                              <UserPlus size={12} />
                            </button>
                            <AnimatePresence>
                              {isEmployeeMenuActive && (
                                <motion.div
                                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                  transition={{ duration: 0.15 }}
                                  className="absolute right-0 top-full mt-1 w-52 bg-white border border-surface rounded-xl shadow-xl z-50 py-1 max-h-52 overflow-y-auto"
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

                          <span className="text-[10px] font-medium text-slate-900 bg-page-bg px-1.5 py-0.5 rounded">
                            {order.plate}
                          </span>

                          {/* Mudar status — só mostra transições válidas */}
                          {allowedNext.length > 0 && (
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenu(isMenuActive ? null : order.id);
                                  setActiveEmployeeMenu(null);
                                }}
                                className={cn(
                                  "p-1 rounded transition-colors",
                                  isMenuActive ? "bg-primary text-white" : "text-slate-400 hover:bg-slate-100 hover:text-primary"
                                )}
                                title="Avançar status"
                              >
                                <ArrowRightLeft size={12} />
                              </button>
                              <AnimatePresence>
                                {isMenuActive && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 top-full mt-1 w-52 bg-white border border-surface rounded-xl shadow-xl z-50 py-1"
                                  >
                                    <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-surface mb-1">
                                      Avançar para:
                                    </p>
                                    {allowedNext.map(nextStatus => {
                                      const col = COLUMNS.find(c => c.id === nextStatus);
                                      return (
                                        <button
                                          key={nextStatus}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setStatusModal({ orderId: order.id, status: nextStatus });
                                            setActiveMenu(null);
                                          }}
                                          className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-page-bg hover:text-primary transition-colors flex items-center gap-2"
                                        >
                                          {col && (
                                            <div className={cn("w-2 h-2 rounded-full", col.bg, col.color.replace('text-', 'bg-'))} />
                                          )}
                                          {OS_STATUS_LABEL[nextStatus]}
                                        </button>
                                      );
                                    })}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Vehicle + client */}
                      <h4 className="font-medium text-slate-900 text-xs mb-1 truncate">{order.vehicle}</h4>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-[11px] text-slate-500 truncate flex-1">{client?.name ?? 'Cliente Desconhecido'}</p>
                        {order.priority && (
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0",
                            order.priority === 'Baixa'   ? "bg-slate-100 text-slate-600" :
                            order.priority === 'Média'   ? "bg-blue-100 text-blue-700" :
                            order.priority === 'Alta'    ? "bg-orange-100 text-orange-700" :
                            "bg-red-100 text-red-700"
                          )}>
                            {order.priority}
                          </span>
                        )}
                      </div>

                      {/* Observations */}
                      {order.observations && (
                        <p className="text-[11px] text-slate-500 mb-2 line-clamp-2 italic border-l-2 border-surface pl-2">
                          "{order.observations}"
                        </p>
                      )}

                      {/* Employee badge */}
                      {employee && (
                        <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-page-bg rounded-lg border border-surface">
                          <div className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[8px] font-bold shrink-0">
                            {employee.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-bold text-slate-700 truncate">{employee.name}</span>
                            <span className="text-[8px] text-primary font-semibold uppercase tracking-tighter">{employee.role}</span>
                          </div>
                        </div>
                      )}

                      {/* Stats grid */}
                      <div className="grid grid-cols-2 gap-1.5 mb-2">
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 px-1.5 py-1 rounded border border-surface">
                          <Wrench size={10} className="text-primary" />
                          <span>{order.services.length} serv.</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 px-1.5 py-1 rounded border border-surface">
                          <Package size={10} className="text-secondary" />
                          <span>{order.parts.length} peças</span>
                        </div>
                        {checklist.length > 0 && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 px-1.5 py-1 rounded border border-surface">
                            <CheckSquare size={10} className={completedChecklistCount === checklist.length ? "text-emerald-500" : "text-amber-500"} />
                            <span>{completedChecklistCount}/{checklist.length}</span>
                          </div>
                        )}
                        {photos.length > 0 && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 px-1.5 py-1 rounded border border-surface">
                            <ImageIcon size={10} className="text-blue-500" />
                            <span>{photos.length} fotos</span>
                          </div>
                        )}
                      </div>

                      {/* Footer financeiro */}
                      <div className="flex justify-between items-center pt-2 border-t border-surface">
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold block">Total</span>
                          <span className="text-xs font-bold text-slate-900">{formatCurrency(order.totalValue)}</span>
                        </div>
                        {amountRemaining > 0 ? (
                          <div className="text-right">
                            <span className="text-[9px] text-red-400 uppercase tracking-wider font-semibold block">Falta</span>
                            <span className="text-xs font-bold text-red-500">{formatCurrency(amountRemaining)}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Pago</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {columnOrders.length === 0 && (
                  <div className="h-20 border-2 border-dashed border-surface rounded-xl flex items-center justify-center text-slate-400 text-xs">
                    Solte aqui
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Backdrop */}
      {(activeMenu || activeEmployeeMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setActiveMenu(null); setActiveEmployeeMenu(null); }}
        />
      )}

      {/* Modal de confirmação de status */}
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
                    <h2 className="text-lg font-bold text-primary">Avançar Status</h2>
                    <p className="text-xs text-slate-500">
                      {statusModal.orderId} → {OS_STATUS_LABEL[statusModal.status]}
                    </p>
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
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Observação (opcional)</label>
                  <textarea
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Ex: Peças chegaram, iniciando funilaria..."
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
