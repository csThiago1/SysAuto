import React, { useState } from 'react';
import { ServiceOrder, Person, OSStatus, Part, OSTemplate } from '../types';
import { formatCurrency, cn } from '../utils';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, User, Car, Wrench } from 'lucide-react';

type AgendaProps = {
  orders: ServiceOrder[];
  people: Person[];
  parts: Part[];
  addOrder: (order: any) => void;
  updateOrder: (order: ServiceOrder) => void;
  templates: OSTemplate[];
  onNewOS: (date: string) => void;
};

export function Agenda({ orders, people, parts, addOrder, updateOrder, templates, onNewOS }: AgendaProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = [];
  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);

  // Previous month days
  const prevMonthDays = daysInMonth(year, month - 1);
  for (let i = startDay - 1; i >= 0; i--) {
    days.push({ day: prevMonthDays - i, currentMonth: false, date: new Date(year, month - 1, prevMonthDays - i) });
  }

  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    days.push({ day: i, currentMonth: true, date: new Date(year, month, i) });
  }

  // Next month days
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    days.push({ day: i, currentMonth: false, date: new Date(year, month + 1, i) });
  }

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const getOrdersForDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return orders.filter(o => {
      const orderDate = o.scheduledDate || o.createdAt.split('T')[0];
      return orderDate === dateString;
    });
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Agenda de Serviços</h1>
          <p className="text-slate-500 text-sm mt-1">Visualize e gerencie os agendamentos da oficina.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={goToToday}
            className="px-4 py-2 bg-white border border-surface text-slate-600 font-medium hover:bg-surface rounded-xl transition-colors text-sm"
          >
            Hoje
          </button>
          <div className="flex items-center bg-white border border-surface rounded-xl overflow-hidden">
            <button onClick={prevMonth} className="p-2 hover:bg-surface text-slate-600 transition-colors border-r border-surface">
              <ChevronLeft size={20} />
            </button>
            <div className="px-4 py-2 font-bold text-slate-700 min-w-[150px] text-center">
              {monthNames[month]} {year}
            </div>
            <button onClick={nextMonth} className="p-2 hover:bg-surface text-slate-600 transition-colors border-l border-surface">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white border border-surface rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="grid grid-cols-7 border-b border-surface bg-slate-50">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 grid-rows-6">
          {days.map((d, i) => {
            const dateOrders = getOrdersForDate(d.date);
            const isToday = d.date.toDateString() === new Date().toDateString();
            
            return (
              <div 
                key={i} 
                className={cn(
                  "border-r border-b border-surface p-2 flex flex-col gap-1 min-h-[100px] hover:bg-slate-50 transition-colors cursor-pointer group",
                  !d.currentMonth && "bg-slate-50/50 text-slate-300"
                )}
                onClick={() => setSelectedDate(d.date)}
              >
                <div className="flex justify-between items-start">
                  <span className={cn(
                    "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full",
                    isToday ? "bg-primary text-white" : d.currentMonth ? "text-slate-700" : "text-slate-300"
                  )}>
                    {d.day}
                  </span>
                  <button className="opacity-0 group-hover:opacity-100 p-1 text-primary hover:bg-primary/10 rounded transition-all">
                    <Plus size={14} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 mt-1">
                  {dateOrders.slice(0, 3).map(order => (
                    <div 
                      key={order.id}
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-medium truncate border",
                        order.status === 'Veículo Pronto' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                        order.status === 'Em serviço' ? "bg-blue-50 text-blue-700 border-blue-100" :
                        "bg-slate-50 text-slate-600 border-slate-200"
                      )}
                      title={`${order.id} - ${order.vehicle}`}
                    >
                      {order.plate} - {order.vehicle}
                    </div>
                  ))}
                  {dateOrders.length > 3 && (
                    <div className="text-[9px] text-slate-400 font-bold pl-1">
                      + {dateOrders.length - 3} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Details Sidebar/Modal */}
      {selectedDate && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-end z-50">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
            <div className="p-6 border-b border-surface flex justify-between items-center bg-page-bg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <CalendarIcon size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary">Agenda: {selectedDate.toLocaleDateString('pt-BR')}</h2>
                  <p className="text-sm text-slate-500">{getOrdersForDate(selectedDate).length} serviços agendados</p>
                </div>
              </div>
              <button onClick={() => setSelectedDate(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <button 
                className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                onClick={() => {
                  onNewOS(selectedDate.toISOString().split('T')[0]);
                }}
              >
                <Plus size={18} />
                Agendar Novo Serviço
              </button>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Serviços do Dia</h3>
                {getOrdersForDate(selectedDate).length > 0 ? (
                  getOrdersForDate(selectedDate).map(order => {
                    const client = people.find(p => p.id === order.clientId);
                    return (
                      <div key={order.id} className="p-4 bg-slate-50 border border-surface rounded-xl hover:border-primary/30 transition-all group">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary">{order.id}</span>
                            <span className="text-xs font-medium text-slate-900 bg-white px-2 py-0.5 rounded border border-surface">
                              {order.plate}
                            </span>
                          </div>
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter",
                            order.status === 'Veículo Pronto' ? "bg-emerald-100 text-emerald-700" :
                            order.status === 'Em serviço' ? "bg-blue-100 text-blue-700" :
                            "bg-slate-200 text-slate-600"
                          )}>
                            {order.status}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm">{order.vehicle}</h4>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                          <User size={12} />
                          <span>{client?.name}</span>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface/50">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                            <Wrench size={10} />
                            {order.services.length} SERVIÇOS
                          </div>
                          <span className="text-sm font-bold text-slate-900">{formatCurrency(order.totalValue)}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-surface rounded-2xl">
                    <Clock size={32} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500 font-medium">Nenhum serviço agendado</p>
                    <p className="text-xs text-slate-400">Clique no botão acima para agendar.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
