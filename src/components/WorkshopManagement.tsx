import { useState } from 'react';
import { Person, ServiceOrder, EmployeeRole } from '../types';
import { Search, User, Wrench, Clock, CheckCircle2, AlertCircle, Filter, Timer, UserPlus, X } from 'lucide-react';
import { cn } from '../utils';
import { differenceInDays, differenceInHours } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

type WorkshopManagementProps = {
  people: Person[];
  orders: ServiceOrder[];
  updateOrder: (order: ServiceOrder) => void;
};

export function WorkshopManagement({ people, orders, updateOrder }: WorkshopManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<EmployeeRole | 'Todos'>('Todos');
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('Todos');
  const [activeAssignMenu, setActiveAssignMenu] = useState<string | null>(null);

  const employees = people.filter(p => p.type === 'Colaborador');
  
  const filteredEmployees = employees.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'Todos' || e.role === filterRole;
    const matchesEmployee = filterEmployeeId === 'Todos' || e.id === filterEmployeeId;
    return matchesSearch && matchesRole && matchesEmployee;
  });

  const getEmployeeOrders = (employeeId: string) => {
    return orders.filter(o => o.assignedEmployeeId === employeeId && o.status !== 'Veículo Entregue');
  };

  const getTimeInService = (order: ServiceOrder) => {
    const now = new Date('2026-03-05T16:47:44-08:00');
    
    // Tenta encontrar a última alteração para o status atual no histórico
    const latestChange = order.statusHistory
      ?.filter(h => h.status === order.status)
      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())[0];
      
    const start = latestChange ? new Date(latestChange.changedAt) : new Date(order.createdAt);
    
    const days = differenceInDays(now, start);
    if (days > 0) {
      return `${days} ${days === 1 ? 'dia' : 'dias'} em serviço`;
    }
    
    const hours = differenceInHours(now, start);
    if (hours > 0) {
      return `${hours} ${hours === 1 ? 'hora' : 'horas'} em serviço`;
    }
    
    return 'Iniciado agora';
  };

  const roles: EmployeeRole[] = ['Consultor', 'Mecânico', 'Funileiro', 'Pintor', 'Montador', 'Polidor', 'Lavador'];

  const unassignedOrders = orders.filter(o => !o.assignedEmployeeId && o.status !== 'Veículo Entregue');

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Gestão de Oficina (Chão de Fábrica)</h1>
          <p className="text-slate-500 text-sm mt-1">Monitore a produtividade e atribuições dos colaboradores.</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-surface rounded-2xl p-4 flex items-center gap-6 shadow-sm mb-6 flex-wrap">
        <div className="flex items-center gap-2 text-slate-700 font-medium">
          <Filter size={18} className="text-primary" />
          Filtros:
        </div>
        
        <div className="flex items-center gap-4 flex-1 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar colaborador..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <div className="relative flex-1 max-w-xs">
            <select
              value={filterEmployeeId}
              onChange={(e) => setFilterEmployeeId(e.target.value)}
              className="w-full px-4 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none"
            >
              <option value="Todos">Todos os Colaboradores</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <User size={16} className="text-slate-400" />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setFilterRole('Todos')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                filterRole === 'Todos' ? "bg-primary text-white" : "bg-page-bg text-slate-600 hover:bg-surface"
              )}
            >
              Todos
            </button>
            {roles.map(role => (
              <button
                key={role}
                onClick={() => setFilterRole(role)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                  filterRole === role ? "bg-primary text-white" : "bg-page-bg text-slate-600 hover:bg-surface"
                )}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Employee Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployees.map(employee => {
          const activeOrders = getEmployeeOrders(employee.id);
          const inService = activeOrders.filter(o => o.status === 'Em serviço').length;
          const waiting = activeOrders.filter(o => o.status === 'Aguardando Peças' || o.status === 'Aguardando Liberação').length;

          return (
            <div key={employee.id} className="bg-white rounded-2xl border border-surface shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-surface flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  {employee.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{employee.name}</h3>
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    {employee.role || 'Colaborador'}
                  </span>
                </div>
              </div>
              
              <div className="p-5 flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-page-bg p-3 rounded-xl border border-surface">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                      <Wrench size={14} className="text-primary" />
                      Em Execução
                    </div>
                    <div className="text-xl font-bold text-slate-900">{inService}</div>
                  </div>
                  <div className="bg-page-bg p-3 rounded-xl border border-surface">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                      <Clock size={14} className="text-secondary" />
                      Pendentes
                    </div>
                    <div className="text-xl font-bold text-slate-900">{waiting}</div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Veículos Atuais</h4>
                  <div className="space-y-2">
                    {activeOrders.slice(0, 3).map(order => (
                      <div key={order.id} className="flex items-center justify-between p-2 hover:bg-page-bg rounded-lg transition-colors border border-transparent hover:border-surface">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900">{order.vehicle}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500 font-mono">{order.plate}</span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                              <Timer size={10} />
                              {getTimeInService(order)}
                            </span>
                          </div>
                        </div>
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                          order.status === 'Em serviço' ? "bg-primary/10 text-primary" : "bg-page-bg text-slate-600"
                        )}>
                          {order.status}
                        </span>
                      </div>
                    ))}
                    {activeOrders.length === 0 && (
                      <div className="text-center py-4 text-slate-400 text-sm italic">
                        Sem veículos atribuídos
                      </div>
                    )}
                    {activeOrders.length > 3 && (
                      <div className="text-center text-[10px] text-slate-400 font-medium">
                        + {activeOrders.length - 3} outros veículos
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-page-bg border-t border-surface flex justify-between items-center relative">
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    inService > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                  )}></div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    {inService > 0 ? 'Ocupado' : 'Disponível'}
                  </span>
                </div>
                <div className="relative">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveAssignMenu(activeAssignMenu === employee.id ? null : employee.id);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-xs font-bold rounded-lg hover:bg-primary/20 transition-colors"
                  >
                    <UserPlus size={14} />
                    Atribuir O.S
                  </button>

                  <AnimatePresence>
                    {activeAssignMenu === employee.id && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute bottom-full right-0 mb-2 w-64 bg-white border border-surface rounded-xl shadow-xl z-50 py-1 max-h-60 overflow-y-auto"
                      >
                        <div className="px-3 py-2 border-b border-surface flex justify-between items-center bg-page-bg sticky top-0">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            Atribuir O.S a {employee.name.split(' ')[0]}
                          </p>
                          <button onClick={() => setActiveAssignMenu(null)} className="text-slate-400 hover:text-slate-600">
                            <X size={14} />
                          </button>
                        </div>
                        
                        {/* Remover atribuição das O.S atuais */}
                        {activeOrders.length > 0 && (
                          <div className="py-1 border-b border-surface">
                            <p className="px-3 py-1 text-[10px] font-semibold text-slate-400">Remover Atribuição</p>
                            {activeOrders.map(order => (
                              <button
                                key={`remove-${order.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateOrder({ ...order, assignedEmployeeId: undefined });
                                  setActiveAssignMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors flex justify-between items-center group"
                              >
                                <span>{order.vehicle} ({order.plate})</span>
                                <X size={12} className="opacity-0 group-hover:opacity-100" />
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Atribuir novas O.S */}
                        <div className="py-1">
                          <p className="px-3 py-1 text-[10px] font-semibold text-slate-400">O.S Não Atribuídas</p>
                          {unassignedOrders.length > 0 ? (
                            unassignedOrders.map(order => (
                              <button
                                key={`assign-${order.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateOrder({ ...order, assignedEmployeeId: employee.id });
                                  setActiveAssignMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-page-bg hover:text-primary transition-colors flex flex-col"
                              >
                                <span>{order.vehicle}</span>
                                <span className="text-[10px] text-slate-400">{order.plate} - {order.status}</span>
                              </button>
                            ))
                          ) : (
                            <p className="px-3 py-2 text-xs text-slate-400 italic text-center">Nenhuma O.S disponível</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Backdrop */}
      {activeAssignMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setActiveAssignMenu(null)} />
      )}
    </div>
  );
}
