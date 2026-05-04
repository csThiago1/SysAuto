"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  ClipboardList,
  KanbanSquare,
  Users,
  DollarSign,
  Receipt,
  ArrowDownCircle,
  ArrowUpCircle,
  BookOpen,
  UserCog,
  UserPlus,
  Clock,
  Target,
  Ticket,
  FileSpreadsheet,
  Search,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Settings,
  Settings2,
  Building2,
  Wrench,
  CalendarDays,
  Shield,
  Car,
  Package,
  Tag,
  FlaskConical,
  Boxes,
  HardHat,
  Truck,
  Warehouse,
  Barcode,
  PackagePlus,
  ArrowLeftRight,
  CheckCircle2,
  SlidersHorizontal,
  Percent,
  Layers,
  FileText,
  ReceiptText,
  Inbox,
  BarChart3,
  Database,
  TrendingUp,
  Handshake,
  UserSearch,
  ShoppingCart,
  FileCheck,
  type LucideIcon,
} from "lucide-react";
import { ROLE_HIERARCHY, type PaddockRole } from "@paddock/types";
import { NotificationBell } from "@/components/header/NotificationBell";
import { useOverdueOrders } from "@/hooks/useOverdueOrders";

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
  /** Quando "overdue": badge vem do hook useOverdueOrders em runtime */
  dynamicBadge?: "overdue";
  children?: NavChild[];
}

interface NavSection {
  label: string;
  items: NavItem[];
  /** Papel mínimo para ver esta seção (undefined = todos) */
  minRole?: PaddockRole;
}

// ─── Role labels ─────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  OWNER:       "Proprietário",
  ADMIN:       "Administrador",
  MANAGER:     "Gerente",
  CONSULTANT:  "Consultor",
  STOREKEEPER: "Almoxarife",
};

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
        dynamicBadge: "overdue",
        children: [
          { id: "os-lista",  label: "Lista de OS", href: "/service-orders",         icon: ClipboardList },
          { id: "os-kanban", label: "Kanban",       href: "/service-orders/kanban", icon: KanbanSquare },
        ],
      },
      {
        id: "agenda",
        label: "Agenda",
        icon: CalendarDays,
        href: "/agenda",
      },
      {
        id: "orcamentos",
        label: "Orçamentos",
        icon: FileText,
        href: "/orcamentos",
      },
      {
        id: "orcamentos-particulares",
        label: "Orç. Particulares",
        icon: ReceiptText,
        href: "/orcamentos-particulares",
      },
      {
        id: "cadastros",
        label: "Cadastros",
        icon: Users,
        href: "/cadastros",
        children: [
          { id: "cad-pessoas",       label: "Pessoas",       href: "/cadastros",                    icon: Users },
          { id: "cad-servicos",      label: "Serviços",      href: "/cadastros/servicos",         icon: Wrench },
          { id: "cad-seguradoras",   label: "Seguradoras",   href: "/cadastros/seguradoras",      icon: Shield },
          { id: "cad-corretores",    label: "Corretores",    href: "/cadastros/corretores",       icon: Handshake },
          { id: "cad-especialistas", label: "Especialistas", href: "/cadastros/especialistas",    icon: UserSearch },
        ],
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
        href: "/financeiro",
        children: [
          { id: "fin-dash",        label: "Visão Geral",     href: "/financeiro",                 icon: DollarSign },
          { id: "fin-lancamentos", label: "Lançamentos",     href: "/financeiro/lancamentos",      icon: Receipt },
          { id: "fin-plano",       label: "Plano de Contas", href: "/financeiro/plano-contas",     icon: BookOpen },
          { id: "fin-pagar",       label: "Contas a Pagar",  href: "/financeiro/contas-pagar",     icon: ArrowUpCircle },
          { id: "fin-receber",     label: "Contas a Receber",href: "/financeiro/contas-receber",   icon: ArrowDownCircle },
        ],
      },
    ],
  },
  {
    label: "FISCAL",
    minRole: "ADMIN",
    items: [
      {
        id: "fiscal",
        label: "Fiscal",
        icon: FileText,
        children: [
          { id: "fiscal-documentos", label: "Documentos Emitidos", href: "/fiscal/documentos", icon: FileText },
          { id: "fiscal-nfe-recebidas", label: "NF-e Recebidas", href: "/fiscal/nfe-recebidas", icon: Inbox },
          { id: "fiscal-emitir-nfse", label: "Emitir NFS-e Manual", href: "/fiscal/emitir-nfse", icon: FileText },
          { id: "fiscal-emitir-nfe", label: "Emitir NF-e Produto", href: "/fiscal/emitir-nfe", icon: Package },
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
        href: "/rh",
        children: [
          { id: "rh-dash",  label: "Dashboard RH",  href: "/rh",               icon: UserCog },
          { id: "rh-colab", label: "Colaboradores", href: "/rh/colaboradores",  icon: UserPlus },
          { id: "rh-ponto", label: "Ponto",         href: "/rh/ponto",          icon: Clock },
          { id: "rh-metas", label: "Metas",         href: "/rh/metas",          icon: Target },
          { id: "rh-vales", label: "Vales",         href: "/rh/vales",          icon: Ticket },
          { id: "rh-folha", label: "Folha",         href: "/rh/folha",          icon: FileSpreadsheet },
        ],
      },
    ],
  },
  {
    label: "ESTOQUE",
    items: [
      {
        id: "estoque",
        label: "Estoque Físico",
        icon: Boxes,
        href: "/estoque",
        children: [
          { id: "est-dash",         label: "Visão Geral",       href: "/estoque",                    icon: LayoutDashboard },
          { id: "est-armazens",     label: "Armazéns",          href: "/estoque/armazens",           icon: Warehouse },
          { id: "est-pecas",        label: "Peças",             href: "/estoque/produtos/pecas",     icon: Package },
          { id: "est-insumos",      label: "Insumos",           href: "/estoque/produtos/insumos",   icon: FlaskConical },
          { id: "est-unidades",     label: "Unidades Físicas",  href: "/estoque/unidades",           icon: Barcode },
          { id: "est-lotes",        label: "Lotes de Insumo",   href: "/estoque/lotes",              icon: Layers },
          { id: "est-entrada",      label: "Entrada Manual",    href: "/estoque/entrada",            icon: PackagePlus },
          { id: "est-movimentacoes",label: "Movimentações",     href: "/estoque/movimentacoes",      icon: ArrowLeftRight },
          { id: "est-aprovacoes",   label: "Aprovações",        href: "/estoque/aprovacoes",         icon: CheckCircle2 },
          { id: "est-contagens",    label: "Contagens",         href: "/estoque/contagens",          icon: ClipboardList },
          { id: "est-nfe",          label: "NF-e de Entrada",   href: "/estoque/nfe-recebida",       icon: FileText },
          { id: "est-categorias",   label: "Categorias",        href: "/estoque/categorias",         icon: Tag },
        ],
      },
    ],
  },
  {
    label: "COMPRAS",
    items: [
      {
        id: "compras",
        label: "Compras",
        icon: ShoppingCart,
        href: "/compras",
        children: [
          { id: "cmp-pedidos", label: "Pedidos de Compra", href: "/compras", icon: ShoppingCart },
          { id: "cmp-ordens", label: "Ordens de Compra", href: "/compras/ordens", icon: FileCheck },
        ],
      },
    ],
  },
  {
    label: "MOTOR",
    items: [
      {
        id: "configuracao-motor",
        label: "Motor de Orçamentos",
        icon: Settings2,
        href: "/configuracao-motor",
        children: [
          { id: "motor-custos",      label: "Custos",       href: "/configuracao-motor/custos",      icon: DollarSign },
          { id: "motor-impressoras", label: "Impressoras",  href: "/configuracao-motor/impressoras", icon: SlidersHorizontal },
          { id: "motor-margens",     label: "Margens",      href: "/configuracao-motor/margens",     icon: Percent },
          { id: "motor-snapshots",   label: "Snapshots",    href: "/configuracao-motor/snapshots",   icon: Layers },
          { id: "motor-simulador",   label: "Simulador",    href: "/configuracao-motor/simulador",   icon: FlaskConical },
        ],
      },
    ],
  },
  {
    label: "BENCHMARK",
    items: [
      {
        id: "benchmark",
        label: "Benchmark IA",
        icon: BarChart3,
        href: "/benchmark",
        children: [
          { id: "bm-fontes",      label: "Fontes",       href: "/benchmark/fontes",      icon: Database },
          { id: "bm-ingestoes",   label: "Ingestões",    href: "/benchmark/ingestoes",   icon: FileText },
          { id: "bm-revisao",     label: "Revisão",      href: "/benchmark/revisao",     icon: Tag },
          { id: "bm-estatisticas",label: "Estatísticas", href: "/benchmark/estatisticas",icon: BarChart3 },
        ],
      },
    ],
  },
  {
    label: "OPERAÇÃO",
    items: [
      {
        id: "capacidade",
        label: "Capacidade",
        icon: Users,
        href: "/capacidade",
      },
      {
        id: "variancias",
        label: "Variâncias",
        icon: TrendingUp,
        href: "/configuracao-motor/variancias",
      },
      {
        id: "auditoria-motor",
        label: "Auditoria Motor",
        icon: Shield,
        href: "/auditoria/motor",
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

// ─── Helpers ─────────────────────────────────────────────────────────

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/" || pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

function isGroupActive(pathname: string, item: NavItem): boolean {
  if (item.href && isActiveRoute(pathname, item.href)) return true;
  return item.children?.some((c) => isActiveRoute(pathname, c.href)) ?? false;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase();
}

// ─── DS Car Logo (inline) ─────────────────────────────────────────────

function DSCarLogoInline({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/dscar-logo.png"
        alt="DS Car"
        className="h-9 w-9 object-contain"
        draggable={false}
      />
    );
  }
  return (
    <div className="flex items-center gap-3 animate-fade-in">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/dscar-logo.png"
        alt="DS Car"
        className="h-12 w-auto object-contain flex-shrink-0"
        draggable={false}
      />
      <div className="flex flex-col leading-none">
        <span className="font-extrabold text-[16px] text-white tracking-wide">
          DSCAR
        </span>
        <span className="font-normal text-[9.5px] text-white/40 tracking-[1.5px] uppercase mt-0.5">
          Centro Automotivo
        </span>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const expandTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: overdueData } = useOverdueOrders();
  const overdueCount = (overdueData ?? []).filter(
    (o) => o.urgency === "overdue" || o.urgency === "due_today"
  ).length;

  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
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
        expandTimeoutRef.current = setTimeout(() => {
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

  useEffect(() => {
    return () => {
      if (expandTimeoutRef.current) clearTimeout(expandTimeoutRef.current);
    };
  }, []);

  const handleNav = useCallback(
    (href: string) => {
      router.push(href as Parameters<typeof router.push>[0]);
    },
    [router]
  );

  const showTooltip = useCallback(
    (e: React.MouseEvent, label: string) => {
      if (!collapsed) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const sidebarRect = sidebarRef.current?.getBoundingClientRect();
      const navEl = sidebarRef.current?.querySelector("nav");
      const scrollOffset = navEl?.scrollTop ?? 0;
      setTooltip({
        top: rect.top - (sidebarRect?.top ?? 0) + scrollOffset + rect.height / 2,
        label,
        visible: true,
      });
    },
    [collapsed]
  );

  const hideTooltip = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  const userInitials = getInitials(session?.user?.name);
  const roleLabel = ROLE_LABELS[session?.role ?? ""] ?? session?.role ?? "";
  const userRoleLevel = ROLE_HIERARCHY[(session?.role ?? "STOREKEEPER") as PaddockRole] ?? 0;
  const visibleSections = NAV_SECTIONS.filter((s) =>
    !s.minRole || userRoleLevel >= (ROLE_HIERARCHY[s.minRole] ?? 0)
  );

  return (
    <aside
      ref={sidebarRef}
      className={[
        "relative flex flex-col h-screen bg-[#0f0f0f] shadow-[4px_0_16px_rgba(0,0,0,0.18)]",
        "transition-[width] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        "flex-shrink-0 overflow-hidden",
        collapsed ? "w-[72px]" : "w-[260px]",
      ].join(" ")}
    >
      {/* ── Header ── */}
      <div
        className={[
          "flex items-center border-b border-white/[0.06] min-h-[76px]",
          collapsed ? "px-[18px] justify-center cursor-pointer" : "px-5 justify-between",
        ].join(" ")}
        onClick={collapsed ? () => setCollapsed(false) : undefined}
        title={collapsed ? "Expandir sidebar" : undefined}
      >
        <DSCarLogoInline collapsed={collapsed} />

        {!collapsed && (
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={() => setCollapsed(true)}
              className="w-7 h-7 rounded-md border border-white/[0.08] bg-white/[0.03] text-white/40
                         flex items-center justify-center hover:bg-white/[0.08] hover:text-white/70
                         transition-all duration-150 flex-shrink-0"
              title="Recolher sidebar"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center py-1.5">
          <NotificationBell />
        </div>
      )}

      {/* ── Search ── */}
      <div
        className={[
          "flex items-center rounded-lg border border-white/[0.06] bg-white/[0.03]",
          "cursor-pointer hover:border-white/[0.12] transition-colors duration-150",
          collapsed ? "mx-3.5 my-3 p-2 justify-center" : "mx-4 my-3 px-3 py-2 gap-2",
        ].join(" ")}
      >
        <Search size={18} className="text-white/30 flex-shrink-0" />
        {!collapsed && (
          <>
            <span className="text-[13px] text-white/30 font-normal">
              Buscar...
            </span>
            <span className="ml-auto text-xs text-white/20 bg-white/[0.05] px-1.5 py-0.5 rounded font-medium">
              ⌘K
            </span>
          </>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-thin">
        {visibleSections.map((section) => (
          <div key={section.label}>
            {/* Section label */}
            {collapsed ? (
              <hr className="border-white/[0.08] mx-3 my-2" />
            ) : (
              <div className="section-divider px-5 pt-4 pb-1.5">
                {section.label}
              </div>
            )}

            {section.items.map((item) => {
              const active = isGroupActive(pathname, item);
              const expanded = expandedGroups.includes(item.id);
              const hovered = hoveredItem === item.id;
              const badge =
                item.dynamicBadge === "overdue" && overdueCount > 0
                  ? overdueCount
                  : undefined;

              return (
                <div key={item.id}>
                  {/* ── Parent Item ── */}
                  <button
                    type="button"
                    onClick={() => {
                      if (item.children && item.href) {
                        if (expandedGroups.includes(item.id)) {
                          toggleGroup(item.id);
                        } else {
                          handleNav(item.href);
                          toggleGroup(item.id);
                        }
                      } else if (item.children) {
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
                    className={[
                      "relative flex items-center w-[calc(100%-20px)] mx-2.5 rounded-lg transition-all duration-150",
                      collapsed ? "py-2.5 justify-center" : "px-5 py-2.5 gap-3",
                      active
                        ? "bg-primary-600/[0.12] text-primary-600"
                        : hovered
                        ? "bg-white/[0.04] text-white/70"
                        : "text-white/50",
                    ].join(" ")}
                  >
                    {/* Active bar */}
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-sm bg-primary-600" />
                    )}

                    <item.icon size={20} className="flex-shrink-0" />

                    {!collapsed && (
                      <>
                        <span className="text-[13.5px] font-medium whitespace-nowrap overflow-hidden text-ellipsis text-left">
                          {item.label}
                        </span>
                        {badge != null && (
                          <span className="ml-auto bg-primary-600 text-white text-xs font-bold font-mono px-[7px] py-[2px] rounded-[10px] leading-4">
                            {badge}
                          </span>
                        )}
                        {item.children && (
                          <ChevronDown
                            size={16}
                            className={[
                              "text-white/25 transition-transform duration-200",
                              badge == null ? "ml-auto" : "",
                              expanded ? "rotate-180" : "",
                            ].join(" ")}
                          />
                        )}
                      </>
                    )}

                    {/* Numeric badge no modo colapsado */}
                    {collapsed && badge != null && (
                      <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-primary-600 text-white text-xs font-bold font-mono flex items-center justify-center px-0.5 leading-none">
                        {badge > 9 ? "9+" : badge}
                      </span>
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
                            type="button"
                            onClick={() => handleNav(child.href)}
                            onMouseEnter={() => setHoveredItem(child.id)}
                            onMouseLeave={() => setHoveredItem(null)}
                            className={[
                              "flex items-center gap-2.5 w-[calc(100%-20px)] mx-2.5 pl-[52px] pr-5 py-2",
                              "rounded-md transition-all duration-150 text-left",
                              childActive
                                ? "bg-primary-600/[0.08] text-primary-600 font-medium"
                                : childHovered
                                ? "bg-white/[0.03] text-white/50"
                                : "text-white/35",
                            ].join(" ")}
                          >
                            <span
                              className={[
                                "w-[5px] h-[5px] rounded-full flex-shrink-0 transition-colors duration-150",
                                childActive ? "bg-primary-600" : "bg-white/15",
                              ].join(" ")}
                            />
                            <span className="text-[12.5px]">{child.label}</span>
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
          className={[
            "flex items-center rounded-[10px] bg-white/[0.03]",
            "hover:bg-white/[0.06] transition-colors duration-150",
            collapsed ? "p-2 justify-center" : "p-2 gap-2.5",
          ].join(" ")}
        >
          <div className="w-[34px] h-[34px] rounded-lg bg-gradient-to-br from-primary-600 to-primary-950 flex items-center justify-center font-bold text-[13px] text-white flex-shrink-0">
            {userInitials}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-white/85 whitespace-nowrap overflow-hidden text-ellipsis">
                  {session?.user?.name ?? "Usuário"}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Building2 size={10} className="text-white/30 flex-shrink-0" />
                  <span className="text-xs text-white/35 font-normal truncate">
                    DS Car{roleLabel ? ` · ${roleLabel}` : ""}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: "/login" })}
                className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
                title="Sair"
              >
                <LogOut size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Tooltip (collapsed mode) ── */}
      {collapsed && (
        <div
          className={[
            "absolute left-[calc(100%+12px)] z-50 bg-[#1a1a1a] border border-white/10",
            "text-white px-3 py-1.5 rounded-md text-[12px] font-medium whitespace-nowrap",
            "pointer-events-none shadow-[0_4px_12px_rgba(0,0,0,0.4)]",
            "transition-opacity duration-150",
            tooltip.visible ? "opacity-100" : "opacity-0",
          ].join(" ")}
          style={{ top: tooltip.top, transform: "translateY(-50%)" }}
        >
          {tooltip.label}
        </div>
      )}
    </aside>
  );
}
