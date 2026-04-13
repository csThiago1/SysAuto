# Nova UI — Sidebar DS Car Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o Sidebar e remover o AppHeader do ERP DS Car, movendo todas as funcionalidades do header (notificações, usuário, logout) para dentro de um novo sidebar escuro com seções, grupos expansíveis e scroll próprio.

**Architecture:** Sidebar auto-contido com `useState` local para collapse, `useSession` para dados do usuário, `useOverdueOrders` para badge de OS vencidas. Layout passa de grid+AppHeader para flex puro — sidebar fixo, `<main>` com scroll independente.

**Tech Stack:** Next.js 15, React, TypeScript strict, Tailwind CSS, next-auth v5, lucide-react, shadcn/ui (Popover via NotificationBell)

**Spec:** `docs/superpowers/specs/2026-04-11-nova-ui-sidebar-dscar-design.md`

---

## File Map

| Arquivo | Operação |
|---|---|
| `apps/dscar-web/src/components/Sidebar.tsx` | Substituição completa |
| `apps/dscar-web/src/app/(app)/layout.tsx` | Reescrita — remove AppHeader, flex layout |
| `apps/dscar-web/src/app/layout.tsx` | Troca Inter → Montserrat como font-sans |
| `apps/dscar-web/tailwind.config.ts` | Atualiza fade-in + fontFamily.sans |
| `apps/dscar-web/src/app/globals.css` | Atualiza scrollbar-thin (dark rgba) + var Montserrat |
| `apps/dscar-web/src/store/ui.store.ts` | Remove sidebarCollapsed + toggleSidebar |

---

## Task 1: Criar branch de feature

**Files:** nenhum arquivo modificado

- [x] **Step 1: Criar e entrar na branch**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar
git checkout -b feat/nova-ui-sidebar
```

Expected output: `Switched to a new branch 'feat/nova-ui-sidebar'`

- [x] **Step 2: Confirmar branch ativa**

```bash
git branch --show-current
```

Expected: `feat/nova-ui-sidebar`

---

## Task 2: Atualizar globals.css — scrollbar dark + variável Montserrat

**Files:**
- Modify: `apps/dscar-web/src/app/globals.css`

- [x] **Step 1: Adicionar variável `--font-montserrat` nas CSS custom properties**

No bloco `:root`, logo após `--font-rajdhani`, adicionar:

```css
  --font-montserrat: 'Montserrat', ui-sans-serif, system-ui, sans-serif;
```

O bloco `:root { /* Fontes */ ... }` deve ficar:

```css
  /* Fontes */
  --font-inter:       'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-rajdhani:    'Rajdhani', ui-sans-serif, system-ui, sans-serif;
  --font-montserrat:  'Montserrat', ui-sans-serif, system-ui, sans-serif;
```

- [x] **Step 2: Atualizar font-family do body para Montserrat**

No `@layer base`, trocar a linha `font-family` do `body`:

```css
/* antes */
font-family: var(--font-inter), ui-sans-serif, system-ui, sans-serif;

/* depois */
font-family: var(--font-montserrat), ui-sans-serif, system-ui, sans-serif;
```

- [x] **Step 3: Atualizar scrollbar-thin com cores dark**

O sidebar novo é sempre escuro (`#0f0f0f`). Trocar o thumb da scrollbar para rgba escuro:

```css
/* antes */
.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: hsl(var(--border));
  border-radius: 9999px;
}
```

```css
/* depois */
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}
```

- [x] **Step 4: Commit**

```bash
git add apps/dscar-web/src/app/globals.css
git commit -m "style(dscar): scrollbar dark + variável Montserrat no globals.css"
```

---

## Task 3: Atualizar tailwind.config.ts — animação fade-in com translateX + Montserrat

**Files:**
- Modify: `apps/dscar-web/tailwind.config.ts`

- [x] **Step 1: Atualizar o keyframe `fade-in` para incluir translateX**

Localizar o bloco `keyframes` e trocar `fade-in`:

```ts
// antes
"fade-in": {
  "0%":   { opacity: "0" },
  "100%": { opacity: "1" },
},
```

```ts
// depois
"fade-in": {
  from: { opacity: "0", transform: "translateX(-8px)" },
  to:   { opacity: "1", transform: "translateX(0)" },
},
```

- [x] **Step 2: Atualizar `fontFamily.sans` para Montserrat**

```ts
// antes
fontFamily: {
  sans:  ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
  plate: ["var(--font-rajdhani)", "ui-sans-serif", "system-ui", "sans-serif"],
  mono:  ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
},
```

```ts
// depois
fontFamily: {
  sans:  ["var(--font-montserrat)", "ui-sans-serif", "system-ui", "sans-serif"],
  plate: ["var(--font-rajdhani)", "ui-sans-serif", "system-ui", "sans-serif"],
  mono:  ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
},
```

- [x] **Step 3: Commit**

```bash
git add apps/dscar-web/tailwind.config.ts
git commit -m "style(dscar): fade-in com translateX + Montserrat como font-sans"
```

---

## Task 4: Atualizar root layout.tsx — trocar Inter por Montserrat

**Files:**
- Modify: `apps/dscar-web/src/app/layout.tsx`

- [x] **Step 1: Substituir import de Inter por Montserrat e atualizar as variáveis**

O arquivo atual importa `Inter` e `Rajdhani`. Manter `Rajdhani`, trocar `Inter` por `Montserrat`:

```tsx
import type { Metadata } from "next";
import { Montserrat, Rajdhani } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

// ─── Fontes DS Car ────────────────────────────────────────────────────────────
const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  variable: "--font-rajdhani",
  display: "swap",
  weight: ["600", "700"],
});

// ─── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default: "DS Car ERP",
    template: "%s · DS Car",
  },
  description: "Sistema de gestão DS Car Centro Automotivo",
  robots: { index: false, follow: false },
};

// ─── Layout raiz ──────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html
      lang="pt-BR"
      className={`${montserrat.variable} ${rajdhani.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [x] **Step 2: Typecheck**

```bash
cd apps/dscar-web && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 erros relacionados ao layout.

- [x] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/layout.tsx
git commit -m "style(dscar): troca Inter por Montserrat como fonte principal"
```

---

## Task 5: Substituir Sidebar.tsx — novo design completo

**Files:**
- Modify: `apps/dscar-web/src/components/Sidebar.tsx`

- [x] **Step 1: Substituir o conteúdo completo do arquivo**

```tsx
"use client";

import { useState, useRef, useCallback } from "react";
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
  CalendarCheck,
  Target,
  Ticket,
  FileSpreadsheet,
  FileText,
  Search,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Settings,
  Building2,
  type LucideIcon,
} from "lucide-react";
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
          { id: "fin-dash",       label: "Visão Geral",       href: "/financeiro",                    icon: DollarSign },
          { id: "fin-lancamentos",label: "Lançamentos",        href: "/financeiro/lancamentos",         icon: Receipt },
          { id: "fin-plano",      label: "Plano de Contas",    href: "/financeiro/plano-contas",        icon: BookOpen },
          { id: "fin-pagar",      label: "Contas a Pagar",     href: "/financeiro/contas-pagar",        icon: ArrowUpCircle },
          { id: "fin-receber",    label: "Contas a Receber",   href: "/financeiro/contas-receber",      icon: ArrowDownCircle },
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
          { id: "rh-dash",        label: "Dashboard RH",    href: "/rh",                       icon: UserCog },
          { id: "rh-colab",       label: "Colaboradores",   href: "/rh/colaboradores",          icon: UserPlus },
          { id: "rh-ponto",       label: "Ponto",           href: "/rh/ponto",                  icon: Clock },
          { id: "rh-espelho",     label: "Espelho de Ponto",href: "/rh/ponto/espelho",          icon: CalendarCheck },
          { id: "rh-metas",       label: "Metas",           href: "/rh/metas",                  icon: Target },
          { id: "rh-vales",       label: "Vales",           href: "/rh/vales",                  icon: Ticket },
          { id: "rh-folha",       label: "Folha",           href: "/rh/folha",                  icon: FileSpreadsheet },
          { id: "rh-contracheque",label: "Contracheques",   href: "/rh/folha/contracheque",     icon: FileText },
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
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

// ─── DS Car Logo (inline) ─────────────────────────────────────────────

function DSCarLogoInline({ collapsed }: { collapsed: boolean }) {
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

// ─── Sidebar ─────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const sidebarRef = useRef<HTMLDivElement>(null);

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
        top: rect.top - (sidebarRect?.top ?? 0) + rect.height / 2,
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

  return (
    <aside
      ref={sidebarRef}
      className={[
        "relative flex flex-col h-screen bg-[#0f0f0f] border-r border-white/[0.06]",
        "transition-[width] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        "flex-shrink-0 overflow-hidden",
        collapsed ? "w-[72px]" : "w-[260px]",
      ].join(" ")}
    >
      {/* ── Header ── */}
      <div
        className={[
          "flex items-center border-b border-white/[0.06] min-h-[76px]",
          collapsed ? "px-[18px] justify-center" : "px-5 justify-between",
        ].join(" ")}
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

        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-[#0f0f0f]
                       border border-white/[0.08] flex items-center justify-center
                       text-white/40 hover:bg-[#1a1a1a] hover:text-[#ea0e03]
                       transition-all duration-150"
            title="Expandir sidebar"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

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
            {/* Section label */}
            <div
              className={[
                "text-[10px] font-semibold text-white/25 tracking-[1.5px] uppercase",
                collapsed ? "py-4 text-center" : "px-5 pt-4 pb-1.5",
              ].join(" ")}
            >
              {collapsed ? "•" : section.label}
            </div>

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
                    className={[
                      "relative flex items-center w-[calc(100%-20px)] mx-2.5 rounded-lg transition-all duration-150",
                      collapsed ? "py-2.5 justify-center" : "px-5 py-2.5 gap-3",
                      active
                        ? "bg-[#ea0e03]/[0.12] text-[#ea0e03]"
                        : hovered
                        ? "bg-white/[0.04] text-white/70"
                        : "text-white/50",
                    ].join(" ")}
                  >
                    {/* Active bar */}
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-sm bg-[#ea0e03]" />
                    )}

                    <item.icon size={20} className="flex-shrink-0" />

                    {!collapsed && (
                      <>
                        <span className="text-[13.5px] font-medium whitespace-nowrap overflow-hidden text-ellipsis text-left">
                          {item.label}
                        </span>
                        {badge != null && (
                          <span className="ml-auto bg-[#ea0e03] text-white text-[10px] font-bold px-[7px] py-[2px] rounded-[10px] leading-4">
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

                    {/* Dot badge no modo colapsado */}
                    {collapsed && badge != null && (
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
                            type="button"
                            onClick={() => handleNav(child.href)}
                            onMouseEnter={() => setHoveredItem(child.id)}
                            onMouseLeave={() => setHoveredItem(null)}
                            className={[
                              "flex items-center gap-2.5 w-[calc(100%-20px)] mx-2.5 pl-[52px] pr-5 py-2",
                              "rounded-md transition-all duration-150 text-left",
                              childActive
                                ? "bg-[#ea0e03]/[0.08] text-[#ea0e03] font-medium"
                                : childHovered
                                ? "bg-white/[0.03] text-white/50"
                                : "text-white/35",
                            ].join(" ")}
                          >
                            <span
                              className={[
                                "w-[5px] h-[5px] rounded-full flex-shrink-0 transition-colors duration-150",
                                childActive ? "bg-[#ea0e03]" : "bg-white/15",
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
          <div className="w-[34px] h-[34px] rounded-lg bg-gradient-to-br from-[#ea0e03] to-[#ffe000] flex items-center justify-center font-bold text-[13px] text-white flex-shrink-0">
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
                  <span className="text-[11px] text-white/35 font-normal truncate">
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
```

- [x] **Step 2: Typecheck**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar/apps/dscar-web && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 erros no `Sidebar.tsx`. Se houver erro de tipo em `session.role`, confirmar que `apps/dscar-web/src/lib/auth.ts` está importado (o `declare module "next-auth"` fica nesse arquivo e é carregado automaticamente pelo TypeScript).

- [x] **Step 3: Commit**

```bash
git add apps/dscar-web/src/components/Sidebar.tsx
git commit -m "feat(dscar): novo Sidebar dark DS Car com seções, grupos, NotificationBell e footer de usuário"
```

---

## Task 6: Atualizar (app)/layout.tsx — flex puro, sem AppHeader

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/layout.tsx`

- [x] **Step 1: Reescrever o arquivo**

```tsx
import React from "react";
import { Sidebar } from "@/components/Sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
```

Observações:
- `"use client"` removido — layout é Server Component (Sidebar já é `"use client"`)
- `overflow-hidden` no wrapper impede que scroll do `<main>` mova o sidebar
- `bg-[#0a0a0a]` cobre o gap visual durante transição de largura do sidebar

- [x] **Step 2: Typecheck**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar/apps/dscar-web && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 erros. Se aparecer erro de `useUIStore` em algum componente, será corrigido na Task 7.

- [x] **Step 3: Commit**

```bash
git add apps/dscar-web/src/app/\(app\)/layout.tsx
git commit -m "feat(dscar): layout (app) usa flex h-screen sem AppHeader"
```

---

## Task 7: Limpar ui.store.ts — remover sidebarCollapsed

**Files:**
- Modify: `apps/dscar-web/src/store/ui.store.ts`

- [x] **Step 1: Verificar se algum arquivo ainda importa sidebarCollapsed ou toggleSidebar**

```bash
grep -r "sidebarCollapsed\|toggleSidebar\|useUIStore" \
  /Users/thiagocampos/Documents/Projetos/grupo-dscar/apps/dscar-web/src \
  --include="*.tsx" --include="*.ts" -l
```

Se o único resultado for `ui.store.ts` (o Sidebar.tsx e (app)/layout.tsx não importam mais `useUIStore`), prosseguir. Se outros arquivos ainda importarem, adicionar um step por arquivo para remover a dependência antes de continuar.

- [x] **Step 2: Substituir ui.store.ts**

Se `UIStore` ficar vazio, deletar o store. Se houver outros campos que devem ser mantidos, remover apenas `sidebarCollapsed` e `toggleSidebar`:

```ts
import { create } from "zustand";

// Store de UI — adicionar outros estados globais de UI aqui conforme necessário
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface UIStore {}

export const useUIStore = create<UIStore>()(() => ({}));
```

> Se não há outros campos e nenhum outro arquivo importar `useUIStore`, deletar o arquivo e remover a importação em qualquer lugar restante.

- [x] **Step 3: Typecheck final**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar/apps/dscar-web && npx tsc --noEmit 2>&1
```

Expected: 0 erros em todo o projeto.

- [x] **Step 4: Commit**

```bash
git add apps/dscar-web/src/store/ui.store.ts
git commit -m "refactor(dscar): remove sidebarCollapsed do UIStore — sidebar gerencia próprio estado"
```

---

## Task 8: Verificação final e PR

- [x] **Step 1: Rodar typecheck completo**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar/apps/dscar-web && npx tsc --noEmit
```

Expected: zero erros.

- [x] **Step 2: Confirmar que NotificationBell.test.tsx ainda passa**

```bash
cd /Users/thiagocampos/Documents/Projetos/grupo-dscar/apps/dscar-web && npx vitest run src/components/header/NotificationBell.test.tsx 2>&1
```

Expected: PASS — o componente `NotificationBell` não foi alterado, apenas movido de local.

- [x] **Step 3: Checar imports órfãos de AppHeader e DsCarLogo (usado pelo Sidebar antigo)**

```bash
grep -r "AppHeader\|DsCarLogo" \
  /Users/thiagocampos/Documents/Projetos/grupo-dscar/apps/dscar-web/src \
  --include="*.tsx" --include="*.ts"
```

Expected: `DsCarLogo` aparece apenas em `login/page.tsx` (legítimo — logo na página de login). `AppHeader` não deve aparecer em nenhum arquivo além do próprio `AppHeader.tsx`.

- [x] **Step 4: Push da branch**

```bash
git push -u origin feat/nova-ui-sidebar
```

- [x] **Step 5: Abrir PR (opcional)**

```bash
gh pr create \
  --title "feat(dscar): nova UI sidebar escura DS Car com seções e footer de usuário" \
  --body "$(cat <<'EOF'
## Summary
- Substitui sidebar clara por novo design escuro (`#0f0f0f`) com seções GERAL / FINANCEIRO / RH / SISTEMA
- Remove `AppHeader` — NotificationBell, avatar, empresa e logout migram para o sidebar
- Layout muda de `grid+header` para `flex h-screen overflow-hidden` — sidebar fixo, main com scroll independente
- Badge de OS vencidas dinâmico via `useOverdueOrders`
- Tooltip no modo colapsado, grupos auto-expandem na rota ativa
- Montserrat como fonte principal

## Test plan
- [x] Sidebar renderiza corretamente expandido e colapsado
- [x] Scroll da área principal não move o sidebar
- [x] NotificationBell abre popover corretamente dentro do sidebar
- [x] Footer exibe nome e role do usuário logado
- [x] Logout redireciona para /login
- [x] Badge de OS some quando não há OS vencidas/hoje
- [x] `tsc --noEmit` sem erros
- [x] `NotificationBell.test.tsx` passa

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- ✅ Layout flex h-screen overflow-hidden — Task 6
- ✅ Sidebar h-screen com scroll próprio na nav — Task 5 (`flex-1 overflow-y-auto`)
- ✅ NotificationBell no header da sidebar — Task 5
- ✅ Seções GERAL/FINANCEIRO/RH/SISTEMA — Task 5 (`NAV_SECTIONS`)
- ✅ Rotas reais (`/service-orders`, `/service-orders/kanban`, etc.) — Task 5
- ✅ Badge OS vencidas dinâmico via `useOverdueOrders` — Task 5
- ✅ Footer com `useSession` (nome, role, logout) — Task 5
- ✅ Collapse state local (`useState`) — Task 5
- ✅ `useUIStore.sidebarCollapsed` removido — Task 7
- ✅ Montserrat como font-sans — Tasks 3 + 4
- ✅ Scrollbar dark rgba — Task 2
- ✅ `AppHeader` não renderizado — Task 6
- ✅ `DsCarLogo` mantido em `login/page.tsx` — não alterado
- ✅ Branch separada — Task 1

**Placeholder scan:** nenhum TBD, TODO ou step sem código encontrado.

**Type consistency:** `Sidebar` exportado como named export (`export function Sidebar`) consistente com o import em `layout.tsx` (`import { Sidebar } from "@/components/Sidebar"`).
