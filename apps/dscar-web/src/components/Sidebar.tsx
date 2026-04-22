import { LayoutDashboard, ClipboardList, Trello, Users, Package, Settings, LogOut, Wallet, FileText, Wrench, Calendar, Download } from 'lucide-react';
import { cn } from '../utils';
import { EmployeeRole } from '../types';

type SidebarProps = {
  currentView: string;
  setCurrentView: (view: string) => void;
  userRole?: EmployeeRole;
  onLogout: () => void;
};

export function Sidebar({ currentView, setCurrentView, userRole, onLogout }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Administrador', 'Consultor', 'Mecânico', 'Pintor', 'Funileiro', 'Polidor', 'Lavador', 'Montador'] },
    { id: 'agenda', label: 'Agenda', icon: Calendar, roles: ['Administrador', 'Consultor', 'Mecânico', 'Pintor', 'Funileiro', 'Polidor', 'Lavador', 'Montador'] },
    { id: 'os', label: 'O.S & Orçamentos', icon: ClipboardList, roles: ['Administrador', 'Consultor', 'Mecânico', 'Pintor', 'Funileiro', 'Polidor', 'Lavador', 'Montador'] },
    { id: 'kanban', label: 'Kanban', icon: Trello, roles: ['Administrador', 'Consultor', 'Mecânico', 'Pintor', 'Funileiro', 'Polidor', 'Lavador', 'Montador'] },
    { id: 'workshop', label: 'Gestão de Oficina', icon: Wrench, roles: ['Administrador', 'Consultor', 'Mecânico', 'Pintor', 'Funileiro', 'Polidor', 'Lavador', 'Montador'] },
    { id: 'finance', label: 'Financeiro', icon: Wallet, roles: ['Administrador'] },
    { id: 'invoicing', label: 'Faturamento', icon: FileText, roles: ['Administrador'] },
    { id: 'people', label: 'Pessoas', icon: Users, roles: ['Administrador', 'Consultor'] },
    { id: 'inventory', label: 'Estoque', icon: Package, roles: ['Administrador', 'Consultor'] },
    { id: 'budgets', label: 'Orçamentos', icon: FileText, roles: ['Administrador', 'Consultor'] },
    { id: 'imports', label: 'Importar Seguradora', icon: Download, roles: ['Administrador', 'Consultor'] },
  ];

  const filteredMenuItems = menuItems.filter(item => 
    !userRole || item.roles.includes(userRole)
  );

  return (
    <div className="w-64 bg-primary text-page-bg h-screen flex flex-col shadow-xl">
      <div className="p-6 flex items-center gap-3 text-white">
        <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center font-bold text-xl shadow-inner">
          A
        </div>
        <span className="font-semibold text-lg tracking-tight">AutoRepair</span>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1">
        {filteredMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium",
                isActive 
                  ? "bg-page-bg text-primary shadow-md" 
                  : "hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon size={18} className={isActive ? "text-primary" : "text-page-bg/70"} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium hover:bg-white/10 hover:text-white text-page-bg/70">
          <Settings size={18} />
          Configurações
        </button>
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium hover:bg-white/10 hover:text-white text-page-bg/70 mt-1"
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </div>
  );
}
