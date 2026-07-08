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
  Target,
  Ticket,
  FileSpreadsheet,
  Settings,
  Wrench,
  CalendarDays,
  Shield,
  Package,
  Tag,
  FlaskConical,
  Boxes,
  Warehouse,
  Barcode,
  PackagePlus,
  ArrowLeftRight,
  CheckCircle2,
  Layers,
  FileText,
  ReceiptText,
  Inbox,
  Handshake,
  UserSearch,
  ShoppingCart,
  FileCheck,
  BarChart3,
  Ban,
  type LucideIcon,
} from "lucide-react";
import { ROLE_HIERARCHY, type PaddockRole, type ExtraPermission } from "@paddock/types";

// ─── Types ───────────────────────────────────────────────────────────

export interface NavChild {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  /** Quando "overdue": badge vem do hook useOverdueOrders em runtime */
  dynamicBadge?: "overdue";
  children?: NavChild[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
  /** Papel mínimo para ver esta seção (undefined = todos) */
  minRole?: PaddockRole;
  /** Permissão granular necessária (além do minRole) */
  requiredPermission?: ExtraPermission;
}

// ─── Role labels ─────────────────────────────────────────────────────

export const ROLE_LABELS: Record<string, string> = {
  OWNER:       "Proprietário",
  ADMIN:       "Administrador",
  MANAGER:     "Gerente",
  CONSULTANT:  "Consultor",
  STOREKEEPER: "Almoxarife",
};

// ─── Route Config ────────────────────────────────────────────────────

export const NAV_SECTIONS: NavSection[] = [
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
          { id: "os-lista",  label: "Lista de OS", href: "/os",         icon: ClipboardList },
          { id: "os-kanban", label: "Kanban",       href: "/os/kanban", icon: KanbanSquare },
        ],
      },
      {
        id: "agenda",
        label: "Agenda",
        icon: CalendarDays,
        href: "/agenda",
      },
      {
        id: "orcamentos-particulares",
        label: "Orçamentos",
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
    requiredPermission: "can_view_financial",
    items: [
      {
        id: "financeiro",
        label: "Financeiro",
        icon: DollarSign,
        href: "/financeiro",
        children: [
          { id: "fin-dash",          label: "Visão Geral",     href: "/financeiro",                       icon: DollarSign },
          { id: "fin-dre",           label: "DRE",             href: "/financeiro/dre",                  icon: FileSpreadsheet },
          { id: "fin-lancamentos",   label: "Lançamentos",     href: "/financeiro/lancamentos",           icon: Receipt },
          { id: "fin-plano",         label: "Plano de Contas", href: "/financeiro/plano-contas",          icon: BookOpen },
          { id: "fin-pagar",         label: "Contas a Pagar",  href: "/financeiro/contas-pagar",          icon: ArrowUpCircle },
          { id: "fin-receber",       label: "Contas a Receber",href: "/financeiro/contas-receber",        icon: ArrowDownCircle },
          { id: "fin-faturamento",   label: "Faturamento",     href: "/financeiro/billing-report",        icon: ReceiptText },
          { id: "fin-inadimplencia", label: "Inadimplencia",   href: "/financeiro/inadimplencia",         icon: ArrowUpCircle },
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
          { id: "fiscal-emitir-nfce", label: "Emitir NFC-e", href: "/fiscal/emitir-nfce", icon: ShoppingCart },
          { id: "fiscal-resumo", label: "Resumo Fiscal", href: "/fiscal/resumo", icon: BarChart3 },
          { id: "fiscal-inutilizacao", label: "Inutilizacao", href: "/fiscal/inutilizacao", icon: Ban },
        ],
      },
    ],
  },
  {
    label: "RH",
    requiredPermission: "can_manage_employees",
    items: [
      {
        id: "rh",
        label: "Recursos Humanos",
        icon: UserCog,
        href: "/rh",
        children: [
          { id: "rh-dash",  label: "Dashboard RH",  href: "/rh",               icon: UserCog },
          { id: "rh-colab", label: "Colaboradores", href: "/rh/colaboradores",  icon: UserPlus },
          // { id: "rh-ponto", label: "Ponto",         href: "/rh/ponto",          icon: Clock },
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

export function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/" || pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export function isGroupActive(pathname: string, item: NavItem): boolean {
  if (item.href && isActiveRoute(pathname, item.href)) return true;
  return item.children?.some((c) => isActiveRoute(pathname, c.href)) ?? false;
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase();
}

// ─── Role-gated helpers ───────────────────────────────────────────────

export function visibleSections(
  role: PaddockRole,
  perms: ExtraPermission[]
): NavSection[] {
  const level = ROLE_HIERARCHY[role] ?? 0;
  return NAV_SECTIONS.filter((s) => {
    if (s.minRole && level < (ROLE_HIERARCHY[s.minRole] ?? 0)) return false;
    if (s.requiredPermission) {
      if (level >= ROLE_HIERARCHY.MANAGER) return true;
      return perms.includes(s.requiredPermission);
    }
    return true;
  });
}

export function visibleModules(
  role: PaddockRole,
  perms: ExtraPermission[]
): NavItem[] {
  return visibleSections(role, perms).flatMap((s) => s.items);
}
