import React, { useState, useEffect } from 'react';
import { ServiceOrder, Person, OSStatus, OSType, InsuranceClaimType, Part, ServiceCategory, OSTemplate, Reminder } from '../types';
import { formatCurrency, cn } from '../utils';
import { Plus, Search, FileText, MoreVertical, ShieldAlert, User, Shield, Wrench, History, Clock, ChevronDown, ChevronUp, Package, Trash2, Car, Save, Copy, Edit2, AlertTriangle, Bell, Calendar, Check } from 'lucide-react';
import { FilterBar } from './FilterBar';
import { VehicleHistoryModal } from './VehicleHistoryModal';
import { SearchableSelect } from './SearchableSelect';
import { ServiceOrderDetailModal } from './ServiceOrderDetailModal';

type ServiceOrdersProps = {
  orders: ServiceOrder[];
  people: Person[];
  parts: Part[];
  addOrder: (order: Omit<ServiceOrder, 'id' | 'createdAt' | 'updatedAt' | 'statusHistory'>) => void;
  updateOrder: (order: ServiceOrder) => void;
  templates: OSTemplate[];
  addTemplate: (template: Omit<OSTemplate, 'id'>) => void;
  updatePart?: (part: Part) => void;
  initialDate?: string;
  onModalClose?: () => void;
};

export function ServiceOrders({ orders, people, parts, addOrder, updateOrder, templates, addTemplate, updatePart, initialDate, onModalClose }: ServiceOrdersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [selectedOrderForHistory, setSelectedOrderForHistory] = useState<ServiceOrder | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<ServiceOrder | null>(null);
  const [selectedVehicleForHistory, setSelectedVehicleForHistory] = useState<{plate: string, vehicle: string} | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (orderId: string) => {
    setExpandedRows(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  // Filter State
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [filterType, setFilterType] = useState('Todas');
  const [filterInsurance, setFilterInsurance] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');

  // Form State
  const [clientId, setClientId] = useState('');
  const [isNewClient, setIsNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientDocument, setNewClientDocument] = useState('');
  
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [plate, setPlate] = useState('');
  const [osType, setOsType] = useState<OSType>('Particular');
  const [priority, setPriority] = useState<'Baixa' | 'Média' | 'Alta' | 'Urgente'>('Média');
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory | ''>('');
  const [insuranceCompanyId, setInsuranceCompanyId] = useState('');
  const [insuranceClaimType, setInsuranceClaimType] = useState<InsuranceClaimType>('Segurado');
  const [deductibleAmount, setDeductibleAmount] = useState('');
  const [deductiblePaid, setDeductiblePaid] = useState(false);
  const [observations, setObservations] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [status, setStatus] = useState<OSStatus>('Em vistoria');
  const [orderReminders, setOrderReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    if (initialDate) {
      setScheduledDate(initialDate);
      setIsModalOpen(true);
      setEditingOrderId(null);
      // Reset other form fields
      setClientId('');
      setVehicleBrand('');
      setVehicleModel('');
      setPlate('');
      setOrderServices([]);
      setOrderParts([]);
    }
  }, [initialDate]);

  const handleAddReminder = (type: 'Entrega' | 'Revisão' | 'Outro') => {
    const newReminder: Reminder = {
      id: `REM-${Date.now()}`,
      type,
      date: new Date().toISOString().split('T')[0],
      description: '',
      completed: false
    };
    setOrderReminders(prev => [...prev, newReminder]);
  };

  const handleRemoveReminder = (id: string) => {
    setOrderReminders(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateReminder = (id: string, updates: Partial<Reminder>) => {
    setOrderReminders(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  // Parts State
  const [orderParts, setOrderParts] = useState<{ partId: string; quantity: number; price: number }[]>([]);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [selectedPartQuantity, setSelectedPartQuantity] = useState('1');
  const [selectedPartPrice, setSelectedPartPrice] = useState('');
  const [partError, setPartError] = useState('');

  useEffect(() => {
    if (selectedPartId) {
      const part = parts.find(p => p.id === selectedPartId);
      if (part) {
        setSelectedPartPrice(part.price.toString());
      }
    } else {
      setSelectedPartPrice('');
    }
  }, [selectedPartId, parts]);

  useEffect(() => {
    setPartError('');
  }, [selectedPartId, selectedPartQuantity]);

  // Services State
  const [orderServices, setOrderServices] = useState<{ name: string; price: number }[]>([]);

  // Template State
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  useEffect(() => {
    if (clientId && !vehicleBrand && !plate && !isNewClient) {
      const clientOrders = orders
        .filter(o => o.clientId === clientId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      if (clientOrders.length > 0) {
        const lastVehicle = clientOrders[0].vehicle;
        const parts = lastVehicle.split(' - ');
        if (parts.length >= 2) {
          setVehicleBrand(parts[0]);
          setVehicleModel(parts[1]);
          if (parts[2]) setVehicleColor(parts[2]);
        } else {
          setVehicleModel(lastVehicle);
        }
        setPlate(clientOrders[0].plate);
      }
    }
  }, [clientId, isNewClient]);

  const handleRemoveService = (index: number) => {
    setOrderServices(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddPart = () => {
    if (!selectedPartId || !selectedPartQuantity || !selectedPartPrice) return;
    
    const part = parts.find(p => p.id === selectedPartId);
    if (!part) return;

    const qty = parseInt(selectedPartQuantity);
    const price = parseFloat(selectedPartPrice);
    if (qty <= 0 || isNaN(price) || price < 0) return;

    // Check inventory
    const originalQty = editingOrderId 
      ? orders.find(o => o.id === editingOrderId)?.parts.find(p => p.partId === selectedPartId)?.quantity || 0 
      : 0;
    const currentQtyInOrder = orderParts.find(p => p.partId === selectedPartId)?.quantity || 0;
    
    if ((currentQtyInOrder + qty) - originalQty > part.quantity) {
      setPartError(`Quantidade solicitada excede o estoque disponível (${part.quantity + originalQty - currentQtyInOrder}).`);
      return;
    }

    setPartError('');
    setOrderParts(prev => {
      const existing = prev.find(p => p.partId === selectedPartId);
      if (existing) {
        return prev.map(p => p.partId === selectedPartId ? { ...p, quantity: p.quantity + qty, price } : p);
      }
      return [...prev, { partId: selectedPartId, quantity: qty, price }];
    });
    
    setSelectedPartId('');
    setSelectedPartQuantity('1');
    setSelectedPartPrice('');
  };

  const handleRemovePart = (partId: string) => {
    setOrderParts(prev => prev.filter(p => p.partId !== partId));
  };

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
    if (filterStatus !== 'Todos') {
      if (o.status !== filterStatus) match = false;
    }
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      if (!o.id.toLowerCase().includes(searchLower) &&
          !o.vehicle.toLowerCase().includes(searchLower) &&
          !o.plate.toLowerCase().includes(searchLower)) {
        match = false;
      }
    }
    return match;
  });

  const clients = people.filter(p => p.type === 'Cliente');
  const insurances = people.filter(p => p.type === 'Seguradora');
  const employees = people.filter(p => p.type === 'Colaborador');

  const getStatusColor = (status: OSStatus) => {
    switch (status) {
      case 'Em vistoria': return 'bg-slate-100 text-slate-700';
      case 'Aguardando Liberação': return 'bg-amber-100 text-amber-700';
      case 'Aguardando Peças': return 'bg-orange-100 text-orange-700';
      case 'Em serviço': return 'bg-secondary/10 text-secondary';
      case 'Veículo Pronto': return 'bg-emerald-100 text-emerald-700';
      case 'Veículo Entregue': return 'bg-primary/10 text-primary';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const handleLoadTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    setOsType(template.osType);
    setServiceCategory(template.serviceCategory || '');
    setOrderServices(template.services);
    setOrderParts(template.parts);
    setObservations(template.observations || '');
    setSelectedTemplateId(templateId);
  };

  const handleEditOrder = (order: ServiceOrder) => {
    setEditingOrderId(order.id);
    setClientId(order.clientId);
    setIsNewClient(false);
    setAssignedEmployeeId(order.assignedEmployeeId || '');
    
    // Parse vehicle name
    const parts = order.vehicle.split(' - ');
    if (parts.length >= 2) {
      setVehicleBrand(parts[0]);
      setVehicleModel(parts[1]);
      if (parts[2]) setVehicleColor(parts[2]);
    } else {
      setVehicleBrand('');
      setVehicleModel(order.vehicle);
      setVehicleColor('');
    }
    
    setPlate(order.plate);
    setOsType(order.osType);
    setPriority(order.priority || 'Média');
    setServiceCategory(order.serviceCategory || '');
    setInsuranceCompanyId(order.insuranceCompanyId || '');
    setInsuranceClaimType(order.insuranceClaimType || 'Segurado');
    setDeductibleAmount(order.deductibleAmount ? order.deductibleAmount.toString() : '');
    setDeductiblePaid(order.deductiblePaid || false);
    setObservations(order.observations || '');
    setScheduledDate(order.scheduledDate || '');
    setStatus(order.status);
    setOrderReminders(order.reminders || []);
    setOrderParts([...order.parts]);
    setOrderServices([...order.services]);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if ((!clientId && !isNewClient) || (isNewClient && !newClientName) || !vehicleBrand || !vehicleModel || !plate) return;

    let finalClientId = clientId;

    if (isNewClient) {
      finalClientId = `CLI-${Date.now()}`;
      // In a real app, we would call an addPerson function here
      // For now, we'll just use the generated ID and the mock data won't show the name
      // but the order will be created successfully
    }

    const totalPartsValue = orderParts.reduce((acc, p) => acc + (p.price * p.quantity), 0);
    const totalServicesValue = orderServices.reduce((acc, s) => acc + s.price, 0);

    const fullVehicleName = `${vehicleBrand} - ${vehicleModel}${vehicleColor ? ` - ${vehicleColor}` : ''}`;

    if (editingOrderId) {
      const existingOrder = orders.find(o => o.id === editingOrderId);
      if (existingOrder) {
        // Update status history if status changed
        let updatedStatusHistory = [...(existingOrder.statusHistory || [])];
        if (existingOrder.status !== status) {
          updatedStatusHistory.push({
            status,
            changedBy: 'Sistema (Edição)',
            changedAt: new Date().toISOString(),
            notes: 'Alterado via edição de O.S'
          });
        }

        // Update inventory for parts
        if (updatePart) {
          const partChanges = new Map<string, number>();
          existingOrder.parts.forEach(p => {
            partChanges.set(p.partId, (partChanges.get(p.partId) || 0) + p.quantity); // Return old parts
          });
          orderParts.forEach(p => {
            partChanges.set(p.partId, (partChanges.get(p.partId) || 0) - p.quantity); // Take new parts
          });

          partChanges.forEach((change, partId) => {
            if (change !== 0) {
              const part = parts.find(p => p.id === partId);
              if (part) {
                updatePart({ ...part, quantity: part.quantity + change });
              }
            }
          });
        }

        updateOrder({
          ...existingOrder,
          clientId: finalClientId,
          assignedEmployeeId: assignedEmployeeId || undefined,
          vehicle: fullVehicleName,
          plate,
          osType,
          priority,
          serviceCategory: serviceCategory || undefined,
          insuranceCompanyId: osType === 'Seguradora' ? insuranceCompanyId : undefined,
          insuranceClaimType: osType === 'Seguradora' ? insuranceClaimType : undefined,
          deductibleAmount: osType === 'Seguradora' && insuranceClaimType === 'Segurado' ? Number(deductibleAmount) : 0,
          deductiblePaid: osType === 'Seguradora' && insuranceClaimType === 'Segurado' && Number(deductibleAmount) > 0 ? deductiblePaid : false,
          services: orderServices,
          parts: orderParts,
          totalValue: totalPartsValue + totalServicesValue,
          status,
          statusHistory: updatedStatusHistory,
          observations: observations || undefined,
          scheduledDate: scheduledDate || undefined,
          reminders: orderReminders.length > 0 ? orderReminders : undefined,
        });
      }
    } else {
      // Update inventory for new order
      if (updatePart) {
        orderParts.forEach(p => {
          const part = parts.find(pt => pt.id === p.partId);
          if (part) {
            updatePart({ ...part, quantity: part.quantity - p.quantity });
          }
        });
      }

      addOrder({
        clientId: finalClientId,
        assignedEmployeeId: assignedEmployeeId || undefined,
        vehicle: fullVehicleName,
        plate,
        osType,
        priority,
        serviceCategory: serviceCategory || undefined,
        insuranceCompanyId: osType === 'Seguradora' ? insuranceCompanyId : undefined,
        insuranceClaimType: osType === 'Seguradora' ? insuranceClaimType : undefined,
        deductibleAmount: osType === 'Seguradora' && insuranceClaimType === 'Segurado' ? Number(deductibleAmount) : 0,
        deductiblePaid: osType === 'Seguradora' && insuranceClaimType === 'Segurado' && Number(deductibleAmount) > 0 ? deductiblePaid : false,
        status: 'Em vistoria',
        financialStatus: 'A Faturar',
        amountPaid: 0,
        services: orderServices,
        parts: orderParts,
        totalValue: totalPartsValue + totalServicesValue,
        observations: observations || undefined,
        scheduledDate: scheduledDate || undefined,
        reminders: orderReminders.length > 0 ? orderReminders : undefined,
      });
    }

    setIsModalOpen(false);
    setEditingOrderId(null);
    if (onModalClose) onModalClose();
    setClientId('');
    setIsNewClient(false);
    setNewClientName('');
    setNewClientPhone('');
    setNewClientEmail('');
    setNewClientDocument('');
    setAssignedEmployeeId('');
    setVehicleBrand('');
    setVehicleModel('');
    setVehicleColor('');
    setPlate('');
    setOsType('Particular');
    setPriority('Média');
    setServiceCategory('');
    setInsuranceCompanyId('');
    setDeductibleAmount('');
    setDeductiblePaid(false);
    setObservations('');
    setScheduledDate('');
    setStatus('Em vistoria');
    setOrderReminders([]);
    setOrderParts([]);
    setOrderServices([]);
    setPartError('');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Ordens de Serviço</h1>
          <p className="text-slate-500 text-sm mt-1">Gerencie O.S e Orçamentos da oficina.</p>
        </div>
        <button 
          onClick={() => {
            setEditingOrderId(null);
            setClientId('');
            setIsNewClient(false);
            setNewClientName('');
            setNewClientPhone('');
            setNewClientEmail('');
            setNewClientDocument('');
            setAssignedEmployeeId('');
            setVehicleBrand('');
            setVehicleModel('');
            setVehicleColor('');
            setPlate('');
            setServiceCategory('');
            setInsuranceCompanyId('');
            setDeductibleAmount('');
            setDeductiblePaid(false);
            setObservations('');
            setStatus('Em vistoria');
            setOrderReminders([]);
            setOrderParts([]);
            setOrderServices([]);
            setPartError('');
            setSelectedPartPrice('');
            setIsModalOpen(true);
          }}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={18} />
          Nova O.S
        </button>
      </div>

      <FilterBar 
        dateStart={dateStart} setDateStart={setDateStart}
        dateEnd={dateEnd} setDateEnd={setDateEnd}
        filterType={filterType} setFilterType={setFilterType}
        filterInsurance={filterInsurance} setFilterInsurance={setFilterInsurance}
        filterStatus={filterStatus} setFilterStatus={setFilterStatus}
        people={people}
      />

      {/* Resumo de Lembretes Próximos */}
      {orders.some(o => o.reminders?.some(r => !r.completed)) && (
        <div className="mb-6 bg-white border border-surface rounded-2xl p-4 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Bell size={14} className="text-primary" />
            Lembretes Próximos
          </h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {orders.flatMap(o => (o.reminders || []).map(r => ({ ...r, orderId: o.id, vehicle: o.vehicle })))
              .filter(r => !r.completed)
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .slice(0, 5)
              .map(reminder => (
                <div key={reminder.id} className="flex-shrink-0 w-64 bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-start gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    reminder.type === 'Entrega' ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                  )}>
                    {reminder.type === 'Entrega' ? <Clock size={16} /> : <Calendar size={16} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-bold text-slate-900 uppercase">{reminder.type}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{new Date(reminder.date).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-700 truncate">{reminder.vehicle}</p>
                    <p className="text-[10px] text-slate-500 truncate">{reminder.description || 'Sem descrição'}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-surface shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-surface flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por placa, veículo ou número da O.S..." 
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
                <th className="px-6 py-4">Veículo</th>
                <th className="px-6 py-4">Placa</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Itens</th>
                <th className="px-6 py-4">Datas</th>
                <th className="px-6 py-4 text-right">Valor Total</th>
                <th className="px-6 py-4 text-center sticky right-0 bg-page-bg shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface">
              {filteredOrders.map(order => {
                const client = people.find(p => p.id === order.clientId);
                const insurance = order.insuranceCompanyId ? people.find(p => p.id === order.insuranceCompanyId) : null;
                
                return (
                  <React.Fragment key={order.id}>
                    <tr className="hover:bg-page-bg/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-900">{order.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0", 
                          order.osType === 'Seguradora' ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"
                        )}>
                          {order.osType === 'Seguradora' ? <Shield size={16} /> : <Wrench size={16} />}
                        </div>
                        <div className="flex flex-col">
                          {order.osType === 'Seguradora' && insurance ? (
                            <>
                              <span className="text-xs font-semibold text-secondary">{insurance.name}</span>
                              <span className="text-[10px] text-secondary/70 uppercase tracking-wider">{order.insuranceClaimType}</span>
                            </>
                          ) : (
                            <span className="text-xs font-semibold text-primary">Particular</span>
                          )}
                          {order.serviceCategory && (
                            <span className="text-[10px] text-slate-500 mt-0.5">{order.serviceCategory}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-900 font-medium">{client?.name || 'N/A'}</td>
                    <td className="px-6 py-4 text-slate-900">{order.vehicle}</td>
                    <td className="px-6 py-4 text-slate-500 font-mono">{order.plate}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center", getStatusColor(order.status))}>
                          {order.status}
                        </span>
                        {order.priority && (
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-medium",
                            order.priority === 'Baixa' ? "bg-slate-100 text-slate-600" :
                            order.priority === 'Média' ? "bg-blue-100 text-blue-700" :
                            order.priority === 'Alta' ? "bg-orange-100 text-orange-700" :
                            "bg-red-100 text-red-700"
                          )}>
                            {order.priority}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleRow(order.id)}
                        className="flex items-center gap-2 px-2 py-1 hover:bg-page-bg rounded-lg transition-colors group/btn"
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-xs font-bold text-slate-700">
                            {order.services.length} {order.services.length === 1 ? 'Serviço' : 'Serviços'}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {order.parts.length} {order.parts.length === 1 ? 'Peça' : 'Peças'}
                          </span>
                        </div>
                        {expandedRows[order.id] ? <ChevronUp size={14} className="text-primary" /> : <ChevronDown size={14} className="text-slate-400 group-hover/btn:text-primary" />}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-500" title="Data de Abertura">
                          <span className="font-semibold mr-1">Abertura:</span>
                          {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                        {order.status === 'Veículo Entregue' && (
                          <span className="text-xs text-emerald-600" title="Data de Conclusão">
                            <span className="font-semibold mr-1">Conclusão:</span>
                            {new Date(order.updatedAt).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                        {order.reminders && order.reminders.length > 0 && (
                          <div className="flex flex-col gap-1 mt-1">
                            {order.reminders.map(rem => (
                              <span key={rem.id} className={cn(
                                "text-[10px] flex items-center gap-1 font-medium",
                                rem.type === 'Entrega' ? "text-blue-600" : "text-emerald-600"
                              )}>
                                <Bell size={10} />
                                {rem.type}: {new Date(rem.date).toLocaleDateString('pt-BR')}
                                {rem.completed && <Check size={10} className="text-emerald-500 ml-1" />}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900">
                      {formatCurrency(order.totalValue)}
                    </td>
                    <td className="px-6 py-4 sticky right-0 bg-white group-hover:bg-page-bg/50 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)] transition-colors">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => setSelectedVehicleForHistory({ plate: order.plate, vehicle: order.vehicle })}
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Histórico do Veículo"
                        >
                          <Car size={16} />
                        </button>
                        <button 
                          onClick={() => setSelectedOrderForHistory(order)}
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Ver Histórico de Status"
                        >
                          <History size={16} />
                        </button>
                        <button 
                          onClick={() => setSelectedOrderDetails(order)}
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Ver Detalhes da O.S"
                        >
                          <FileText size={16} />
                        </button>
                        <button 
                          onClick={() => handleEditOrder(order)}
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Editar O.S"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedRows[order.id] && (
                    <tr className="bg-page-bg/30">
                      <td colSpan={10} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-2 duration-300">
                          {/* Serviços */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <Wrench size={14} className="text-primary" />
                              Serviços Realizados
                            </h4>
                            <div className="bg-white rounded-xl border border-surface overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-page-bg border-b border-surface">
                                  <tr>
                                    <th className="px-4 py-2 text-left font-bold text-slate-600">Descrição</th>
                                    <th className="px-4 py-2 text-right font-bold text-slate-600">Valor</th>
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
                              </table>
                            </div>
                          </div>

                          {/* Peças */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <Package size={14} className="text-secondary" />
                              Peças Utilizadas
                            </h4>
                            <div className="bg-white rounded-xl border border-surface overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-page-bg border-b border-surface">
                                  <tr>
                                    <th className="px-4 py-2 text-left font-bold text-slate-600">Peça</th>
                                    <th className="px-4 py-2 text-center font-bold text-slate-600">Qtd</th>
                                    <th className="px-4 py-2 text-right font-bold text-slate-600">Unit.</th>
                                    <th className="px-4 py-2 text-right font-bold text-slate-600">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-surface">
                                  {order.parts.map((p, i) => (
                                    <tr key={i}>
                                      <td className="px-4 py-2 text-slate-700">Peça ID: {p.partId}</td>
                                      <td className="px-4 py-2 text-center text-slate-700">{p.quantity}</td>
                                      <td className="px-4 py-2 text-right text-slate-700">{formatCurrency(p.price)}</td>
                                      <td className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(p.price * p.quantity)}</td>
                                    </tr>
                                  ))}
                                  {order.parts.length === 0 && (
                                    <tr>
                                      <td colSpan={4} className="px-4 py-4 text-center text-slate-400 italic">Nenhuma peça registrada</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                    Nenhuma ordem de serviço encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Histórico de Status */}
      {selectedOrderForHistory && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-surface flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <History size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-primary">Histórico de Status</h2>
                  <p className="text-xs text-slate-500">O.S: {selectedOrderForHistory.id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedOrderForHistory(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">
                &times;
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="relative space-y-8 before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-0.5 before:bg-surface">
                {selectedOrderForHistory.statusHistory?.slice().reverse().map((entry, idx) => (
                  <div key={idx} className="relative pl-12">
                    <div className={cn(
                      "absolute left-0 top-1 w-9 h-9 rounded-full border-4 border-white flex items-center justify-center z-10 shadow-sm",
                      idx === 0 ? "bg-primary text-white" : "bg-surface text-slate-400"
                    )}>
                      <Clock size={14} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          idx === 0 ? getStatusColor(entry.status) : "bg-slate-100 text-slate-500"
                        )}>
                          {entry.status}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(entry.changedAt).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900">Alterado por: {entry.changedBy}</p>
                      {entry.notes && (
                        <p className="text-xs text-slate-500 mt-1 italic">"{entry.notes}"</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-surface bg-page-bg flex justify-end">
              <button 
                onClick={() => setSelectedOrderForHistory(null)}
                className="px-4 py-2 bg-primary text-white font-medium hover:bg-primary/90 rounded-xl transition-colors text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova O.S / Editar O.S */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-surface flex justify-between items-center">
              <h2 className="text-xl font-bold text-primary">{editingOrderId ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}</h2>
              <div className="flex items-center gap-4">
                {templates.length > 0 && (
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleLoadTemplate(e.target.value)}
                    className="px-3 py-1.5 bg-page-bg border border-surface rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Carregar de um modelo...</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  &times;
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-slate-700">Cliente</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewClient(!isNewClient);
                        setClientId('');
                      }}
                      className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      {isNewClient ? 'Selecionar cliente existente' : '+ Cadastrar novo cliente'}
                    </button>
                  </div>
                  
                  {isNewClient ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-page-bg border border-surface rounded-xl">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600">Nome Completo *</label>
                        <input 
                          type="text" 
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                          placeholder="Ex: João da Silva"
                          className="w-full px-3 py-2 bg-white border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600">CPF/CNPJ</label>
                        <input 
                          type="text" 
                          value={newClientDocument}
                          onChange={(e) => setNewClientDocument(e.target.value)}
                          placeholder="000.000.000-00"
                          className="w-full px-3 py-2 bg-white border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600">Telefone</label>
                        <input 
                          type="text" 
                          value={newClientPhone}
                          onChange={(e) => setNewClientPhone(e.target.value)}
                          placeholder="(00) 00000-0000"
                          className="w-full px-3 py-2 bg-white border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600">E-mail</label>
                        <input 
                          type="email" 
                          value={newClientEmail}
                          onChange={(e) => setNewClientEmail(e.target.value)}
                          placeholder="joao@email.com"
                          className="w-full px-3 py-2 bg-white border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <SearchableSelect
                        options={clients.map(c => ({ value: c.id, label: c.name, subLabel: `${c.phone} | ${c.email}` }))}
                        value={clientId}
                        onChange={setClientId}
                        placeholder="Selecione um cliente"
                      />
                      {editingOrderId && clientId && !clients.find(c => c.id === clientId) && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-800">
                          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium">Cliente não encontrado na base de dados.</p>
                            <p className="text-amber-700/80 mt-1">
                              O cliente associado a esta O.S ({clientId}) não está mais na lista de clientes. 
                              <button 
                                type="button" 
                                onClick={() => {
                                  setIsNewClient(true);
                                  setClientId('');
                                }}
                                className="font-semibold underline ml-1 hover:text-amber-900"
                              >
                                Cadastrar novo cliente
                              </button>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Colaborador Responsável</label>
                  <SearchableSelect
                    options={employees.map(e => ({ value: e.id, label: e.name, subLabel: e.role || 'Colaborador' }))}
                    value={assignedEmployeeId}
                    onChange={setAssignedEmployeeId}
                    placeholder="Selecione um colaborador (opcional)"
                  />
                </div>
                
                <div className="space-y-1.5 md:col-span-2 mt-2">
                  <h3 className="text-sm font-semibold text-primary flex items-center gap-2 border-b border-surface pb-2">
                    <Car size={16} className="text-primary" />
                    Dados do Veículo
                  </h3>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Montadora *</label>
                  <select 
                    value={vehicleBrand}
                    onChange={(e) => setVehicleBrand(e.target.value)}
                    className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Selecione a montadora</option>
                    <option value="Audi">Audi</option>
                    <option value="BMW">BMW</option>
                    <option value="BYD">BYD</option>
                    <option value="CAOA Chery">CAOA Chery</option>
                    <option value="Chevrolet">Chevrolet</option>
                    <option value="Citroën">Citroën</option>
                    <option value="Fiat">Fiat</option>
                    <option value="Ford">Ford</option>
                    <option value="GWM">GWM</option>
                    <option value="Honda">Honda</option>
                    <option value="Hyundai">Hyundai</option>
                    <option value="Jeep">Jeep</option>
                    <option value="Kia">Kia</option>
                    <option value="Land Rover">Land Rover</option>
                    <option value="Mercedes-Benz">Mercedes-Benz</option>
                    <option value="Mitsubishi">Mitsubishi</option>
                    <option value="Nissan">Nissan</option>
                    <option value="Peugeot">Peugeot</option>
                    <option value="Porsche">Porsche</option>
                    <option value="Renault">Renault</option>
                    <option value="Toyota">Toyota</option>
                    <option value="Volkswagen">Volkswagen</option>
                    <option value="Volvo">Volvo</option>
                    <option value="Outra">Outra</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Modelo *</label>
                  <input 
                    type="text" 
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="Ex: Civic Touring 1.5 Turbo"
                    className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Cor do Veículo</label>
                  <select 
                    value={vehicleColor}
                    onChange={(e) => setVehicleColor(e.target.value)}
                    className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Selecione a cor</option>
                    <option value="Branco">Branco</option>
                    <option value="Preto">Preto</option>
                    <option value="Prata">Prata</option>
                    <option value="Cinza">Cinza</option>
                    <option value="Vermelho">Vermelho</option>
                    <option value="Azul">Azul</option>
                    <option value="Marrom">Marrom</option>
                    <option value="Verde">Verde</option>
                    <option value="Amarelo">Amarelo</option>
                    <option value="Laranja">Laranja</option>
                    <option value="Bege">Bege</option>
                    <option value="Outra">Outra</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Placa *</label>
                  <input 
                    type="text" 
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    placeholder="ABC-1234"
                    className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary uppercase"
                  />
                </div>
                
                <div className="space-y-1.5 md:col-span-2 mt-2">
                  <h3 className="text-sm font-semibold text-primary flex items-center gap-2 border-b border-surface pb-2">
                    <Wrench size={16} className="text-primary" />
                    Dados do Serviço
                  </h3>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Tipo de O.S</label>
                  <select 
                    value={osType}
                    onChange={(e) => setOsType(e.target.value as OSType)}
                    className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="Particular">Particular</option>
                    <option value="Seguradora">Seguradora</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Status da O.S</label>
                  <select 
                    value={status}
                    onChange={(e) => setStatus(e.target.value as OSStatus)}
                    className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="Em vistoria">Em Vistoria</option>
                    <option value="Aguardando Liberação">Aguardando Liberação</option>
                    <option value="Aguardando Peças">Aguardando Peças</option>
                    <option value="Em serviço">Em Serviço</option>
                    <option value="Veículo Pronto">Veículo Pronto</option>
                    <option value="Veículo Entregue">Veículo Entregue</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Prioridade</label>
                  <select 
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'Baixa' | 'Média' | 'Alta' | 'Urgente')}
                    className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Categoria do Serviço</label>
                  <select 
                    value={serviceCategory}
                    onChange={(e) => setServiceCategory(e.target.value as ServiceCategory)}
                    className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Selecione uma categoria (opcional)</option>
                    <option value="Funilaria/Pintura">Funilaria/Pintura</option>
                    <option value="Reparação/Pintura">Reparação/Pintura</option>
                    <option value="Troca/Pintura">Troca/Pintura</option>
                    <option value="Alinhamento">Alinhamento</option>
                    <option value="Balanceamento">Balanceamento</option>
                    <option value="Lavagem simples/técnica">Lavagem simples/técnica</option>
                    <option value="Mecânica">Mecânica</option>
                    <option value="Outros serviços">Outros serviços</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Calendar size={14} className="text-primary" />
                    Data Agendada
                  </label>
                  <input 
                    type="date" 
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 bg-page-bg border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <p className="text-[10px] text-slate-400 italic">Opcional: Deixe em branco para usar a data atual.</p>
                </div>
              </div>

              {osType === 'Seguradora' && (
                <div className="p-4 bg-page-bg border border-surface rounded-xl space-y-4">
                  <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                    <ShieldAlert size={16} className="text-primary" />
                    Dados da Seguradora
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Seguradora</label>
                      <SearchableSelect
                        options={insurances.map(i => ({ value: i.id, label: i.name, subLabel: `${i.phone} | ${i.email}` }))}
                        value={insuranceCompanyId}
                        onChange={setInsuranceCompanyId}
                        placeholder="Selecione a seguradora"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Tipo de Sinistro</label>
                      <select 
                        value={insuranceClaimType}
                        onChange={(e) => setInsuranceClaimType(e.target.value as InsuranceClaimType)}
                        className="w-full px-3 py-2 bg-white border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        <option value="Segurado">Segurado</option>
                        <option value="Terceiro">Terceiro</option>
                      </select>
                    </div>
                  </div>

                  {insuranceClaimType === 'Segurado' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-surface">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">Valor da Franquia (R$)</label>
                        <input 
                          type="number" 
                          value={deductibleAmount}
                          onChange={(e) => {
                            setDeductibleAmount(e.target.value);
                            if (!e.target.value || parseFloat(e.target.value) <= 0) {
                              setDeductiblePaid(false);
                            }
                          }}
                          placeholder="0.00"
                          className="w-full px-3 py-2 bg-white border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                      {parseFloat(deductibleAmount) > 0 && (
                        <div className="flex items-center pt-6">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={deductiblePaid}
                              onChange={(e) => setDeductiblePaid(e.target.checked)}
                              className="w-4 h-4 text-primary rounded border-surface focus:ring-primary"
                            />
                            <span className="text-sm font-medium text-slate-700">Franquia Paga</span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Serviços Section */}
              <div className="p-4 bg-page-bg border border-surface rounded-xl space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                    <Wrench size={16} className="text-primary" />
                    Serviços
                  </h3>
                  <button 
                    onClick={() => setOrderServices(prev => [...prev, { name: '', price: 0 }])}
                    className="px-3 py-1.5 bg-secondary/10 text-secondary font-medium hover:bg-secondary/20 rounded-lg transition-colors text-xs flex items-center gap-1"
                  >
                    <Plus size={14} />
                    Adicionar Serviço
                  </button>
                </div>
                
                <div className="space-y-3">
                  {orderServices.map((s, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <input 
                          type="text" 
                          value={s.name}
                          onChange={(e) => {
                            const newServices = [...orderServices];
                            newServices[idx].name = e.target.value;
                            setOrderServices(newServices);
                          }}
                          placeholder="Descrição do Serviço"
                          className="w-full px-3 py-2 bg-white border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                      <div className="w-32">
                        <input 
                          type="number" 
                          min="0"
                          step="0.01"
                          value={s.price || ''}
                          onChange={(e) => {
                            const newServices = [...orderServices];
                            newServices[idx].price = parseFloat(e.target.value) || 0;
                            setOrderServices(newServices);
                          }}
                          placeholder="Valor (R$)"
                          className="w-full px-3 py-2 bg-white border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                      <button 
                        onClick={() => handleRemoveService(idx)}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors mt-0.5"
                        title="Remover serviço"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {orderServices.length === 0 && (
                    <div className="text-center py-6 bg-white border border-dashed border-surface rounded-xl">
                      <p className="text-sm text-slate-500">Nenhum serviço adicionado.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Peças Section */}
              <div className="p-4 bg-page-bg border border-surface rounded-xl space-y-4">
                <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <Package size={16} className="text-primary" />
                  Adicionar Peças (Integração com Estoque)
                </h3>
                
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Peça</label>
                    <SearchableSelect
                      options={parts.map(p => {
                        const originalQty = editingOrderId 
                          ? orders.find(o => o.id === editingOrderId)?.parts.find(op => op.partId === p.id)?.quantity || 0 
                          : 0;
                        const currentQtyInOrder = orderParts.find(op => op.partId === p.id)?.quantity || 0;
                        const effectiveQty = p.quantity + originalQty - currentQtyInOrder;
                        
                        return { 
                          value: p.id, 
                          label: `${p.name} - ${formatCurrency(p.price)}`, 
                          subLabel: `Estoque: ${effectiveQty} | Código: ${p.sku}`,
                          disabled: effectiveQty <= 0
                        };
                      })}
                      value={selectedPartId}
                      onChange={setSelectedPartId}
                      placeholder="Selecione uma peça"
                      className="bg-white"
                    />
                  </div>
                  <div className="w-24 space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Qtd.</label>
                    <input 
                      type="number" 
                      min="1"
                      value={selectedPartQuantity}
                      onChange={(e) => setSelectedPartQuantity(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div className="w-32 space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Valor Unit. (R$)</label>
                    <input 
                      type="number" 
                      min="0"
                      step="0.01"
                      value={selectedPartPrice}
                      onChange={(e) => setSelectedPartPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-white border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <button 
                    onClick={handleAddPart}
                    className="px-4 py-2 bg-secondary text-white font-medium hover:bg-secondary/90 rounded-xl transition-colors h-[38px] flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Adicionar
                  </button>
                </div>
                
                {partError && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
                    <ShieldAlert size={16} />
                    <p className="text-sm font-medium">{partError}</p>
                  </div>
                )}

                {orderParts.length > 0 && (
                  <div className="mt-4 border border-surface rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-page-bg border-b border-surface text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Peça</th>
                          <th className="px-3 py-2 text-center">Qtd.</th>
                          <th className="px-3 py-2 text-right">Valor Unit.</th>
                          <th className="px-3 py-2 text-right">Subtotal</th>
                          <th className="px-3 py-2 text-center">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface">
                        {orderParts.map((op, idx) => {
                          const part = parts.find(p => p.id === op.partId);
                          return (
                            <tr key={idx}>
                              <td className="px-3 py-2 font-medium text-slate-700">{part?.name || op.partId}</td>
                              <td className="px-3 py-2 text-center">{op.quantity}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(op.price)}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(op.price * op.quantity)}</td>
                              <td className="px-3 py-2 text-center">
                                <button 
                                  onClick={() => handleRemovePart(op.partId)}
                                  className="text-red-500 hover:text-red-700 p-1"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Observações Section */}
              <div className="p-4 bg-page-bg border border-surface rounded-xl space-y-4">
                <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <FileText size={16} className="text-primary" />
                  Observações
                </h3>
                <div className="space-y-1.5">
                  <textarea 
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="Adicione notas relevantes sobre o serviço, condições do veículo, etc..."
                    className="w-full px-3 py-2 bg-white border border-surface rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[100px] resize-y"
                  />
                </div>
              </div>

              {/* Lembretes Section */}
              <div className="p-4 bg-page-bg border border-surface rounded-xl space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                    <Bell size={16} className="text-primary" />
                    Lembretes (Entrega / Revisão)
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddReminder('Entrega')}
                      className="text-[10px] font-bold uppercase tracking-wider bg-white border border-surface px-2 py-1 rounded-lg hover:bg-surface transition-colors"
                    >
                      + Entrega
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddReminder('Revisão')}
                      className="text-[10px] font-bold uppercase tracking-wider bg-white border border-surface px-2 py-1 rounded-lg hover:bg-surface transition-colors"
                    >
                      + Revisão
                    </button>
                  </div>
                </div>

                {orderReminders.length > 0 ? (
                  <div className="space-y-3">
                    {orderReminders.map((reminder) => (
                      <div key={reminder.id} className="bg-white p-3 rounded-xl border border-surface flex items-start gap-3 group">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          reminder.type === 'Entrega' ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                        )}>
                          {reminder.type === 'Entrega' ? <Clock size={16} /> : <Calendar size={16} />}
                        </div>
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleUpdateReminder(reminder.id, { completed: !reminder.completed })}
                              className={cn(
                                "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                                reminder.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-primary"
                              )}
                            >
                              <Check size={12} strokeWidth={4} />
                            </button>
                            <div className="space-y-1 flex-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Data</label>
                              <input
                                type="date"
                                value={reminder.date}
                                onChange={(e) => handleUpdateReminder(reminder.id, { date: e.target.value })}
                                className="w-full px-2 py-1 bg-page-bg border border-surface rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Descrição</label>
                            <input
                              type="text"
                              value={reminder.description}
                              onChange={(e) => handleUpdateReminder(reminder.id, { description: e.target.value })}
                              placeholder={`Ex: ${reminder.type === 'Entrega' ? 'Entrega do veículo' : 'Revisão de 1000km'}`}
                              className={cn(
                                "w-full px-2 py-1 bg-page-bg border border-surface rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/20",
                                reminder.completed && "text-slate-400 line-through"
                              )}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveReminder(reminder.id)}
                          className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 border border-dashed border-surface rounded-xl">
                    <p className="text-xs text-slate-400 italic">Nenhum lembrete definido</p>
                  </div>
                )}
              </div>

            </div>
            <div className="p-6 border-t border-surface bg-page-bg flex justify-end items-center">
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-surface rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave}
                  className="px-4 py-2 bg-primary text-white font-medium hover:bg-primary/90 rounded-xl transition-colors"
                >
                  Salvar O.S
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Histórico do Veículo */}
      {selectedVehicleForHistory && (
        <VehicleHistoryModal
          plate={selectedVehicleForHistory.plate}
          vehicleName={selectedVehicleForHistory.vehicle}
          orders={orders}
          parts={parts}
          onClose={() => setSelectedVehicleForHistory(null)}
        />
      )}

      {/* Modal Detalhes da O.S */}
      {selectedOrderDetails && (
        <ServiceOrderDetailModal
          order={selectedOrderDetails}
          people={people}
          parts={parts}
          onClose={() => setSelectedOrderDetails(null)}
          onUpdateOrder={(updatedOrder) => {
            updateOrder(updatedOrder);
            setSelectedOrderDetails(updatedOrder);
          }}
        />
      )}
    </div>
  );
}
