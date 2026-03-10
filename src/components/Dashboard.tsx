import { useState } from 'react';
import { ServiceOrder, Person, Part } from '../types';
import { formatCurrency, cn } from '../utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Wrench, Car, DollarSign, Target, Download, Calendar, ArrowRight, Clock, User } from 'lucide-react';
import { FilterBar } from './FilterBar';

type DashboardProps = {
  orders: ServiceOrder[];
  people: Person[];
  parts: Part[];
  onViewAgenda?: () => void;
};

const COLORS = ['#BF4646', '#7EACB5', '#EDDCC6', '#BF4646aa', '#7EACB5aa', '#EDDCC6aa'];

export function Dashboard({ orders, people, parts, onViewAgenda }: DashboardProps) {
  // Filter State
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [filterType, setFilterType] = useState('Todas');
  const [filterInsurance, setFilterInsurance] = useState('');

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

  // Agenda do Dia
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => {
    const orderDate = o.scheduledDate || o.createdAt.split('T')[0];
    return orderDate === today;
  });

  // Calculate KPIs
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthOrders = filteredOrders.filter(o => {
    const d = new Date(o.createdAt);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const faturamentoMes = monthOrders.reduce((acc, o) => acc + o.totalValue, 0);
  const carrosEntregues = monthOrders.filter(o => o.status === 'Veículo Entregue').length;
  const carrosAutorizados = monthOrders.filter(o => o.status !== 'Em vistoria' && o.status !== 'Aguardando Liberação').length;
  const ticketMedio = monthOrders.length > 0 ? faturamentoMes / monthOrders.length : 0;

  const metaFaturamento = 10000; // Example goal
  const percentualMeta = Math.min(Math.round((faturamentoMes / metaFaturamento) * 100), 100);

  // Chart Data: Status Distribution
  const statusCount = filteredOrders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(statusCount).map(([name, value]) => ({ name, value }));

  // Chart Data: Revenue by Month
  let barData: { name: string, Faturamento: number }[] = [];
  
  if (filteredOrders.length > 0) {
    const timestamps = filteredOrders.map(o => new Date(o.createdAt).getTime());
    const minDate = new Date(Math.min(...timestamps));
    const maxDate = new Date(Math.max(...timestamps));
    
    // Start from the first day of the min month
    const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    
    const revenueByMonthMap = filteredOrders.reduce((acc, order) => {
      const date = new Date(order.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      acc[key] = (acc[key] || 0) + order.totalValue;
      return acc;
    }, {} as Record<string, number>);

    while (current <= end) {
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      barData.push({
        name: current.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }),
        Faturamento: revenueByMonthMap[key] || 0
      });
      current.setMonth(current.getMonth() + 1);
    }
  } else {
    const d = new Date();
    barData = [{
      name: d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }),
      Faturamento: 0
    }];
  }

  // Chart Data: Revenue by Employee (Current Month)
  const employeeRevenueMap = monthOrders.reduce((acc, order) => {
    if (order.assignedEmployeeId) {
      const employee = people.find(p => p.id === order.assignedEmployeeId);
      if (employee && employee.role === 'Consultor') {
        acc[order.assignedEmployeeId] = (acc[order.assignedEmployeeId] || 0) + order.totalValue;
      }
    }
    return acc;
  }, {} as Record<string, number>);

  const employeeRevenueData = Object.entries(employeeRevenueMap)
    .map(([employeeId, revenue]) => {
      const employee = people.find(p => p.id === employeeId);
      return {
        name: employee ? employee.name.split(' ')[0] : 'Desconhecido',
        Faturamento: revenue
      };
    })
    .sort((a, b) => b.Faturamento - a.Faturamento); // Sort by highest revenue

  const exportEmployeeRevenueCSV = () => {
    const headers = ['Consultor', 'Faturamento (R$)'];
    const csvContent = [
      headers.join(','),
      ...employeeRevenueData.map(row => `"${row.name}",${row.Faturamento.toFixed(2)}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `faturamento_consultores_${currentMonth + 1}_${currentYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportMonthlyRevenueCSV = () => {
    const headers = ['Mês', 'Faturamento (R$)'];
    const csvContent = [
      headers.join(','),
      ...barData.map(row => `"${row.name}",${row.Faturamento.toFixed(2)}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `faturamento_mensal.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportStatusCSV = () => {
    const headers = ['Status', 'Quantidade'];
    const csvContent = [
      headers.join(','),
      ...pieData.map(row => `"${row.name}",${row.value}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `status_os.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Visão geral do desempenho da oficina.</p>
        </div>
        {onViewAgenda && (
          <button 
            onClick={onViewAgenda}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <Calendar size={18} />
            Ver Agenda Completa
          </button>
        )}
      </div>

      <FilterBar 
        dateStart={dateStart} setDateStart={setDateStart}
        dateEnd={dateEnd} setDateEnd={setDateEnd}
        filterType={filterType} setFilterType={setFilterType}
        filterInsurance={filterInsurance} setFilterInsurance={setFilterInsurance}
        people={people}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KPIs Column */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <KpiCard 
            title="Faturamento (Mês)" 
            value={formatCurrency(faturamentoMes)} 
            icon={DollarSign} 
            color="text-primary" 
            bg="bg-primary/10"
          />
          <KpiCard 
            title="Ticket Médio" 
            value={formatCurrency(ticketMedio)} 
            icon={Target} 
            color="text-secondary" 
            bg="bg-secondary/10"
          />
          <KpiCard 
            title="Carros Entregues" 
            value={carrosEntregues.toString()} 
            icon={Car} 
            color="text-primary" 
            bg="bg-primary/10"
          />
          <KpiCard 
            title="O.S Autorizadas" 
            value={carrosAutorizados.toString()} 
            icon={Wrench} 
            color="text-secondary" 
            bg="bg-secondary/10"
          />
        </div>

        {/* Agenda do Dia Widget */}
        <div className="bg-white p-6 rounded-2xl border border-surface shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Calendar size={18} className="text-primary" />
              Agenda do Dia
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {new Date().toLocaleDateString('pt-BR')}
            </span>
          </div>
          
          <div className="flex-1 space-y-3 overflow-y-auto max-h-[200px] pr-2">
            {todayOrders.length > 0 ? (
              todayOrders.map(order => {
                const client = people.find(p => p.id === order.clientId);
                return (
                  <div key={order.id} className="p-3 bg-slate-50 border border-surface rounded-xl hover:border-primary/30 transition-all group cursor-pointer" onClick={onViewAgenda}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-bold text-primary">{order.id}</span>
                      <span className="text-[10px] font-medium text-slate-500">{order.plate}</span>
                    </div>
                    <h4 className="font-bold text-slate-800 text-xs truncate">{order.vehicle}</h4>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500">
                      <User size={10} />
                      <span className="truncate">{client?.name}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-6 text-center">
                <Clock size={24} className="text-slate-300 mb-2" />
                <p className="text-xs text-slate-500 font-medium">Nenhum serviço para hoje</p>
              </div>
            )}
          </div>
          
          <button 
            onClick={onViewAgenda}
            className="mt-4 w-full py-2 text-xs font-bold text-primary hover:bg-primary/5 rounded-lg transition-all flex items-center justify-center gap-1.5 border border-primary/20"
          >
            Acessar Agenda
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Goal Progress */}
      <div className="bg-white p-6 rounded-2xl border border-surface shadow-sm">
        <div className="flex justify-between items-end mb-2">
          <div>
            <h3 className="text-sm font-medium text-slate-500">Meta de Faturamento</h3>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {formatCurrency(faturamentoMes)} <span className="text-sm font-normal text-slate-400">/ {formatCurrency(metaFaturamento)}</span>
            </div>
          </div>
          <div className="text-sm font-medium text-slate-600">
            {percentualMeta}%
          </div>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div 
            className="bg-primary h-3 rounded-full transition-all duration-500" 
            style={{ width: `${percentualMeta}%` }}
          ></div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Faltam {formatCurrency(Math.max(0, metaFaturamento - faturamentoMes))} para atingir a meta do mês.
        </p>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-surface shadow-sm lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-semibold text-slate-900">Faturamento por Mês</h3>
            <button 
              onClick={exportMonthlyRevenueCSV}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-page-bg hover:bg-surface px-3 py-1.5 rounded-lg transition-colors"
              title="Exportar para CSV"
            >
              <Download size={14} />
              Exportar CSV
            </button>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `R$${value}`} />
                <Tooltip 
                  cursor={{ fill: '#FFF4EA' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                />
                <Bar dataKey="Faturamento" fill="#BF4646" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-surface shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-semibold text-slate-900">Status das O.S</h3>
            <button 
              onClick={exportStatusCSV}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-page-bg hover:bg-surface px-3 py-1.5 rounded-lg transition-colors"
              title="Exportar para CSV"
            >
              <Download size={14} />
              Exportar CSV
            </button>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                {entry.name} ({entry.value})
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-surface shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-semibold text-slate-900">Faturamento por Consultor (Mês Atual)</h3>
            <button 
              onClick={exportEmployeeRevenueCSV}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-page-bg hover:bg-surface px-3 py-1.5 rounded-lg transition-colors"
              title="Exportar para CSV"
            >
              <Download size={14} />
              Exportar CSV
            </button>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employeeRevenueData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `R$${value}`} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={100} />
                <Tooltip 
                  cursor={{ fill: '#FFF4EA' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                />
                <Bar dataKey="Faturamento" fill="#7EACB5" radius={[0, 4, 4, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-surface shadow-sm flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg} ${color}`}>
        <Icon size={20} />
      </div>
    </div>
  );
}
