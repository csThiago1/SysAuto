import { useState } from 'react';
import { ServiceOrder, Person, FinancialStatus } from '../types';
import { formatCurrency, cn } from '../utils';
import { Search, DollarSign, FileText, CheckCircle2, AlertCircle, TrendingUp, ShieldAlert, User, Shield, Wrench } from 'lucide-react';
import { FilterBar } from './FilterBar';

type FinanceProps = {
  orders: ServiceOrder[];
  people: Person[];
};

export function Finance({ orders, people }: FinanceProps) {
  const [activeTab, setActiveTab] = useState<'A Faturar' | 'Faturadas'>('A Faturar');
  const [searchTerm, setSearchTerm] = useState('');

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
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      if (!o.id.toLowerCase().includes(searchLower) &&
          !o.vehicle.toLowerCase().includes(searchLower) &&
          !(o.invoiceNumber && o.invoiceNumber.toLowerCase().includes(searchLower))) {
        match = false;
      }
    }
    return match;
  });

  // Calculate KPIs
  const aFaturarOrders = filteredOrders.filter(o => o.financialStatus === 'A Faturar' && o.totalValue > 0);
  const faturadasOrders = filteredOrders.filter(o => ['Faturado', 'Em aberto', 'Parcialmente Pago', 'Pago'].includes(o.financialStatus));

  const totalAFaturar = aFaturarOrders.reduce((acc, o) => acc + o.totalValue, 0);
  
  const totalFaturado = faturadasOrders.reduce((acc, o) => acc + o.totalValue, 0);
  const totalRecebido = faturadasOrders.reduce((acc, o) => acc + o.amountPaid, 0);
  const totalAReceber = totalFaturado - totalRecebido;

  const displayedOrders = activeTab === 'A Faturar' ? aFaturarOrders : faturadasOrders;

  const getStatusColor = (status: FinancialStatus) => {
    switch (status) {
      case 'A Faturar': return 'bg-slate-100 text-slate-700';
      case 'Faturado': return 'bg-secondary/10 text-secondary';
      case 'Em aberto': return 'bg-amber-100 text-amber-700';
      case 'Parcialmente Pago': return 'bg-blue-100 text-blue-700';
      case 'Pago': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary tracking-tight">Financeiro</h1>
        <p className="text-slate-500 text-sm mt-1">Gestão de faturamento e recebimentos das Ordens de Serviço.</p>
      </div>

      <FilterBar 
        dateStart={dateStart} setDateStart={setDateStart}
        dateEnd={dateEnd} setDateEnd={setDateEnd}
        filterType={filterType} setFilterType={setFilterType}
        filterInsurance={filterInsurance} setFilterInsurance={setFilterInsurance}
        people={people}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-surface shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">A Faturar (Disponível)</p>
            <h3 className="text-2xl font-bold text-slate-900">{formatCurrency(totalAFaturar)}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-100 text-amber-600">
            <AlertCircle size={20} />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-surface shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">A Receber (Faturado)</p>
            <h3 className="text-2xl font-bold text-slate-900">{formatCurrency(totalAReceber)}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary/10 text-secondary">
            <TrendingUp size={20} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-surface shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Recebido</p>
            <h3 className="text-2xl font-bold text-slate-900">{formatCurrency(totalRecebido)}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-100 text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-surface shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-surface flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex bg-page-bg p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('A Faturar')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === 'A Faturar' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              A Faturar
            </button>
            <button
              onClick={() => setActiveTab('Faturadas')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === 'Faturadas' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Faturadas
            </button>
          </div>

          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por O.S, veículo ou NF..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-page-bg text-slate-500 font-medium border-b border-surface">
              <tr>
                <th className="px-6 py-4">O.S</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Status</th>
                {activeTab === 'Faturadas' && <th className="px-6 py-4">NF / Data</th>}
                {activeTab === 'Faturadas' && <th className="px-6 py-4">Condição Pagamento</th>}
                <th className="px-6 py-4 text-right">Valor Total</th>
                {activeTab === 'Faturadas' && <th className="px-6 py-4 text-right">Falta Receber</th>}
                <th className="px-6 py-4 text-center sticky right-0 bg-page-bg shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface">
              {displayedOrders.map(order => {
                const client = people.find(p => p.id === order.clientId);
                const insurance = order.insuranceCompanyId ? people.find(p => p.id === order.insuranceCompanyId) : null;
                const faltaReceber = order.totalValue - order.amountPaid;
                
                return (
                  <tr key={order.id} className="hover:bg-page-bg/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-900">{order.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0", 
                          order.osType === 'Seguradora' ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"
                        )}>
                          {order.osType === 'Seguradora' ? <Shield size={16} /> : <Wrench size={16} />}
                        </div>
                        {order.osType === 'Seguradora' && insurance && (
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-secondary">{insurance.name}</span>
                            <span className="text-[10px] text-secondary/70 uppercase tracking-wider">{order.insuranceClaimType}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-900 font-medium">{client?.name || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center", getStatusColor(order.financialStatus))}>
                        {order.financialStatus}
                      </span>
                    </td>
                    
                    {activeTab === 'Faturadas' && (
                      <td className="px-6 py-4">
                        <div className="text-slate-900 font-medium flex items-center gap-1.5">
                          <FileText size={14} className="text-slate-400" />
                          {order.invoiceNumber || 'N/A'}
                        </div>
                        <div className="text-slate-500 text-xs mt-0.5">
                          {order.billedAt ? new Date(order.billedAt).toLocaleDateString('pt-BR') : '-'}
                        </div>
                      </td>
                    )}

                    {activeTab === 'Faturadas' && (
                      <td className="px-6 py-4 text-slate-600">
                        {order.paymentMethod || '-'}
                      </td>
                    )}

                    <td className="px-6 py-4 text-right">
                      <div className="font-semibold text-slate-900">
                        {formatCurrency(order.totalValue)}
                      </div>
                      {order.deductibleAmount ? (
                        <div className="text-xs text-slate-500 mt-0.5">
                          Franquia: {formatCurrency(order.deductibleAmount)}
                          {order.deductiblePaid ? ' (Paga)' : ' (Pendente)'}
                        </div>
                      ) : null}
                    </td>

                    {activeTab === 'Faturadas' && (
                      <td className="px-6 py-4 text-right">
                        <span className={cn("font-semibold", faltaReceber > 0 ? "text-primary" : "text-emerald-600")}>
                          {formatCurrency(faltaReceber)}
                        </span>
                      </td>
                    )}

                    <td className="px-6 py-4 sticky right-0 bg-white group-hover:bg-page-bg/50 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)] transition-colors">
                      <div className="flex items-center justify-center gap-2">
                        {activeTab === 'A Faturar' ? (
                          <button className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5">
                            <DollarSign size={14} />
                            Faturar
                          </button>
                        ) : (
                          <button className="px-3 py-1.5 bg-page-bg text-slate-600 hover:bg-surface rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 border border-surface">
                            Detalhes
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayedOrders.length === 0 && (
                <tr>
                  <td colSpan={activeTab === 'Faturadas' ? 9 : 6} className="px-6 py-12 text-center text-slate-500">
                    Nenhuma ordem de serviço encontrada nesta categoria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
