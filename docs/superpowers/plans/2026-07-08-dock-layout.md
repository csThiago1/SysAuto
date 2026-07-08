# Dock Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a sidebar de 260px do dscar-web por um dock inferior flutuante (desktop) e bottom tab bar (mobile), conforme `docs/superpowers/specs/2026-07-08-dock-layout-design.md`.

**Architecture:** A config de navegação (`NAV_SECTIONS` + role-gating) sai de `Sidebar.tsx` para `components/dock/nav-config.ts`. Um componente `Dock` (adaptado do React Bits, magnification via `motion`) é alimentado por `DockNav`, que resolve rota ativa, badge de OS atrasadas, popover de submenu e auto-hide. `TopBar` absorve logo/⌘K/sino/avatar. `MobileTabBar` substitui o `MobileSidebar`.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Tailwind (tokens), `motion` (novo), Radix Popover/DropdownMenu/Sheet via shadcn (já instalados), lucide-react, Vitest + React Testing Library.

## Global Constraints

- TypeScript strict: nunca `any`; retornos tipados.
- NUNCA cores Tailwind brutas — só tokens (`bg-card`, `border-border`, `text-primary`, `bg-primary/20`, etc.).
- Todos os labels de UI em PT-BR.
- Monorepo npm workspaces: instalar com `npm install <pkg> -w dscar-web` na raiz do repo; testes com `npm run test -w dscar-web -- <path>`; typecheck com `npx tsc --noEmit` dentro de `apps/dscar-web`.
- Working dir dos paths abaixo: `apps/dscar-web/src/` salvo indicação contrária.
- Commits: conventional commits em PT-BR (`feat(dscar): ...`).
- `prefers-reduced-motion`: toda animação nova degrada pra estático (usar `useReducedMotion` de `motion/react`).
- Ícones: somente lucide-react (padrão do projeto).

---

### Task 1: Extrair nav-config.ts com visibleModules()

**Files:**
- Create: `components/dock/nav-config.ts`
- Test: `components/dock/nav-config.test.ts`
- Modify: `components/Sidebar.tsx` (remove tipos/config/helpers, importa de nav-config e re-exporta)
- Modify: `components/CommandPalette.tsx:8` (import de nav-config)
- Modify: `components/MobileSidebar.tsx:22` (import de nav-config)

**Interfaces:**
- Consumes: `NAV_SECTIONS`, tipos `NavItem/NavChild/NavSection`, `ROLE_LABELS`, `isActiveRoute`, `isGroupActive`, `getInitials` (código existente em `Sidebar.tsx:63-283`), `ROLE_HIERARCHY`/`PaddockRole`/`ExtraPermission` de `@paddock/types`.
- Produces: `visibleSections(role: PaddockRole, perms: ExtraPermission[]): NavSection[]` e `visibleModules(role: PaddockRole, perms: ExtraPermission[]): NavItem[]` (seções achatadas, ordem de NAV_SECTIONS). Tudo re-exportado de `components/dock/nav-config.ts`.

- [ ] **Step 1: Criar nav-config.ts movendo código de Sidebar.tsx**

Mover de `Sidebar.tsx` para `components/dock/nav-config.ts` (recortar, não copiar): os tipos `NavChild`, `NavItem`, `NavSection`, o `ROLE_LABELS`, o array `NAV_SECTIONS` completo (linhas 101-261), e os helpers `isActiveRoute`, `isGroupActive`, `getInitials`. Manter os imports de lucide usados pelo config. Adicionar no final:

```ts
import { ROLE_HIERARCHY, type PaddockRole, type ExtraPermission } from "@paddock/types";

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
```

(O arquivo é `.ts` puro — sem JSX. `icon: LucideIcon` já é referência de componente, não elemento; nada muda.)

- [ ] **Step 2: Atualizar consumidores**

Em `Sidebar.tsx`: remover o código movido e no topo adicionar
```ts
export {
  NAV_SECTIONS, ROLE_LABELS, isActiveRoute, isGroupActive, getInitials,
} from "@/components/dock/nav-config";
export type { NavChild, NavItem, NavSection } from "@/components/dock/nav-config";
import {
  NAV_SECTIONS, ROLE_LABELS, isActiveRoute, isGroupActive, getInitials,
} from "@/components/dock/nav-config";
import type { NavItem } from "@/components/dock/nav-config";
```
O componente `Sidebar` em si troca seu `useMemo` de `visibleSections` inline por chamada a `visibleSections(userRole, userPerms)` importada (comportamento idêntico). `CommandPalette.tsx` e `MobileSidebar.tsx` passam a importar de `@/components/dock/nav-config` (re-exports mantêm compat, mas atualizar os dois imports diretos já evita o passo depois).

- [ ] **Step 3: Escrever teste de visibleModules**

`components/dock/nav-config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { NAV_SECTIONS, visibleModules, visibleSections } from "./nav-config";

describe("visibleModules", () => {
  it("OWNER vê todos os módulos de todas as seções", () => {
    const mods = visibleModules("OWNER", []);
    const total = NAV_SECTIONS.reduce((n, s) => n + s.items.length, 0);
    expect(mods).toHaveLength(total);
    expect(mods[0]?.id).toBe("dashboard");
  });

  it("STOREKEEPER não vê FINANCEIRO, FISCAL nem RH", () => {
    const sections = visibleSections("STOREKEEPER", []);
    const labels = sections.map((s) => s.label);
    expect(labels).not.toContain("FINANCEIRO");
    expect(labels).not.toContain("FISCAL");
    expect(labels).not.toContain("RH");
    expect(labels).toContain("ESTOQUE");
  });

  it("CONSULTANT com can_view_financial vê FINANCEIRO", () => {
    const labels = visibleSections("CONSULTANT", ["can_view_financial"]).map((s) => s.label);
    expect(labels).toContain("FINANCEIRO");
  });

  it("CONSULTANT sem permissão não vê FINANCEIRO", () => {
    const labels = visibleSections("CONSULTANT", []).map((s) => s.label);
    expect(labels).not.toContain("FINANCEIRO");
  });

  it("MANAGER vê FINANCEIRO sem permissão explícita", () => {
    const labels = visibleSections("MANAGER", []).map((s) => s.label);
    expect(labels).toContain("FINANCEIRO");
  });
});
```

- [ ] **Step 4: Rodar teste**

Run (na raiz do repo): `npm run test -w dscar-web -- src/components/dock/nav-config.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Typecheck**

Run (em `apps/dscar-web`): `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/dscar-web/src/components/dock/ apps/dscar-web/src/components/Sidebar.tsx apps/dscar-web/src/components/CommandPalette.tsx apps/dscar-web/src/components/MobileSidebar.tsx
git commit -m "refactor(dscar): extrai NAV_SECTIONS e role-gating pra nav-config com visibleModules"
```

---

### Task 2: Instalar motion e criar Dock.tsx

**Files:**
- Modify: `apps/dscar-web/package.json` (via npm install)
- Create: `components/dock/Dock.tsx`
- Test: `components/dock/Dock.test.tsx`

**Interfaces:**
- Consumes: `motion/react` (`motion`, `useMotionValue`, `useSpring`, `useTransform`, `useReducedMotion`), `LucideIcon`.
- Produces: componente `Dock` com props:

```ts
export interface DockModuleChild {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  active: boolean;
}
export interface DockModule {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  badge?: number;
  active: boolean;
  children?: DockModuleChild[];
}
interface DockProps {
  modules: DockModule[];
  onNavigate: (href: string) => void;
  className?: string;
}
```

- [ ] **Step 1: Instalar motion**

Run (na raiz do repo): `npm install motion -w dscar-web`
Expected: `motion` em `apps/dscar-web/package.json` dependencies.

- [ ] **Step 2: Criar Dock.tsx**

Adaptação TS/tokens do React Bits Dock. Submenu via Radix Popover (shadcn `ui/popover`) — o Popover envolve cada item com filhos; Escape/clique-fora são do Radix. Sem `Dock.css`: tudo Tailwind.

```tsx
"use client";

import { useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "motion/react";
import type { LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DockModuleChild {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  active: boolean;
}

export interface DockModule {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  badge?: number;
  active: boolean;
  children?: DockModuleChild[];
}

interface DockProps {
  modules: DockModule[];
  onNavigate: (href: string) => void;
  className?: string;
}

const BASE_SIZE = 44;
const MAGNIFIED_SIZE = 64;
const DISTANCE = 140;
const SPRING = { mass: 0.1, stiffness: 150, damping: 12 };

function DockItemButton({
  module: mod,
  mouseX,
  magnify,
  onClick,
}: {
  module: DockModule;
  mouseX: MotionValue<number>;
  magnify: boolean;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  const distanceFromMouse = useTransform(mouseX, (val: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return DISTANCE;
    return val - rect.x - rect.width / 2;
  });
  const targetSize = useTransform(
    distanceFromMouse,
    [-DISTANCE, 0, DISTANCE],
    magnify ? [BASE_SIZE, MAGNIFIED_SIZE, BASE_SIZE] : [BASE_SIZE, BASE_SIZE, BASE_SIZE]
  );
  const size = useSpring(targetSize, SPRING);

  return (
    <motion.button
      ref={ref}
      type="button"
      style={{ width: size, height: size }}
      onClick={onClick}
      aria-label={mod.label}
      title={mod.label}
      aria-current={mod.active ? "page" : undefined}
      {...(mod.children
        ? { "aria-haspopup": "menu" as const }
        : {})}
      className={cn(
        "relative flex items-center justify-center rounded-xl border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        mod.active
          ? "bg-primary/20 border-primary text-primary"
          : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      <mod.icon className="h-5 w-5" />
      {mod.badge != null && mod.badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold font-mono flex items-center justify-center px-1 leading-none">
          {mod.badge > 9 ? "9+" : mod.badge}
        </span>
      )}
    </motion.button>
  );
}

export function Dock({ modules, onNavigate, className }: DockProps) {
  const reduce = useReducedMotion();
  const mouseX = useMotionValue(Infinity);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <motion.nav
      aria-label="Módulos"
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn(
        "flex items-end gap-3 rounded-2xl border border-border bg-card/90 px-3 shadow-lg backdrop-blur-md",
        "h-[60px] pb-2",
        className
      )}
    >
      {modules.map((mod) =>
        mod.children ? (
          <Popover
            key={mod.id}
            open={openId === mod.id}
            onOpenChange={(open) => setOpenId(open ? mod.id : null)}
          >
            <PopoverTrigger asChild>
              <DockItemButton module={mod} mouseX={mouseX} magnify={!reduce} />
            </PopoverTrigger>
            <PopoverContent side="top" sideOffset={12} className="w-52 p-1.5">
              <p className="label-mono px-2.5 pt-1 pb-1.5 text-muted-foreground">
                {mod.label}
              </p>
              {mod.children.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => {
                    setOpenId(null);
                    onNavigate(child.href);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
                    child.active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <child.icon className="h-4 w-4 flex-shrink-0" />
                  {child.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        ) : (
          <DockItemButton
            key={mod.id}
            module={mod}
            mouseX={mouseX}
            magnify={!reduce}
            onClick={() => mod.href && onNavigate(mod.href)}
          />
        )
      )}
    </motion.nav>
  );
}
```

Nota: se `.label-mono` não existir mais no globals.css, usar `text-[10px] uppercase tracking-wider font-mono` inline.

- [ ] **Step 3: Escrever teste**

`components/dock/Dock.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClipboardList, LayoutDashboard, KanbanSquare } from "lucide-react";
import { Dock, type DockModule } from "./Dock";

const modules: DockModule[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", active: false },
  {
    id: "os",
    label: "Ordens de Serviço",
    icon: ClipboardList,
    active: true,
    badge: 3,
    children: [
      { id: "os-lista", label: "Lista de OS", href: "/os", icon: ClipboardList, active: true },
      { id: "os-kanban", label: "Kanban", href: "/os/kanban", icon: KanbanSquare, active: false },
    ],
  },
];

describe("Dock", () => {
  it("navega direto em módulo sem filhos", () => {
    const onNavigate = vi.fn();
    render(<Dock modules={modules} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    expect(onNavigate).toHaveBeenCalledWith("/dashboard");
  });

  it("abre popover com filhos e navega ao clicar num filho", () => {
    const onNavigate = vi.fn();
    render(<Dock modules={modules} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Ordens de Serviço" }));
    fireEvent.click(screen.getByRole("button", { name: /Kanban/ }));
    expect(onNavigate).toHaveBeenCalledWith("/os/kanban");
  });

  it("mostra badge e aria-current no módulo ativo", () => {
    render(<Dock modules={modules} onNavigate={vi.fn()} />);
    const osBtn = screen.getByRole("button", { name: "Ordens de Serviço" });
    expect(osBtn).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Rodar teste**

Run: `npm run test -w dscar-web -- src/components/dock/Dock.test.tsx`
Expected: 3 passed. (Se Radix reclamar de `ResizeObserver` no jsdom, adicionar stub em `src/test/setup.ts`: `global.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} } as never;`)

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/package.json package-lock.json apps/dscar-web/src/components/dock/Dock.tsx apps/dscar-web/src/components/dock/Dock.test.tsx apps/dscar-web/src/test/setup.ts
git commit -m "feat(dscar): componente Dock com magnification, popover de submenu e badge"
```

---

### Task 3: DockNav — dados reais + auto-hide

**Files:**
- Create: `components/dock/DockNav.tsx`
- Test: `components/dock/DockNav.test.tsx`

**Interfaces:**
- Consumes: `visibleModules`, `isActiveRoute`, `isGroupActive` (Task 1); `Dock`, `DockModule` (Task 2); `useOverdueOrders` de `@/hooks/useOverdueOrders`; `useSession` de `next-auth/react`; `usePathname`, `useRouter` de `next/navigation`.
- Produces: `export function DockNav(): React.ReactElement` — fixed bottom, `hidden md:flex`, id `dock-nav`.

- [ ] **Step 1: Criar DockNav.tsx**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useReducedMotion } from "motion/react";
import type { PaddockRole, ExtraPermission } from "@paddock/types";
import { visibleModules, isActiveRoute, isGroupActive } from "./nav-config";
import { Dock, type DockModule } from "./Dock";
import { useOverdueOrders } from "@/hooks/useOverdueOrders";
import { cn } from "@/lib/utils";

const HIDE_DELTA = 64;

function useDockAutoHide(disabled: boolean): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (disabled) return;
    const main = document.getElementById("main-content");
    if (!main) return;

    let lastY = main.scrollTop;
    let anchorY = main.scrollTop;

    const onScroll = () => {
      const y = main.scrollTop;
      const goingDown = y > lastY;
      if (goingDown) {
        if (y - anchorY > HIDE_DELTA) setHidden(true);
      } else {
        anchorY = y;
        setHidden(false);
      }
      lastY = y;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (window.innerHeight - e.clientY <= 24) setHidden(false);
    };

    main.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    return () => {
      main.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [disabled]);

  return disabled ? false : hidden;
}

export function DockNav(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const reduce = useReducedMotion();
  const hidden = useDockAutoHide(reduce ?? false);

  const { data: overdueData } = useOverdueOrders();
  const overdueCount = (overdueData ?? []).filter(
    (o) => o.urgency === "overdue" || o.urgency === "due_today"
  ).length;

  const role = (session?.role ?? "STOREKEEPER") as PaddockRole;
  const perms = (session?.extraPermissions ?? []) as ExtraPermission[];

  const modules: DockModule[] = useMemo(
    () =>
      visibleModules(role, perms).map((item) => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        href: item.href,
        active: isGroupActive(pathname, item),
        badge:
          item.dynamicBadge === "overdue" && overdueCount > 0
            ? overdueCount
            : undefined,
        children: item.children?.map((c) => ({
          id: c.id,
          label: c.label,
          href: c.href,
          icon: c.icon,
          active: isActiveRoute(pathname, c.href),
        })),
      })),
    [role, perms, pathname, overdueCount]
  );

  return (
    <div
      id="dock-nav"
      className={cn(
        "fixed bottom-3 left-1/2 -translate-x-1/2 z-40 hidden md:block",
        "transition-transform duration-300 ease-out",
        hidden && "translate-y-[140%]"
      )}
    >
      <Dock modules={modules} onNavigate={(href) => router.push(href as never)} />
    </div>
  );
}
```

Nota sobre o `translate`: `-translate-x-1/2` e `translate-y-[140%]` compõem via CSS vars do Tailwind — ok juntos.

- [ ] **Step 2: Escrever teste**

`components/dock/DockNav.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DockNav } from "./DockNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/os",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { role: "STOREKEEPER", extraPermissions: [] } }),
}));
vi.mock("@/hooks/useOverdueOrders", () => ({
  useOverdueOrders: () => ({ data: [{ urgency: "overdue" }, { urgency: "due_today" }] }),
}));

describe("DockNav", () => {
  it("filtra módulos por role e marca ativo pelo pathname", () => {
    render(<DockNav />);
    expect(screen.getByRole("button", { name: "Ordens de Serviço" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.queryByRole("button", { name: "Financeiro" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Recursos Humanos" })).not.toBeInTheDocument();
  });

  it("mostra badge de OS atrasadas", () => {
    render(<DockNav />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar teste**

Run: `npm run test -w dscar-web -- src/components/dock/DockNav.test.tsx`
Expected: 2 passed.

- [ ] **Step 4: Typecheck e commit**

Run (em `apps/dscar-web`): `npx tsc --noEmit` — sem erros.

```bash
git add apps/dscar-web/src/components/dock/DockNav.tsx apps/dscar-web/src/components/dock/DockNav.test.tsx
git commit -m "feat(dscar): DockNav com role-gating, badge de atrasadas e auto-hide"
```

---

### Task 4: TopBar

**Files:**
- Create: `components/TopBar.tsx`
- Test: `components/TopBar.test.tsx`

**Interfaces:**
- Consumes: `NotificationBell` (`@/components/header/NotificationBell`), `ThemeToggle` (`@/components/ThemeToggle`), `ROLE_LABELS`, `getInitials` (nav-config), `useSession`/`signOut` de `next-auth/react`, shadcn `DropdownMenu*` de `@/components/ui/dropdown-menu`.
- Produces: `export function TopBar(): React.ReactElement` — header de 48px.

- [ ] **Step 1: Criar TopBar.tsx**

```tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import { Search, LogOut } from "lucide-react";
import { NotificationBell } from "@/components/header/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ROLE_LABELS, getInitials } from "@/components/dock/nav-config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TopBar(): React.ReactElement {
  const { data: session } = useSession();
  const roleLabel = ROLE_LABELS[session?.role ?? ""] ?? session?.role ?? "";

  return (
    <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dscar-logo.png" alt="DS Car" className="h-7 w-auto object-contain logo-themed" draggable={false} />
        <span className="text-[13px] font-semibold text-foreground/85">DSCAR</span>
        <span className="hidden text-[11px] uppercase tracking-[1.5px] text-muted-foreground sm:inline">
          Centro Automotivo
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() =>
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
          }
          className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-left transition-colors hover:bg-muted"
        >
          <Search size={15} className="text-muted-foreground" />
          <span className="hidden text-xs text-muted-foreground md:inline">Buscar...</span>
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70 md:inline">
            ⌘K
          </kbd>
        </button>

        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Menu do usuário"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-[12px] font-bold text-primary-foreground"
            >
              {getInitials(session?.user?.name)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-[13px] font-semibold text-foreground/85">
                {session?.user?.name ?? "Usuário"}
              </p>
              <p className="text-xs font-normal text-muted-foreground">
                DS Car{roleLabel ? ` · ${roleLabel}` : ""}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[13px] text-muted-foreground">Tema</span>
              <ThemeToggle />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut({ callbackUrl: "/login" })}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Escrever teste**

`components/TopBar.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopBar } from "./TopBar";

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { role: "ADMIN", user: { name: "Thiago Campos" } },
  }),
  signOut: vi.fn(),
}));
vi.mock("@/components/header/NotificationBell", () => ({
  NotificationBell: () => <span data-testid="bell" />,
}));
vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <span data-testid="theme" />,
}));

describe("TopBar", () => {
  it("dispara evento ⌘K ao clicar em Buscar", () => {
    const spy = vi.spyOn(document, "dispatchEvent");
    render(<TopBar />);
    fireEvent.click(screen.getByRole("button", { name: /Buscar/ }));
    const evt = spy.mock.calls.at(-1)?.[0] as KeyboardEvent;
    expect(evt.key).toBe("k");
    expect(evt.metaKey).toBe(true);
  });

  it("mostra iniciais do usuário e role no dropdown", () => {
    render(<TopBar />);
    fireEvent.click(screen.getByRole("button", { name: "Menu do usuário" }));
    expect(screen.getByText("Thiago Campos")).toBeInTheDocument();
    expect(screen.getByText(/Administrador/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar teste**

Run: `npm run test -w dscar-web -- src/components/TopBar.test.tsx`
Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/components/TopBar.tsx apps/dscar-web/src/components/TopBar.test.tsx
git commit -m "feat(dscar): TopBar com busca ⌘K, notificações e menu do usuário"
```

---

### Task 5: MobileTabBar

**Files:**
- Create: `components/dock/MobileTabBar.tsx`
- Test: `components/dock/MobileTabBar.test.tsx`

**Interfaces:**
- Consumes: `visibleModules`, `isGroupActive` (Task 1); `useOverdueOrders`; `useSession`; `usePathname`/`useRouter`; shadcn `Sheet, SheetContent, SheetTrigger, SheetTitle` de `@/components/ui/sheet`; ícone `LayoutGrid` de lucide.
- Produces: `export function MobileTabBar(): React.ReactElement` — fixed bottom, `md:hidden`.

- [ ] **Step 1: Criar MobileTabBar.tsx**

```tsx
"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LayoutGrid } from "lucide-react";
import type { PaddockRole, ExtraPermission } from "@paddock/types";
import { visibleModules, isGroupActive, type NavItem } from "./nav-config";
import { useOverdueOrders } from "@/hooks/useOverdueOrders";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const FIXED_COUNT = 4;

export function MobileTabBar(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [moreOpen, setMoreOpen] = useState(false);

  const { data: overdueData } = useOverdueOrders();
  const overdueCount = (overdueData ?? []).filter(
    (o) => o.urgency === "overdue" || o.urgency === "due_today"
  ).length;

  const role = (session?.role ?? "STOREKEEPER") as PaddockRole;
  const perms = (session?.extraPermissions ?? []) as ExtraPermission[];
  const modules = useMemo(() => visibleModules(role, perms), [role, perms]);

  const fixed = modules.slice(0, FIXED_COUNT);
  const rest = modules.slice(FIXED_COUNT);

  function go(item: NavItem) {
    const href = item.href ?? item.children?.[0]?.href;
    if (href) router.push(href as never);
    setMoreOpen(false);
  }

  function TabButton({ item }: { item: NavItem }) {
    const active = isGroupActive(pathname, item);
    const badge = item.dynamicBadge === "overdue" && overdueCount > 0 ? overdueCount : undefined;
    return (
      <button
        type="button"
        onClick={() => go(item)}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors",
          active ? "text-primary font-semibold" : "text-muted-foreground"
        )}
      >
        <item.icon className="h-5 w-5" />
        <span className="truncate max-w-[64px]">{item.label.split(" ")[0]}</span>
        {badge != null && (
          <span className="absolute top-1 right-1/2 translate-x-4 min-w-[16px] h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold font-mono flex items-center justify-center px-1 leading-none">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>
    );
  }

  return (
    <nav
      aria-label="Navegação"
      className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-border bg-card md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {fixed.map((item) => (
        <TabButton key={item.id} item={item} />
      ))}

      {rest.length > 0 && (
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Mais módulos"
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground"
            >
              <LayoutGrid className="h-5 w-5" />
              <span>Mais</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-8">
            <SheetTitle className="text-sm text-muted-foreground mb-4">Módulos</SheetTitle>
            <div className="grid grid-cols-4 gap-4">
              {rest.map((item) => {
                const active = isGroupActive(pathname, item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => go(item)}
                    aria-current={active ? "page" : undefined}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-xl border",
                        active
                          ? "bg-primary/20 border-primary text-primary"
                          : "bg-muted/50 border-border text-muted-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                    </span>
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </nav>
  );
}
```

- [ ] **Step 2: Escrever teste**

`components/dock/MobileTabBar.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileTabBar } from "./MobileTabBar";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push }),
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { role: "OWNER", extraPermissions: [] } }),
}));
vi.mock("@/hooks/useOverdueOrders", () => ({
  useOverdueOrders: () => ({ data: [] }),
}));

describe("MobileTabBar", () => {
  it("mostra 4 módulos fixos + botão Mais", () => {
    render(<MobileTabBar />);
    expect(screen.getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ordens de Serviço" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Orçamentos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mais módulos" })).toBeInTheDocument();
  });

  it("Mais abre sheet com os módulos restantes e navega", () => {
    render(<MobileTabBar />);
    fireEvent.click(screen.getByRole("button", { name: "Mais módulos" }));
    fireEvent.click(screen.getByRole("button", { name: /Estoque/ }));
    expect(push).toHaveBeenCalledWith("/estoque");
  });
});
```

- [ ] **Step 3: Rodar teste**

Run: `npm run test -w dscar-web -- src/components/dock/MobileTabBar.test.tsx`
Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/components/dock/MobileTabBar.tsx apps/dscar-web/src/components/dock/MobileTabBar.test.tsx
git commit -m "feat(dscar): MobileTabBar com 4 módulos fixos e sheet Mais"
```

---

### Task 6: Trocar o layout e deletar Sidebar/MobileSidebar

**Files:**
- Modify: `app/(app)/layout.tsx`
- Delete: `components/MobileSidebar.tsx`
- Delete: `components/Sidebar.tsx`
- Modify: `components/CommandPalette.tsx` (garantir import de nav-config — feito na Task 1; conferir)

**Interfaces:**
- Consumes: `TopBar` (Task 4), `DockNav` (Task 3), `MobileTabBar` (Task 5), `CommandPalette` (existente).
- Produces: layout final sem sidebar.

- [ ] **Step 1: Reescrever layout.tsx**

```tsx
import React from "react";
import { TopBar } from "@/components/TopBar";
import { DockNav } from "@/components/dock/DockNav";
import { MobileTabBar } from "@/components/dock/MobileTabBar";
import { CommandPalette } from "@/components/CommandPalette";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        Ir para o conteúdo principal
      </a>
      <TopBar />
      <main
        id="main-content"
        className="flex-1 overflow-auto bg-background px-6 pt-4 pb-24 max-md:pb-20"
      >
        {children}
      </main>
      <DockNav />
      <MobileTabBar />
      <CommandPalette />
    </div>
  );
}
```

- [ ] **Step 2: Deletar Sidebar e MobileSidebar**

```bash
git rm apps/dscar-web/src/components/Sidebar.tsx apps/dscar-web/src/components/MobileSidebar.tsx
```

Depois: `grep -rn 'components/Sidebar\|components/MobileSidebar' apps/dscar-web/src` — deve retornar vazio (CommandPalette já importa de nav-config desde a Task 1; se sobrar algum import, trocar para `@/components/dock/nav-config`).

- [ ] **Step 3: Typecheck + suíte completa**

Run (em `apps/dscar-web`): `npx tsc --noEmit` — sem erros.
Run (na raiz): `npm run test -w dscar-web` — tudo verde.

- [ ] **Step 4: Verificação manual no browser**

Com `make dev` rodando (Docker) e o front em dev:
1. Login → dashboard: TopBar no topo, dock embaixo, sem sidebar.
2. Clicar em "Ordens de Serviço" no dock → popover Lista/Kanban → navegar.
3. Rolar a lista de OS pra baixo → dock some; rolar pra cima ou encostar o mouse na borda → volta.
4. Badge de atrasadas visível no ícone de OS (se houver OS atrasada no seed).
5. ⌘K abre CommandPalette; avatar → tema e Sair funcionam.
6. Responsivo < 768px (devtools): bottom bar com 4 módulos + Mais; sheet abre e navega.
7. Login como STOREKEEPER (`almoxarife@... / paddock123` do seed): dock sem Financeiro/Fiscal/RH.

- [ ] **Step 5: Commit final**

```bash
git add apps/dscar-web/src/app/\(app\)/layout.tsx
git commit -m "feat(dscar): substitui sidebar pelo dock layout — TopBar + DockNav + MobileTabBar"
```

---

## Self-Review (executado na escrita)

- **Cobertura da spec:** estrutura/layout (Task 6), Dock adaptado com tokens/reduced-motion/a11y/badge (Task 2), DockNav com NAV_SECTIONS/role-gating/auto-hide (Tasks 1+3), TopBar (Task 4), MobileTabBar + Sheet (Task 5), cleanup Sidebar/MobileSidebar (Task 6), testes de role-gating (Task 1) e manuais (Task 6). Sem lacunas.
- **Placeholders:** nenhum TBD; todo step de código tem o código.
- **Consistência de tipos:** `DockModule`/`DockModuleChild` definidos na Task 2 e consumidos na Task 3; `visibleModules(role, perms): NavItem[]` consistente entre Tasks 1/3/5; `NavItem.icon: LucideIcon` compatível com `mod.icon`/`item.icon` renderizados como componente.
