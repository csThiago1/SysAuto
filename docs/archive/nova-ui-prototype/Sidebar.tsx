"use client";

import { useState, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  KanbanSquare,
  Users,
  DollarSign,
  Receipt,
  CreditCard,
  ArrowDownCircle,
  ArrowUpCircle,
  BookOpen,
  UserCog,
  UserPlus,
  Clock,
  CalendarCheck,
  Target,
  Ticket,
  FileSpreadsheet,
  FileText,
  Search,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Settings,
  type LucideIcon,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────

interface NavChild {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  badge?: number;
  children?: NavChild[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

// ─── Route Config ────────────────────────────────────────────────────

const NAV_SECTIONS: NavSection[] = [
  {
    label: "GERAL",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        href: "/dashboard",
      },
      {
        id: "os",
        label: "Ordens de Serviço",
        icon: ClipboardList,
        badge: 12,
        children: [
          { id: "os-lista", label: "Lista de OS", href: "/os", icon: ClipboardList },
          { id: "os-kanban", label: "Kanban", href: "/os/kanban", icon: KanbanSquare },
        ],
      },
      {
        id: "cadastros",
        label: "Cadastros",
        icon: Users,
        href: "/cadastros",
      },
    ],
  },
  {
    label: "FINANCEIRO",
    items: [
      {
        id: "financeiro",
        label: "Financeiro",
        icon: DollarSign,
        children: [
          { id: "fin-dash", label: "Visão Geral", href: "/financeiro", icon: DollarSign },
          { id: "fin-lancamentos", label: "Lançamentos", href: "/financeiro/lancamentos", icon: Receipt },
          { id: "fin-plano", label: "Plano de Contas", href: "/financeiro/plano-contas", icon: BookOpen },
          { id: "fin-pagar", label: "Contas a Pagar", href: "/financeiro/contas-pagar", icon: ArrowUpCircle },
          { id: "fin-receber", label: "Contas a Receber", href: "/financeiro/contas-receber", icon: ArrowDownCircle },
        ],
      },
    ],
  },
  {
    label: "RH",
    items: [
      {
        id: "rh",
        label: "Recursos Humanos",
        icon: UserCog,
        children: [
          { id: "rh-dash", label: "Dashboard RH", href: "/rh", icon: UserCog },
          { id: "rh-colab", label: "Colaboradores", href: "/rh/colaboradores", icon: UserPlus },
          { id: "rh-ponto", label: "Ponto", href: "/rh/ponto", icon: Clock },
          { id: "rh-espelho", label: "Espelho de Ponto", href: "/rh/ponto/espelho", icon: CalendarCheck },
          { id: "rh-metas", label: "Metas", href: "/rh/metas", icon: Target },
          { id: "rh-vales", label: "Vales", href: "/rh/vales", icon: Ticket },
          { id: "rh-folha", label: "Folha", href: "/rh/folha", icon: FileSpreadsheet },
          { id: "rh-contracheque", label: "Contracheques", href: "/rh/folha/contracheque", icon: FileText },
        ],
      },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      {
        id: "configuracoes",
        label: "Configurações",
        icon: Settings,
        href: "/configuracoes",
      },
    ],
  },
];

// ─── Helper: check if a path matches ────────────────────────────────

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/" || pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

function isGroupActive(pathname: string, item: NavItem): boolean {
  if (item.href && isActiveRoute(pathname, item.href)) return true;
  return item.children?.some((c) => isActiveRoute(pathname, c.href)) ?? false;
}

// ─── DS Car Logo ─────────────────────────────────────────────────────

function DSCarLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-[#ea0e03] to-[#b50a02] flex items-center justify-center flex-shrink-0 overflow-hidden">
        <span className="relative z-10 font-black text-[13px] text-white tracking-tight">
          DS
        </span>
      </div>
      {!collapsed && (
        <div className="flex flex-col leading-none animate-fade-in">
          <span className="font-extrabold text-[15px] text-white tracking-wide">
            DS CAR
          </span>
          <span className="font-normal text-[9.5px] text-white/40 tracking-[1.5px] uppercase mt-0.5">
            ERP SYSTEM
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const sidebarRef = useRef<HTMLDivElement>(null);

  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
    // Auto-expand group that contains the current route
    const groups: string[] = [];
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        if (item.children && isGroupActive(pathname, item)) {
          groups.push(item.id);
        }
      }
    }
    return groups;
  });
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    top: number;
    label: string;
    visible: boolean;
  }>({ top: 0, label: "", visible: false });

  const toggleGroup = useCallback(
    (id: string) => {
      if (collapsed) {
        setCollapsed(false);
        setTimeout(() => {
          setExpandedGroups((prev) =>
            prev.includes(id) ? prev : [...prev, id]
          );
        }, 250);
        return;
      }
      setExpandedGroups((prev) =>
        prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
      );
    },
    [collapsed]
  );

  const handleNav = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router]
  );

  const showTooltip = useCallback(
    (e: React.MouseEvent, label: string) => {
      if (!collapsed) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const sidebarRect = sidebarRef.current?.getBoundingClientRect();
      setTooltip({
        top: rect.top - (sidebarRect?.top || 0) + rect.height / 2,
        label,
        visible: true,
      });
    },
    [collapsed]
  );

  const hideTooltip = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  return (
    <aside
      ref={sidebarRef}
      className={`
        relative flex flex-col h-screen bg-[#0f0f0f] border-r border-white/[0.06]
        transition-[width] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]
        ${collapsed ? "w-[72px]" : "w-[260px]"}
        flex-shrink-0 overflow-hidden
      `}
    >
      {/* ── Header ── */}
      <div
        className={`
          flex items-center border-b border-white/[0.06] min-h-[76px]
          ${collapsed ? "px-[18px] justify-center" : "px-5 justify-between"}
        `}
      >
        <DSCarLogo collapsed={collapsed} />

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="w-7 h-7 rounded-md border border-white/[0.08] bg-white/[0.03] text-white/40
                       flex items-center justify-center hover:bg-white/[0.08] hover:text-white/70
                       transition-all duration-150 flex-shrink-0"
          >
            <ChevronLeft size={18} />
          </button>
        )}

        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-[#0f0f0f]
                       border border-white/[0.08] flex items-center justify-center
                       text-white/40 hover:bg-[#1a1a1a] hover:text-[#ea0e03]
                       transition-all duration-150"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* ── Search ── */}
      <div
        className={`
          flex items-center rounded-lg border border-white/[0.06] bg-white/[0.03]
          cursor-pointer hover:border-white/[0.12] transition-colors duration-150
          ${collapsed ? "mx-3.5 my-3 p-2 justify-center" : "mx-4 my-3 px-3 py-2 gap-2"}
        `}
      >
        <Search size={18} className="text-white/30 flex-shrink-0" />
        {!collapsed && (
          <>
            <span className="text-[13px] text-white/30 font-normal">
              Buscar...
            </span>
            <span className="ml-auto text-[10px] text-white/20 bg-white/[0.05] px-1.5 py-0.5 rounded font-medium">
              ⌘K
            </span>
          </>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-thin">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div
              className={`
                text-[10px] font-semibold text-white/25 tracking-[1.5px] uppercase
                ${collapsed ? "py-4 text-center" : "px-5 pt-4 pb-1.5"}
              `}
            >
              {collapsed ? "•" : section.label}
            </div>

            {section.items.map((item) => {
              const active = isGroupActive(pathname, item);
              const expanded = expandedGroups.includes(item.id);
              const hovered = hoveredItem === item.id;

              return (
                <div key={item.id}>
                  {/* ── Parent Item ── */}
                  <button
                    onClick={() => {
                      if (item.children) {
                        toggleGroup(item.id);
                      } else if (item.href) {
                        handleNav(item.href);
                      }
                    }}
                    onMouseEnter={(e) => {
                      setHoveredItem(item.id);
                      showTooltip(e, item.label);
                    }}
                    onMouseLeave={() => {
                      setHoveredItem(null);
                      hideTooltip();
                    }}
                    className={`
                      relative flex items-center w-full rounded-lg transition-all duration-150
                      ${collapsed ? "mx-2.5 py-2.5 justify-center" : "mx-2.5 px-5 py-2.5 gap-3"}
                      ${
                        active
                          ? "bg-[#ea0e03]/[0.12] text-[#ea0e03]"
                          : hovered
                          ? "bg-white/[0.04] text-white/70"
                          : "text-white/50"
                      }
                    `}
                    style={{ width: collapsed ? "calc(100% - 20px)" : "calc(100% - 20px)" }}
                  >
                    {/* Active indicator bar */}
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-sm bg-[#ea0e03]" />
                    )}

                    <item.icon size={20} className="flex-shrink-0" />

                    {!collapsed && (
                      <>
                        <span className="text-[13.5px] font-medium whitespace-nowrap overflow-hidden text-ellipsis text-left">
                          {item.label}
                        </span>

                        {item.badge != null && (
                          <span className="ml-auto bg-[#ea0e03] text-white text-[10px] font-bold px-[7px] py-[2px] rounded-[10px] leading-4">
                            {item.badge}
                          </span>
                        )}

                        {item.children && (
                          <ChevronDown
                            size={16}
                            className={`
                              ml-auto text-white/25 transition-transform duration-200
                              ${expanded ? "rotate-180" : ""}
                            `}
                          />
                        )}
                      </>
                    )}

                    {/* Collapsed badge dot */}
                    {collapsed && item.badge != null && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ea0e03]" />
                    )}
                  </button>

                  {/* ── Children ── */}
                  {!collapsed && item.children && expanded && (
                    <div className="animate-fade-in">
                      {item.children.map((child) => {
                        const childActive = isActiveRoute(pathname, child.href);
                        const childHovered = hoveredItem === child.id;

                        return (
                          <button
                            key={child.id}
                            onClick={() => handleNav(child.href)}
                            onMouseEnter={() => setHoveredItem(child.id)}
                            onMouseLeave={() => setHoveredItem(null)}
                            className={`
                              flex items-center gap-2.5 w-[calc(100%-20px)] mx-2.5 pl-[52px] pr-5 py-2
                              rounded-md transition-all duration-150 text-left
                              ${
                                childActive
                                  ? "bg-[#ea0e03]/[0.08] text-[#ea0e03] font-medium"
                                  : childHovered
                                  ? "bg-white/[0.03] text-white/50"
                                  : "text-white/35"
                              }
                            `}
                          >
                            <span
                              className={`
                                w-[5px] h-[5px] rounded-full flex-shrink-0 transition-colors duration-150
                                ${childActive ? "bg-[#ea0e03]" : "bg-white/15"}
                              `}
                            />
                            <span className="text-[12.5px]">
                              {child.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Footer / User ── */}
      <div className="border-t border-white/[0.06] p-4">
        <div
          className={`
            flex items-center rounded-[10px] bg-white/[0.03] cursor-pointer
            hover:bg-white/[0.06] transition-colors duration-150
            ${collapsed ? "p-2 justify-center" : "p-2 gap-2.5"}
          `}
        >
          <div className="w-[34px] h-[34px] rounded-lg bg-gradient-to-br from-[#ea0e03] to-[#ffe000] flex items-center justify-center font-bold text-[13px] text-white flex-shrink-0">
            TC
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-white/85 whitespace-nowrap overflow-hidden text-ellipsis">
                  Thiago Campos
                </div>
                <div className="text-[11px] text-white/35 font-normal">
                  Administrador
                </div>
              </div>
              <button className="text-white/30 hover:text-white/60 transition-colors">
                <LogOut size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Tooltip (collapsed mode) ── */}
      {collapsed && (
        <div
          className={`
            absolute left-[calc(100%+12px)] z-50 bg-[#1a1a1a] border border-white/10
            text-white px-3 py-1.5 rounded-md text-[12px] font-medium whitespace-nowrap
            pointer-events-none shadow-[0_4px_12px_rgba(0,0,0,0.4)]
            transition-opacity duration-150
            ${tooltip.visible ? "opacity-100" : "opacity-0"}
          `}
          style={{ top: tooltip.top, transform: "translateY(-50%)" }}
        >
          {tooltip.label}
        </div>
      )}
    </aside>
  );
}
