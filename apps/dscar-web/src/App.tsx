import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Kanban } from './components/Kanban';
import { ServiceOrders } from './components/ServiceOrders';
import { Agenda } from './components/Agenda';
import { People } from './components/People';
import { Inventory } from './components/Inventory';
import { Finance } from './components/Finance';
import { Invoicing } from './components/Invoicing';
import { WorkshopManagement } from './components/WorkshopManagement';
import { LoginScreen } from './components/LoginScreen';
import { BudgetList } from './components/Budget/BudgetList';
import { BudgetDetail } from './components/Budget/BudgetDetail';
import { OSDetailV2 } from './components/ServiceOrderV2/OSDetailV2';
import { CiliaImporter } from './components/CiliaImporter/CiliaImporter';
import { mockParts, mockInvoices } from './mockData';
import { ServiceOrder, OSStatus, Invoice, Part, OSTemplate, Person } from './types';
import { useAuth } from './AuthContext';
import { useServiceOrders } from './hooks/useServiceOrders';
import { usePersons } from './hooks/usePersons';

type SimpleView = 'dashboard' | 'os' | 'agenda' | 'kanban' | 'workshop' | 'finance' | 'invoicing' | 'people' | 'inventory' | 'budgets' | 'imports';
type DetailView = { type: 'budget-detail'; budgetId: number } | { type: 'os-v2'; osId: number };
type AppView = SimpleView | DetailView;

function isSimpleView(v: AppView): v is SimpleView {
  return typeof v === 'string';
}

function currentViewName(v: AppView): string {
  if (isSimpleView(v)) return v;
  return v.type;
}

export default function App() {
  const { authenticated, loading: authLoading, logout } = useAuth();
  const [currentView, setCurrentView] = useState<AppView>('dashboard');

  const setView = (v: string) => setCurrentView(v as SimpleView);
  const { orders, updateOrderStatus, updateOrder } = useServiceOrders();
  const { people, setPeople } = usePersons();
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);
  const [parts, setParts] = useState(mockParts);
  const [templates, setTemplates] = useState<OSTemplate[]>([]);
  const [initialDateForNewOS, setInitialDateForNewOS] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState(() => people.find(p => p.role === 'Administrador') ?? people[0]);

  const updatePerson = (updatedPerson: Person) => {
    setPeople(prev => prev.map(p => p.id === updatedPerson.id ? updatedPerson : p));
  };

  const updatePartQuantity = (partId: string, quantityToSubtract: number) => {
    setParts(prev => prev.map(p => 
      p.id === partId ? { ...p, quantity: Math.max(0, p.quantity - quantityToSubtract) } : p
    ));
  };

  const addPart = (part: Omit<Part, 'id'>) => {
    const newPart: Part = {
      ...part,
      id: `PRT-${1000 + parts.length + 1}`
    };
    setParts(prev => [newPart, ...prev]);
  };

  const updatePart = (updatedPart: Part) => {
    setParts(prev => prev.map(p => p.id === updatedPart.id ? updatedPart : p));
  };

  const addOrder = (order: Omit<ServiceOrder, 'id' | 'createdAt' | 'updatedAt' | 'statusHistory'>) => {
    const now = new Date().toISOString();
    const newOrder: ServiceOrder = {
      ...order,
      id: `OS-${1000 + orders.length + 1}`,
      createdAt: now,
      updatedAt: now,
      statusHistory: [
        { status: order.status, changedBy: 'Sistema', changedAt: now }
      ]
    };
    updateOrder(newOrder);
    
    // Subtract parts from inventory
    order.parts.forEach(part => {
      updatePartQuantity(part.partId, part.quantity);
    });
  };

  const addInvoice = (invoice: Omit<Invoice, 'id' | 'issueDate' | 'status'>) => {
    const newInvoice: Invoice = {
      ...invoice,
      id: `INV-${Date.now()}`,
      issueDate: new Date().toISOString(),
      status: 'Pendente'
    };
    setInvoices(prev => [newInvoice, ...prev]);
    
    // Simulate SEFAZ authorization after 2 seconds
    setTimeout(() => {
      const isError = Math.random() < 0.1; // 10% chance of error
      setInvoices(prev => prev.map(inv => 
        inv.id === newInvoice.id ? { ...inv, status: isError ? 'Erro' : 'Autorizada' } : inv
      ));
    }, 2000);
  };

  const addTemplate = (template: Omit<OSTemplate, 'id'>) => {
    const newTemplate: OSTemplate = {
      ...template,
      id: `TPL-${Date.now()}`
    };
    setTemplates(prev => [newTemplate, ...prev]);
  };

  const renderView = () => {
    // Detail views (discriminated union)
    if (!isSimpleView(currentView)) {
      if (currentView.type === 'budget-detail') {
        return <BudgetDetail budgetId={currentView.budgetId} />;
      }
      if (currentView.type === 'os-v2') {
        return <OSDetailV2 osId={currentView.osId} />;
      }
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard
          orders={orders}
          people={people}
          parts={parts}
          onViewAgenda={() => setCurrentView('agenda')}
        />;
      case 'os':
        return (
          <ServiceOrders
            orders={orders}
            people={people}
            addOrder={addOrder}
            updateOrder={updateOrder}
            parts={parts}
            templates={templates}
            addTemplate={addTemplate}
            updatePart={updatePart}
            initialDate={initialDateForNewOS || undefined}
            onModalClose={() => setInitialDateForNewOS(null)}
          />
        );
      case 'agenda':
        return (
          <Agenda
            orders={orders}
            people={people}
            parts={parts}
            addOrder={(order) => {
              addOrder(order);
              setCurrentView('os');
            }}
            updateOrder={updateOrder}
            templates={templates}
            onNewOS={(date) => {
              setInitialDateForNewOS(date);
              setCurrentView('os');
            }}
          />
        );
      case 'kanban':
        return <Kanban orders={orders} people={people} updateOrderStatus={updateOrderStatus} updateOrder={updateOrder} />;
      case 'workshop':
        return <WorkshopManagement orders={orders} people={people} updateOrder={updateOrder} />;
      case 'finance':
        return <Finance orders={orders} people={people} />;
      case 'invoicing':
        return <Invoicing invoices={invoices} people={people} orders={orders} addInvoice={addInvoice} />;
      case 'people':
        return <People people={people} orders={orders} parts={parts} updatePerson={updatePerson} />;
      case 'inventory':
        return <Inventory parts={parts} addPart={addPart} updatePart={updatePart} />;
      case 'budgets':
        return (
          <BudgetList
            onOpen={(id) => setCurrentView({ type: 'budget-detail', budgetId: id })}
          />
        );
      case 'imports':
        return (
          <CiliaImporter
            onOpenServiceOrder={(osId) => setCurrentView({ type: 'os-v2', osId })}
          />
        );
      default:
        return <Dashboard orders={orders} people={people} parts={parts} />;
    }
  };

  // Auth guard
  if (authLoading) {
    return (
      <div className="min-h-screen bg-page-bg flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="flex h-screen bg-page-bg font-sans text-slate-900 overflow-hidden">
      <Sidebar
        currentView={currentViewName(currentView)}
        setCurrentView={setView}
        userRole={currentUser.role}
        onLogout={logout}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-surface flex items-center justify-between px-8 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              {(() => {
                const name = currentViewName(currentView);
                const titles: Record<string, string> = {
                  dashboard: 'Visão Geral',
                  os: 'Ordens de Serviço',
                  agenda: 'Agenda de Serviços',
                  kanban: 'Quadro Kanban',
                  workshop: 'Oficina',
                  finance: 'Financeiro',
                  invoicing: 'Faturamento',
                  people: 'Pessoas',
                  inventory: 'Estoque',
                  budgets: 'Orçamentos',
                  imports: 'Importar Seguradora',
                  'budget-detail': 'Detalhe do Orçamento',
                  'os-v2': 'Ordem de Serviço',
                };
                return titles[name] ?? '';
              })()}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-slate-900">{currentUser.name}</span>
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{currentUser.role || currentUser.type}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shadow-sm">
              {currentUser.name.substring(0, 2).toUpperCase()}
            </div>
            <select 
              className="ml-2 text-xs bg-page-bg border border-surface rounded-lg px-2 py-1 focus:outline-none"
              value={currentUser.id}
              onChange={(e) => {
                const user = people.find(p => p.id === e.target.value);
                if (user) setCurrentUser(user);
              }}
            >
              {people.filter(p => p.type === 'Colaborador').map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
              ))}
            </select>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
