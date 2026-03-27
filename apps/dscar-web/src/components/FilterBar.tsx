import { Calendar, Filter } from 'lucide-react';
import { Person } from '../types';

type FilterBarProps = {
  dateStart: string;
  setDateStart: (val: string) => void;
  dateEnd: string;
  setDateEnd: (val: string) => void;
  filterType: string;
  setFilterType: (val: string) => void;
  filterInsurance: string;
  setFilterInsurance: (val: string) => void;
  filterStatus?: string;
  setFilterStatus?: (val: string) => void;
  people: Person[];
};

export function FilterBar({
  dateStart, setDateStart,
  dateEnd, setDateEnd,
  filterType, setFilterType,
  filterInsurance, setFilterInsurance,
  filterStatus, setFilterStatus,
  people
}: FilterBarProps) {
  const insurances = people.filter(p => p.type === 'Seguradora');

  return (
    <div className="bg-white border border-surface rounded-2xl p-4 flex items-center gap-6 shadow-sm mb-6 flex-wrap">
      <div className="flex items-center gap-2 text-slate-700 font-medium">
        <Filter size={18} className="text-primary" />
        Filtros:
      </div>
      
      <div className="flex items-center gap-4 flex-1 flex-wrap">
        <div className="flex items-center gap-2 bg-page-bg border border-surface rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
          <Calendar size={16} className="text-slate-400" />
          <input 
            type="date" 
            value={dateStart}
            onChange={e => setDateStart(e.target.value)}
            className="text-sm bg-transparent outline-none text-slate-700"
          />
          <span className="text-slate-400 text-sm">até</span>
          <input 
            type="date" 
            value={dateEnd}
            onChange={e => setDateEnd(e.target.value)}
            className="text-sm bg-transparent outline-none text-slate-700"
          />
        </div>

        <select 
          value={filterType}
          onChange={e => {
            setFilterType(e.target.value);
            if (e.target.value === 'Particular') setFilterInsurance('');
          }}
          className="text-sm border border-surface rounded-xl px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white text-slate-700 transition-all"
        >
          <option value="Todas">Todos os Tipos</option>
          <option value="Particular">Particular</option>
          <option value="Seguradora">Seguradora</option>
        </select>

        <select 
          value={filterInsurance}
          onChange={e => setFilterInsurance(e.target.value)}
          disabled={filterType === 'Particular'}
          className="text-sm border border-surface rounded-xl px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white text-slate-700 disabled:bg-slate-50 disabled:text-slate-400 transition-all"
        >
          <option value="">Todas as Seguradoras</option>
          {insurances.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>

        {filterStatus !== undefined && setFilterStatus && (
          <select 
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-sm border border-surface rounded-xl px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white text-slate-700 transition-all"
          >
            <option value="Todos">Todos os Status</option>
            <option value="Em vistoria">Em vistoria</option>
            <option value="Aguardando Liberação">Aguardando Liberação</option>
            <option value="Aguardando Peças">Aguardando Peças</option>
            <option value="Em serviço">Em serviço</option>
            <option value="Veículo Pronto">Veículo Pronto</option>
            <option value="Veículo Entregue">Veículo Entregue</option>
          </select>
        )}
        
        {(dateStart || dateEnd || filterType !== 'Todas' || filterInsurance || (filterStatus && filterStatus !== 'Todos')) && (
          <button 
            onClick={() => {
              setDateStart('');
              setDateEnd('');
              setFilterType('Todas');
              setFilterInsurance('');
              if (setFilterStatus) setFilterStatus('Todos');
            }}
            className="text-sm text-primary hover:text-primary/80 font-medium ml-auto px-3 py-1.5 hover:bg-primary/10 rounded-lg transition-colors"
          >
            Limpar Filtros
          </button>
        )}
      </div>
    </div>
  );
}
