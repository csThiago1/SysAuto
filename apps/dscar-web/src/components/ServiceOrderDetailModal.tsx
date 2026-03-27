import React, { useState, useRef } from 'react';
import { ServiceOrder, Person, Part, ChecklistItem, Photo } from '../types';
import { formatCurrency, cn } from '../utils';
import { FileText, Wrench, Package, DollarSign, CheckSquare, Image as ImageIcon, Calendar, User, Car, ShieldAlert, Plus, Trash2, Check, Upload, X, Bell, Clock, History, Edit3 } from 'lucide-react';
import { OSStatus } from '../types';

type ServiceOrderDetailModalProps = {
  order: ServiceOrder;
  people: Person[];
  parts: Part[];
  onClose: () => void;
  onUpdateOrder?: (order: ServiceOrder) => void;
};

export function ServiceOrderDetailModal({ order, people, parts, onClose, onUpdateOrder }: ServiceOrderDetailModalProps) {
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
  const [showStatusHistory, setShowStatusHistory] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<OSStatus>(order.status);
  const [statusNote, setStatusNote] = useState('');
  const [changedBy, setChangedBy] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const client = people.find(p => p.id === order.clientId);
  const insurance = order.insuranceCompanyId ? people.find(p => p.id === order.insuranceCompanyId) : null;
  const employee = order.assignedEmployeeId ? people.find(p => p.id === order.assignedEmployeeId) : null;

  const totalServices = order.services.reduce((acc, s) => acc + s.price, 0);
  const totalParts = order.parts.reduce((acc, p) => acc + (p.price * p.quantity), 0);
  const totalValue = order.totalValue;
  const amountPaid = order.amountPaid || 0;
  const amountRemaining = totalValue - amountPaid;

  const handleAddChecklistItem = () => {
    if (!newChecklistItem.trim() || !onUpdateOrder) return;
    
    const newItem: ChecklistItem = {
      id: `chk-${Date.now()}`,
      name: newChecklistItem.trim(),
      completed: false
    };

    onUpdateOrder({
      ...order,
      checklist: [...(order.checklist || []), newItem]
    });
    
    setNewChecklistItem('');
  };

  const handleToggleChecklist = (itemId: string) => {
    if (!onUpdateOrder || !order.checklist) return;

    const updatedChecklist = order.checklist.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          completed: !item.completed,
          completedAt: !item.completed ? new Date().toISOString() : undefined
        };
      }
      return item;
    });

    onUpdateOrder({
      ...order,
      checklist: updatedChecklist
    });
  };

  const handleRemoveChecklistItem = (itemId: string) => {
    if (!onUpdateOrder || !order.checklist) return;

    onUpdateOrder({
      ...order,
      checklist: order.checklist.filter(item => item.id !== itemId)
    });
  };

  const checklist = order.checklist || [];
  const completedChecklistCount = checklist.filter(i => i.completed).length;
  const photos = order.photos || [];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !onUpdateOrder) return;

    const newPhotos: Photo[] = [];
    let processedCount = 0;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          newPhotos.push({
            id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            url: event.target.result as string,
            name: file.name,
            uploadedAt: new Date().toISOString()
          });
        }
        processedCount++;
        
        if (processedCount === files.length) {
          onUpdateOrder({
            ...order,
            photos: [...(order.photos || []), ...newPhotos]
          });
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    if (!onUpdateOrder || !order.photos) return;

    onUpdateOrder({
      ...order,
      photos: order.photos.filter(p => p.id !== photoId)
    });
  };

  const handleStatusChange = () => {
    if (!onUpdateOrder) return;

    const now = new Date().toISOString();
    const newHistoryEntry = {
      status: newStatus,
      changedBy: changedBy.trim() || 'Sistema',
      changedAt: now,
      notes: statusNote.trim() || undefined
    };

    onUpdateOrder({
      ...order,
      status: newStatus,
      updatedAt: now,
      statusHistory: [...(order.statusHistory || []), newHistoryEntry]
    });

    setIsChangingStatus(false);
    setStatusNote('');
    setChangedBy('');
  };

  return (
    <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-surface flex justify-between items-center bg-page-bg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-primary">Detalhes da O.S {order.id}</h2>
              <p className="text-sm text-slate-500">
                Criada em {new Date(order.createdAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">
            &times;
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-surface bg-slate-50 flex items-start gap-3">
              <User size={18} className="text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Cliente</p>
                <p className="text-sm font-medium text-slate-900">{client?.name || 'N/A'}</p>
                {client?.phone && <p className="text-xs text-slate-500">{client.phone}</p>}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-surface bg-slate-50 flex items-start gap-3">
              <Wrench size={18} className="text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Responsável</p>
                <p className="text-sm font-medium text-slate-900">{employee?.name || 'Não atribuído'}</p>
                {employee?.role && <p className="text-xs text-slate-500">{employee.role}</p>}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-surface bg-slate-50 flex items-start gap-3">
              <Car size={18} className="text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Veículo</p>
                <p className="text-sm font-medium text-slate-900">{order.vehicle}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-slate-500 font-mono">{order.plate}</p>
                  {order.serviceCategory && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                      {order.serviceCategory}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-surface bg-slate-50 flex items-start gap-3 relative">
              <Calendar size={18} className="text-slate-400 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</p>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setShowStatusHistory(!showStatusHistory)}
                      className="p-1 text-slate-400 hover:text-primary transition-colors"
                      title="Ver Histórico"
                    >
                      <History size={14} />
                    </button>
                    <button 
                      onClick={() => {
                        setIsChangingStatus(true);
                        setNewStatus(order.status);
                      }}
                      className="p-1 text-slate-400 hover:text-primary transition-colors"
                      title="Alterar Status"
                    >
                      <Edit3 size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-block px-2 py-1 rounded-md text-xs font-medium bg-slate-200 text-slate-700">
                    {order.status}
                  </span>
                  {order.priority && (
                    <span className={cn(
                      "inline-block px-2 py-1 rounded-md text-xs font-medium",
                      order.priority === 'Baixa' ? "bg-slate-100 text-slate-600" :
                      order.priority === 'Média' ? "bg-blue-100 text-blue-700" :
                      order.priority === 'Alta' ? "bg-orange-100 text-orange-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {order.priority}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">{order.osType}</p>

                {/* Status History Popover */}
                {showStatusHistory && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-surface rounded-xl shadow-xl z-50 p-4 max-h-60 overflow-y-auto">
                    <div className="flex items-center justify-between mb-3 border-b border-surface pb-2">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Histórico de Status</h4>
                      <button onClick={() => setShowStatusHistory(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      {order.statusHistory?.slice().reverse().map((h, i) => (
                        <div key={i} className="flex gap-3 border-l-2 border-primary/30 pl-3 py-1">
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-primary">{h.status}</span>
                              <span className="text-[10px] text-slate-400">{new Date(h.changedAt).toLocaleString('pt-BR')}</span>
                            </div>
                            <p className="text-[10px] text-slate-500">Por: {h.changedBy}</p>
                            {h.notes && <p className="text-[10px] text-slate-600 italic mt-1 bg-slate-50 p-1 rounded">"{h.notes}"</p>}
                          </div>
                        </div>
                      ))}
                      {(!order.statusHistory || order.statusHistory.length === 0) && (
                        <p className="text-xs text-slate-400 italic text-center py-2">Nenhum histórico disponível</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Change Status Modal/Popover */}
                {isChangingStatus && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-surface rounded-xl shadow-xl z-50 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-surface pb-2">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Alterar Status</h4>
                      <button onClick={() => setIsChangingStatus(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Novo Status</label>
                      <select 
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as OSStatus)}
                        className="w-full px-3 py-1.5 bg-page-bg border border-surface rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        <option value="Em vistoria">Em Vistoria</option>
                        <option value="Aguardando Liberação">Aguardando Liberação</option>
                        <option value="Aguardando Peças">Aguardando Peças</option>
                        <option value="Em serviço">Em Serviço</option>
                        <option value="Veículo Pronto">Veículo Pronto</option>
                        <option value="Veículo Entregue">Veículo Entregue</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Quem está alterando?</label>
                      <input 
                        type="text"
                        value={changedBy}
                        onChange={(e) => setChangedBy(e.target.value)}
                        placeholder="Nome do colaborador"
                        className="w-full px-3 py-1.5 bg-page-bg border border-surface rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Nota (opcional)</label>
                      <textarea 
                        value={statusNote}
                        onChange={(e) => setStatusNote(e.target.value)}
                        placeholder="Motivo da alteração..."
                        className="w-full px-3 py-1.5 bg-page-bg border border-surface rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary h-16 resize-none"
                      />
                    </div>
                    <button 
                      onClick={handleStatusChange}
                      className="w-full py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      Confirmar Alteração
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {order.osType === 'Seguradora' && insurance && (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 flex items-start gap-3">
              <ShieldAlert size={18} className="text-amber-600 mt-0.5" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                <div>
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Seguradora</p>
                  <p className="text-sm font-medium text-amber-900">{insurance.name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Tipo de Sinistro</p>
                  <p className="text-sm font-medium text-amber-900">{order.insuranceClaimType}</p>
                </div>
                {order.insuranceClaimType === 'Segurado' && (
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Franquia</p>
                    <p className="text-sm font-medium text-amber-900">
                      {formatCurrency(order.deductibleAmount || 0)}
                      <span className={cn("ml-2 text-xs px-1.5 py-0.5 rounded", order.deductiblePaid ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                        {order.deductiblePaid ? 'Paga' : 'Pendente'}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Serviços */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 border-b border-surface pb-2">
                  <Wrench size={16} className="text-primary" />
                  Serviços a Realizar / Realizados
                </h3>
                <div className="bg-white rounded-xl border border-surface overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-page-bg border-b border-surface">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-slate-600">Descrição</th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-600">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface">
                      {order.services.map((s, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 text-slate-700">{s.name}</td>
                          <td className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(s.price)}</td>
                        </tr>
                      ))}
                      {order.services.length === 0 && (
                        <tr>
                          <td colSpan={2} className="px-4 py-4 text-center text-slate-400 italic">Nenhum serviço registrado</td>
                        </tr>
                      )}
                    </tbody>
                    {order.services.length > 0 && (
                      <tfoot className="bg-slate-50 border-t border-surface">
                        <tr>
                          <td className="px-4 py-2 text-right font-semibold text-slate-600">Subtotal Serviços:</td>
                          <td className="px-4 py-2 text-right font-bold text-slate-900">{formatCurrency(totalServices)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Peças */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 border-b border-surface pb-2">
                  <Package size={16} className="text-secondary" />
                  Peças Necessárias / Utilizadas
                </h3>
                <div className="bg-white rounded-xl border border-surface overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-page-bg border-b border-surface">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-slate-600">Peça</th>
                        <th className="px-4 py-2 text-center font-semibold text-slate-600">Qtd</th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-600">Unit.</th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-600">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface">
                      {order.parts.map((p, i) => {
                        const partDetails = parts.find(part => part.id === p.partId);
                        return (
                          <tr key={i}>
                            <td className="px-4 py-2 text-slate-700">{partDetails?.name || `Peça ID: ${p.partId}`}</td>
                            <td className="px-4 py-2 text-center text-slate-700">{p.quantity}</td>
                            <td className="px-4 py-2 text-right text-slate-700">{formatCurrency(p.price)}</td>
                            <td className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(p.price * p.quantity)}</td>
                          </tr>
                        );
                      })}
                      {order.parts.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-4 text-center text-slate-400 italic">Nenhuma peça registrada</td>
                        </tr>
                      )}
                    </tbody>
                    {order.parts.length > 0 && (
                      <tfoot className="bg-slate-50 border-t border-surface">
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-right font-semibold text-slate-600">Subtotal Peças:</td>
                          <td className="px-4 py-2 text-right font-bold text-slate-900">{formatCurrency(totalParts)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {order.observations && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-slate-700">Observações</h3>
                  <div className="p-4 bg-slate-50 rounded-xl border border-surface text-sm text-slate-700 whitespace-pre-wrap">
                    {order.observations}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {/* Financeiro */}
              <div className="bg-slate-50 rounded-xl border border-surface p-4 space-y-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 border-b border-surface pb-2">
                  <DollarSign size={16} className="text-emerald-600" />
                  Resumo Financeiro
                </h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Serviços:</span>
                    <span className="font-medium text-slate-900">{formatCurrency(totalServices)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Peças:</span>
                    <span className="font-medium text-slate-900">{formatCurrency(totalParts)}</span>
                  </div>
                  <div className="pt-2 border-t border-surface flex justify-between">
                    <span className="font-bold text-slate-700">Total da O.S:</span>
                    <span className="font-bold text-slate-900 text-lg">{formatCurrency(totalValue)}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-surface space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Valor Pago:</span>
                    <span className="font-medium text-emerald-600">{formatCurrency(amountPaid)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Falta Pagar:</span>
                    <span className={cn("font-medium", amountRemaining > 0 ? "text-red-500" : "text-slate-500")}>
                      {formatCurrency(amountRemaining)}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-center">
                    <span className={cn(
                      "inline-block px-2 py-1 rounded-full font-medium",
                      order.financialStatus === 'Pago' ? "bg-emerald-100 text-emerald-700" :
                      order.financialStatus === 'Parcialmente Pago' ? "bg-amber-100 text-amber-700" :
                      "bg-slate-200 text-slate-700"
                    )}>
                      {order.financialStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Checklist */}
              <div className="bg-white rounded-xl border border-surface p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-surface pb-2">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <CheckSquare size={16} className="text-primary" />
                    Checklist do Veículo
                  </h3>
                  {checklist.length > 0 && (
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                      {completedChecklistCount}/{checklist.length} concluídos
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Add new item */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem()}
                      placeholder="Novo item do checklist..."
                      className="flex-1 px-3 py-1.5 bg-page-bg border border-surface rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <button
                      onClick={handleAddChecklistItem}
                      disabled={!newChecklistItem.trim()}
                      className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  {/* Checklist Items */}
                  {checklist.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {checklist.map(item => (
                        <div 
                          key={item.id} 
                          className={cn(
                            "flex items-center justify-between p-2 rounded-lg border transition-colors group",
                            item.completed ? "bg-emerald-50 border-emerald-100" : "bg-white border-surface hover:border-primary/30"
                          )}
                        >
                          <div 
                            className="flex items-center gap-3 flex-1 cursor-pointer"
                            onClick={() => handleToggleChecklist(item.id)}
                          >
                            <div className={cn(
                              "w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors",
                              item.completed ? "bg-emerald-500 text-white" : "border-2 border-slate-300 text-transparent group-hover:border-primary/50"
                            )}>
                              <Check size={14} strokeWidth={3} />
                            </div>
                            <span className={cn(
                              "text-sm transition-all",
                              item.completed ? "text-emerald-700 line-through opacity-70" : "text-slate-700"
                            )}>
                              {item.name}
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveChecklistItem(item.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                            title="Remover item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <CheckSquare size={24} />
                      </div>
                      <p className="text-sm font-medium text-slate-600">Checklist vazio</p>
                      <p className="text-xs text-slate-400">Adicione itens para verificação do veículo.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Lembretes */}
              {order.reminders && order.reminders.length > 0 && (
                <div className="bg-white rounded-xl border border-surface p-4 space-y-4">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 border-b border-surface pb-2">
                    <Bell size={16} className="text-primary" />
                    Lembretes
                  </h3>
                  <div className="space-y-3">
                    {order.reminders.map(reminder => (
                      <div key={reminder.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-surface">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          reminder.type === 'Entrega' ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                        )}>
                          {reminder.type === 'Entrega' ? <Clock size={16} /> : <Calendar size={16} />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">{reminder.type}</span>
                              <span className="text-xs text-slate-500 font-medium">
                                {new Date(reminder.date).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            {onUpdateOrder && (
                              <button
                                onClick={() => {
                                  const updatedReminders = order.reminders?.map(r => 
                                    r.id === reminder.id ? { ...r, completed: !r.completed } : r
                                  );
                                  onUpdateOrder({ ...order, reminders: updatedReminders });
                                }}
                                className={cn(
                                  "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                                  reminder.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-primary"
                                )}
                              >
                                <Check size={12} strokeWidth={4} />
                              </button>
                            )}
                          </div>
                          {reminder.description && (
                            <p className={cn("text-xs mt-1", reminder.completed ? "text-slate-400 line-through" : "text-slate-600")}>
                              {reminder.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fotos */}
              <div className="bg-white rounded-xl border border-surface p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-surface pb-2">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <ImageIcon size={16} className="text-primary" />
                    Fotos do Veículo
                  </h3>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-lg hover:bg-primary/20 transition-colors"
                  >
                    <Upload size={14} />
                    Adicionar
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept="image/*" 
                    multiple 
                    className="hidden" 
                  />
                </div>

                {photos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photos.map(photo => (
                      <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden border border-surface bg-slate-50">
                        <img 
                          src={photo.url} 
                          alt={photo.name} 
                          className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
                          onClick={() => setFullscreenPhoto(photo.url)}
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePhoto(photo.id);
                            }}
                            className="p-1.5 bg-white/20 hover:bg-red-500 text-white rounded-md backdrop-blur-sm transition-colors"
                            title="Remover foto"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <ImageIcon size={24} />
                    </div>
                    <p className="text-sm font-medium text-slate-600">Nenhuma foto adicionada</p>
                    <p className="text-xs text-slate-400">Adicione fotos do estado do veículo.</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-surface bg-page-bg flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-700 font-medium hover:bg-slate-300 rounded-xl transition-colors text-sm"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Fullscreen Photo Modal */}
      {fullscreenPhoto && (
        <div 
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setFullscreenPhoto(null)}
        >
          <button 
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full transition-colors"
            onClick={() => setFullscreenPhoto(null)}
          >
            <X size={24} />
          </button>
          <img 
            src={fullscreenPhoto} 
            alt="Fullscreen view" 
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  );
}
