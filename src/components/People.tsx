import { useState, useEffect } from 'react';
import { Person, PersonType, ServiceOrder, Part } from '../types';
import { Plus, Search, MoreVertical, UserPlus, Phone, Mail, Car, Wrench, Calendar, DollarSign, X, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, formatCurrency } from '../utils';
import { ClientHistoryModal } from './ClientHistoryModal';

type PeopleProps = {
  people: Person[];
  orders: ServiceOrder[];
  parts: Part[];
  updatePerson: (person: Person) => void;
};

export function People({ people, orders, parts, updatePerson }: PeopleProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<PersonType | 'Todos'>('Todos');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<Person | null>(null);
  const [editedPerson, setEditedPerson] = useState<Partial<Person>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  const handleEditPerson = (person: Person) => {
    setSelectedPerson(person);
    setEditedPerson(person);
    setIsEditing(false);
  };

  const handleSavePerson = () => {
    if (selectedPerson && editedPerson) {
      const updatedPerson = { ...selectedPerson, ...editedPerson } as Person;
      setSelectedPerson(updatedPerson);
      updatePerson(updatedPerson);
      setIsEditing(false);
    }
  };

  const filteredPeople = people.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'Todos' || p.type === filterType;
    return matchesSearch && matchesType;
  });

  const totalPages = Math.ceil(filteredPeople.length / itemsPerPage);
  const paginatedPeople = filteredPeople.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getTypeColor = (type: PersonType) => {
    switch (type) {
      case 'Cliente': return 'bg-primary/10 text-primary';
      case 'Colaborador': return 'bg-emerald-100 text-emerald-700';
      case 'Seguradora': return 'bg-secondary/10 text-secondary';
      case 'Corretor': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getCustomerVehicles = (clientId: string) => {
    const customerOrders = orders.filter(o => o.clientId === clientId);
    const vehicles = new Set(customerOrders.map(o => o.vehicle));
    return Array.from(vehicles).map(vehicleName => {
      const vehicleOrders = customerOrders.filter(o => o.vehicle === vehicleName);
      // Assume the plate is consistent for the vehicle name, grab the first one
      const plate = vehicleOrders[0]?.plate || 'N/A';
      return {
        name: vehicleName,
        plate,
        orders: vehicleOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      };
    });
  };

  const handleRowClick = (person: Person) => {
    if (person.type === 'Cliente') {
      setSelectedClientForHistory(person);
    } else {
      handleEditPerson(person);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Pessoas</h1>
          <p className="text-slate-500 text-sm mt-1">Gerencie clientes, colaboradores, seguradoras e corretores.</p>
        </div>
        <button className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm">
          <UserPlus size={18} />
          Novo Cadastro
        </button>
      </div>

      <div className="bg-white border border-surface rounded-2xl p-4 flex items-center gap-6 shadow-sm mb-6 flex-wrap">
        <div className="flex items-center gap-2 text-slate-700 font-medium">
          <Search size={18} className="text-primary" />
          Filtros:
        </div>
        
        <div className="flex items-center gap-4 flex-1 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <div className="flex gap-2">
            {['Todos', 'Cliente', 'Colaborador', 'Seguradora', 'Corretor'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type as any)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                  filterType === type 
                    ? "bg-primary text-white" 
                    : "bg-page-bg text-slate-600 hover:bg-surface"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-surface shadow-sm flex-1 flex flex-col overflow-hidden">

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-page-bg text-slate-500 font-medium border-b border-surface">
              <tr>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface">
              {paginatedPeople.map(person => (
                <tr 
                  key={person.id} 
                  className="hover:bg-page-bg/50 transition-colors cursor-pointer"
                  onClick={() => handleRowClick(person)}
                >
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-primary font-bold text-xs uppercase">
                        {person.name.substring(0, 2)}
                      </div>
                      {person.name}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center", getTypeColor(person.type))}>
                      {person.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone size={14} className="text-slate-400" />
                        {person.phone}
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Mail size={14} className="text-slate-400" />
                        {person.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {person.type === 'Cliente' && (
                        <button 
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClientForHistory(person);
                          }}
                          title="Ver Histórico"
                        >
                          <History size={16} />
                        </button>
                      )}
                      <button 
                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditPerson(person);
                        }}
                        title="Editar"
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedPeople.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    Nenhuma pessoa encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="p-4 border-t border-surface flex items-center justify-between bg-page-bg/50">
            <span className="text-sm text-slate-500">
              Mostrando <span className="font-medium text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> até <span className="font-medium text-slate-900">{Math.min(currentPage * itemsPerPage, filteredPeople.length)}</span> de <span className="font-medium text-slate-900">{filteredPeople.length}</span> resultados
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-surface text-slate-600 hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                      currentPage === i + 1
                        ? "bg-primary text-white"
                        : "text-slate-600 hover:bg-surface"
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-surface text-slate-600 hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detalhes do Cliente Modal */}
      {selectedPerson && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-surface flex justify-between items-start bg-page-bg">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white border border-surface flex items-center justify-center text-primary font-bold text-2xl uppercase shadow-sm">
                  {selectedPerson.name.substring(0, 2)}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-primary">{selectedPerson.name}</h2>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center", getTypeColor(selectedPerson.type))}>
                      {selectedPerson.type}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button onClick={() => setIsEditing(false)} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-surface transition-colors">
                      Cancelar
                    </button>
                    <button onClick={handleSavePerson} className="text-sm bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors">
                      Salvar
                    </button>
                  </>
                ) : (
                  <button onClick={() => setIsEditing(true)} className="text-sm text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors font-medium">
                    Editar
                  </button>
                )}
                <button onClick={() => setSelectedPerson(null)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-surface rounded-xl transition-colors ml-2">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-white">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Informações de Contato</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">E-mail</label>
                    {isEditing ? (
                      <input 
                        type="email" 
                        value={editedPerson.email || ''} 
                        onChange={e => setEditedPerson({...editedPerson, email: e.target.value})}
                        className="w-full px-3 py-2 bg-white border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-slate-700">
                        <Mail size={16} className="text-slate-400" />
                        {selectedPerson.email || '-'}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Telefone</label>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={editedPerson.phone || ''} 
                        onChange={e => setEditedPerson({...editedPerson, phone: e.target.value})}
                        className="w-full px-3 py-2 bg-white border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-slate-700">
                        <Phone size={16} className="text-slate-400" />
                        {selectedPerson.phone || '-'}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Data de Nascimento</label>
                    {isEditing ? (
                      <input 
                        type="date" 
                        value={editedPerson.birthDate || ''} 
                        onChange={e => setEditedPerson({...editedPerson, birthDate: e.target.value})}
                        className="w-full px-3 py-2 bg-white border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-slate-700">
                        <Calendar size={16} className="text-slate-400" />
                        {selectedPerson.birthDate ? new Date(selectedPerson.birthDate).toLocaleDateString('pt-BR') : '-'}
                      </div>
                    )}
                  </div>
                  {selectedPerson.type === 'Colaborador' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Cargo / Função</label>
                      {isEditing ? (
                        <select 
                          value={editedPerson.role || ''} 
                          onChange={e => setEditedPerson({...editedPerson, role: e.target.value as any})}
                          className="w-full px-3 py-2 bg-white border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        >
                          <option value="">Selecione um cargo</option>
                          <option value="Mecânico">Mecânico</option>
                          <option value="Pintor">Pintor</option>
                          <option value="Funileiro">Funileiro</option>
                          <option value="Consultor">Consultor</option>
                          <option value="Polidor">Polidor</option>
                          <option value="Lavador">Lavador</option>
                          <option value="Montador">Montador</option>
                          <option value="Administrador">Administrador</option>
                        </select>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-700">
                          <Wrench size={16} className="text-slate-400" />
                          {selectedPerson.role || '-'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Histórico de O.S (Apenas para Clientes) */}
              {!isEditing && selectedPerson.type === 'Cliente' && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <History className="text-primary" size={20} />
                      Histórico de Ordens de Serviço
                    </h3>
                    <button 
                      onClick={() => setSelectedClientForHistory(selectedPerson)}
                      className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      Ver Histórico Completo
                    </button>
                  </div>
                  
                  {(() => {
                    const clientOrders = orders
                      .filter(o => o.clientId === selectedPerson.id)
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                      
                    const recentOrders = clientOrders.slice(0, 3);
                      
                    if (clientOrders.length === 0) {
                      return (
                        <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <Car size={32} className="mx-auto text-slate-300 mb-2" />
                          <p className="text-sm text-slate-500">Nenhuma ordem de serviço registrada.</p>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-3">
                        {recentOrders.map(order => (
                          <div key={order.id} className="bg-white border border-surface rounded-xl p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="bg-page-bg px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600">
                                {order.id}
                              </div>
                              <div>
                                <div className="font-bold text-slate-800 text-sm">{order.vehicle}</div>
                                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                  <Calendar size={12} />
                                  {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className={cn(
                                "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                order.status === 'Veículo Entregue' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                              )}>
                                {order.status}
                              </span>
                              <span className="font-bold text-slate-900">
                                {formatCurrency(order.totalValue)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Histórico do Cliente Modal */}
      {selectedClientForHistory && (
        <ClientHistoryModal
          client={selectedClientForHistory}
          orders={orders}
          parts={parts}
          onClose={() => setSelectedClientForHistory(null)}
        />
      )}
    </div>
  );
}
