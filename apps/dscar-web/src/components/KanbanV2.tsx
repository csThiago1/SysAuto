// apps/dscar-web/src/components/KanbanV2.tsx
// Kanban usando hooks reais (TanStack Query + API backend).
// O Kanban.tsx legado (mock) permanece intacto.
import React, { useState } from 'react';
import { useServiceOrdersV2, useChangeStatusV2 } from '../hooks/useServiceOrderV2';
import type { ServiceOrder, OSStatus } from '../schemas/serviceOrders';
import { cn } from '../utils';
import {
  Clock, Eye, DollarSign, Package, Wrench, Settings2, Hammer,
  PaintBucket, Sparkles, Droplets, Search, CheckCircle2, Car, Ban,
  ArrowRightLeft, Shield, X,
} from 'lucide-react';
import { formatBRL } from '../utils/format';
import { motion, AnimatePresence } from 'motion/react';

// Status display labels matching CLAUDE.md kanban states
const OS_STATUS_LABEL: Record<OSStatus, string> = {
  reception: 'Recepção',
  initial_survey: 'Vistoria Inicial',
  budget: 'Orçamento',
  waiting_parts: 'Aguardando Peças',
  repair: 'Reparo',
  mechanic: 'Mecânica',
  bodywork: 'Funilaria',
  painting: 'Pintura',
  assembly: 'Montagem',
  polishing: 'Polimento',
  washing: 'Lavagem',
  final_survey: 'Vistoria Final',
  ready: 'Pronto p/ Entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};

// Valid transitions from CLAUDE.md
const VALID_TRANSITIONS: Record<OSStatus, OSStatus[]> = {
  reception: ['initial_survey', 'cancelled'],
  initial_survey: ['budget'],
  budget: ['waiting_parts', 'repair'],
  waiting_parts: ['repair'],
  repair: ['mechanic', 'bodywork', 'polishing'],
  mechanic: ['bodywork', 'polishing'],
  bodywork: ['painting'],
  painting: ['assembly'],
  assembly: ['polishing'],
  polishing: ['washing'],
  washing: ['final_survey'],
  final_survey: ['ready'],
  ready: ['delivered'],
  delivered: [],
  cancelled: [],
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
  { id: 'reception', label: 'Recepção', icon: Clock, color: 'text-slate-600', bg: 'bg-slate-100', group: 'intake' },
  { id: 'initial_survey', label: 'Vistoria Inicial', icon: Eye, color: 'text-violet-600', bg: 'bg-violet-100', group: 'intake' },
  { id: 'budget', label: 'Orçamento', icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-100', group: 'intake' },
  { id: 'waiting_parts', label: 'Aguardando Peças', icon: Package, color: 'text-orange-600', bg: 'bg-orange-100', group: 'intake' },
  { id: 'repair', label: 'Reparo', icon: Wrench, color: 'text-blue-600', bg: 'bg-blue-100', group: 'repair' },
  { id: 'mechanic', label: 'Mecânica', icon: Settings2, color: 'text-cyan-600', bg: 'bg-cyan-100', group: 'repair' },
  { id: 'bodywork', label: 'Funilaria', icon: Hammer, color: 'text-indigo-600', bg: 'bg-indigo-100', group: 'repair' },
  { id: 'painting', label: 'Pintura', icon: PaintBucket, color: 'text-pink-600', bg: 'bg-pink-100', group: 'repair' },
  { id: 'assembly', label: 'Montagem', icon: Settings2, color: 'text-teal-600', bg: 'bg-teal-100', group: 'finish' },
  { id: 'polishing', label: 'Polimento', icon: Sparkles, color: 'text-yellow-600', bg: 'bg-yellow-100', group: 'finish' },
  { id: 'washing', label: 'Lavagem', icon: Droplets, color: 'text-sky-600', bg: 'bg-sky-100', group: 'finish' },
  { id: 'final_survey', label: 'Vistoria Final', icon: Search, color: 'text-purple-600', bg: 'bg-purple-100', group: 'finish' },
  { id: 'ready', label: 'Pronto p/ Entrega', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100', group: 'done' },
  { id: 'delivered', label: 'Entregue', icon: Car, color: 'text-primary', bg: 'bg-primary/10', group: 'done' },
  { id: 'cancelled', label: 'Cancelada', icon: Ban, color: 'text-red-500', bg: 'bg-red-100', group: 'done' },
];

const GROUP_LABELS: Record<string, string> = {
  intake: 'Entrada',
  repair: 'Reparo',
  finish: 'Acabamento',
  done: 'Concluído',
};

type StatusModal = { orderId: number; osNumber: string; targetStatus: OSStatus };

export function KanbanV2({ onOpenOS }: { onOpenOS?: (osId: number) => void }) {
  const [search, setSearch] = useState('');
  const [showEmpty, setShowEmpty] = useState(false);
  const [statusModal, setStatusModal] = useState<StatusModal | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [activeMenu, setActiveMenu] = useState<number | null>(null);

  const { data, isLoading, error } = useServiceOrdersV2({ search });
  const changeStatus = useChangeStatusV2();

  const orders: ServiceOrder[] = data?.results ?? [];

  const confirmStatusChange = () => {
    if (!statusModal) return;
    changeStatus.mutate(
      { id: statusModal.orderId, newStatus: statusModal.targetStatus, notes: statusNote.trim() || undefined },
      {
        onSuccess: () => {
          setStatusModal(null);
          setStatusNote('');
        },
      },
    );
  };

  const handleDragStart = (e: React.DragEvent, orderId: number) => {
    e.dataTransfer.setData('orderId', String(orderId));
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (e: React.DragEvent, targetStatus: OSStatus) => {
    e.preventDefault();
    const idStr = e.dataTransfer.getData('orderId');
    if (!idStr) return;
    const orderId = parseInt(idStr, 10);
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status === targetStatus) return;
    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(targetStatus)) {
      alert(
        `Transição inválida: ${OS_STATUS_LABEL[order.status]} → ${OS_STATUS_LABEL[targetStatus]}\n` +
          `Permitidas: ${allowed.map((s) => OS_STATUS_LABEL[s]).join(', ') || 'nenhuma'}`,
      );
      return;
    }
    setStatusModal({ orderId, osNumber: order.os_number, targetStatus });
  };

  const visibleColumns = showEmpty
    ? COLUMNS
    : COLUMNS.filter((c) => orders.some((o) => o.status === c.id));

  // Loading state
  if (isLoading) {
    return (
      <div className="p-8 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-64 mb-4" />
        <div className="flex gap-4 overflow-x-auto">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-72 h-64 bg-slate-200 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
          <div className="font-semibold mb-1">Erro ao carregar ordens de serviço</div>
          <div className="text-sm">{(error as Error).message}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Kanban de O.S (V2)</h1>
          <p className="text-slate-500 text-sm mt-1">
            Dados em tempo real via API · arraste para avançar status · transições inválidas bloqueadas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar OS, placa, cliente..."
            className="text-sm px-3 py-1.5 border border-surface rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-56"
          />
          <button
            onClick={() => setShowEmpty((v) => !v)}
            className="text-xs font-medium text-slate-500 hover:text-primary bg-white border border-surface rounded-lg px-3 py-1.5 transition-colors"
          >
            {showEmpty ? 'Ocultar colunas vazias' : 'Mostrar todas as colunas'}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {orders.length === 0 && !isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-500">
            <Wrench size={40} className="mx-auto mb-3 text-slate-300" />
            <div className="font-medium">Nenhuma OS encontrada</div>
            <div className="text-sm mt-1">
              {search ? 'Tente outro termo de busca.' : 'Crie a primeira OS pelo módulo de Orçamentos.'}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex gap-4 overflow-x-auto pb-4 mt-2">
        {visibleColumns.map((column) => {
          const columnOrders = orders.filter((o) => o.status === column.id);
          const Icon = column.icon;

          return (
            <div
              key={column.id}
              className="flex-shrink-0 w-72 flex flex-col bg-surface/30 rounded-2xl border border-surface"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column header */}
              <div className="p-3 border-b border-surface flex items-center justify-between bg-white rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', column.bg, column.color)}>
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

              {/* Cards */}
              <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
                {columnOrders.map((order) => {
                  const isSeguradora = order.customer_type === 'SEGURADORA';
                  const allowedNext = VALID_TRANSITIONS[order.status] ?? [];
                  const isMenuActive = activeMenu === order.id;

                  return (
                    <div
                      key={order.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, order.id)}
                      className={cn(
                        'bg-white p-3.5 rounded-xl border shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all relative group',
                        isMenuActive && 'z-10',
                      )}
                    >
                      {/* Header */}
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-1.5">
                          <div
                            className={cn(
                              'w-5 h-5 rounded flex items-center justify-center shrink-0',
                              isSeguradora ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary',
                            )}
                          >
                            {isSeguradora ? <Shield size={10} /> : <Wrench size={10} />}
                          </div>
                          <span className="text-xs font-bold text-slate-700">{order.os_number}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Placa */}
                          <span className="text-[10px] font-medium text-slate-900 bg-page-bg px-1.5 py-0.5 rounded font-mono">
                            {order.vehicle_plate}
                          </span>

                          {/* Mudar status */}
                          {allowedNext.length > 0 && (
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenu(isMenuActive ? null : order.id);
                                }}
                                className={cn(
                                  'p-1 rounded transition-colors',
                                  isMenuActive
                                    ? 'bg-primary text-white'
                                    : 'text-slate-400 hover:bg-slate-100 hover:text-primary',
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
                                    {allowedNext.map((nextStatus) => {
                                      const col = COLUMNS.find((c) => c.id === nextStatus);
                                      return (
                                        <button
                                          key={nextStatus}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setStatusModal({ orderId: order.id, osNumber: order.os_number, targetStatus: nextStatus });
                                            setActiveMenu(null);
                                          }}
                                          className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-page-bg hover:text-primary transition-colors flex items-center gap-2"
                                        >
                                          {col && (
                                            <div className={cn('w-2 h-2 rounded-full', col.bg)} />
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

                      {/* Vehicle + customer */}
                      <h4 className="font-medium text-slate-900 text-xs mb-1 truncate">{order.vehicle_description}</h4>
                      <p className="text-[11px] text-slate-500 truncate mb-2">{order.customer_name}</p>

                      {/* Seguradora info */}
                      {isSeguradora && order.insurer_name && (
                        <p className="text-[10px] text-blue-600 truncate mb-2 font-medium">{order.insurer_name}</p>
                      )}

                      {/* Total */}
                      {order.active_version && (
                        <div className="flex justify-between items-center pt-2 border-t border-surface">
                          <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Total</span>
                          <span className="text-xs font-bold text-red-600">
                            {formatBRL(order.active_version.net_total)}
                          </span>
                        </div>
                      )}

                      {/* Link para OS V2 detail */}
                      {onOpenOS && (
                        <button
                          onClick={() => onOpenOS(order.id)}
                          className="mt-2 w-full text-xs text-primary hover:underline text-left"
                        >
                          Ver detalhes
                        </button>
                      )}
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

      {/* Backdrop for menus */}
      {activeMenu !== null && (
        <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
      )}

      {/* Status change modal */}
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
                      {statusModal.osNumber} → {OS_STATUS_LABEL[statusModal.targetStatus]}
                    </p>
                  </div>
                </div>
                <button onClick={() => setStatusModal(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Observação (opcional)
                  </label>
                  <textarea
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Ex: Peças chegaram, iniciando funilaria..."
                    className="w-full px-4 py-2.5 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all h-24 resize-none"
                  />
                </div>
                {changeStatus.error && (
                  <div className="text-sm text-red-600">{(changeStatus.error as Error).message}</div>
                )}
              </div>

              <div className="p-4 bg-page-bg border-t border-surface flex gap-3">
                <button
                  onClick={() => { setStatusModal(null); setStatusNote(''); }}
                  className="flex-1 px-4 py-2.5 bg-white border border-surface text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmStatusChange}
                  disabled={changeStatus.isPending}
                  className="flex-1 px-4 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
                >
                  {changeStatus.isPending ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
