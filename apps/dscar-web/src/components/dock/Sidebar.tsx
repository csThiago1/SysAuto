"use client";

import { sair } from "@/lib/sair";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronRight, LogOut, Plus } from "lucide-react";
import type { PaddockRole, ExtraPermission } from "@paddock/types";
import { NotificationBell } from "@/components/header/NotificationBell";
import { OfflineStatusBar } from "@/components/offline/OfflineStatusBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ROLE_LABELS,
  getInitials,
  isActiveRoute,
  isGroupActive,
  podeAbrirOS,
  type NavItem,
} from "./nav-config";
import { AreaSwitcher } from "./AreaSwitcher";
import { sectionsForArea } from "./areas";
import { useActiveArea } from "./useActiveArea";
import { Placar, usePlacar } from "./Placar";
import { SearchTrigger } from "./DockActions";
import { useIsDesktop } from "@/hooks/useIsDesktop";

/** Entre irmãos, acende só o href mais específico (/financeiro/dre, não /financeiro). */
export function activeHref(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((h) => isActiveRoute(pathname, h))
    .sort((a, b) => b.length - a.length)[0];
}

/** Faixa vermelha inclinada do item ativo (a mesma do site). */
const ATIVO =
  "bg-primary text-primary-foreground font-medium [clip-path:polygon(6px_0,100%_0,calc(100%-6px)_100%,0_100%)]";

function Row({
  href,
  label,
  icon: Icon,
  active,
  count,
}: {
  href: string;
  label: string;
  icon: NavItem["icon"];
  active: boolean;
  count?: number;
}) {
  return (
    <Link
      href={href as Route}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-sm px-3 py-[7px] text-[13px] transition-colors",
        active ? ATIVO : "text-foreground/75 hover:bg-muted/60 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{label}</span>
      {count != null && (
        <span className="font-plate text-[15px] font-bold leading-none tabular-nums">{count}</span>
      )}
    </Link>
  );
}

/** Item com até 2 filhos vira linhas soltas; com mais, um grupo que abre no lugar. */
function Item({ item, pathname, counts }: { item: NavItem; pathname: string; counts: Record<string, number | undefined> }) {
  const kids = item.children ?? [];
  const ativo = activeHref(pathname, kids.map((k) => k.href));
  if (kids.length <= 2) {
    const rows = kids.length ? kids : [{ id: item.id, label: item.label, icon: item.icon, href: item.href ?? "/" }];
    return (
      <>
        {rows.map((r) => (
          <Row
            key={r.id}
            href={r.href}
            label={r.label}
            icon={r.icon}
            active={kids.length ? r.href === ativo : isActiveRoute(pathname, r.href)}
            count={counts[r.href]}
          />
        ))}
      </>
    );
  }
  return (
    <details open={isGroupActive(pathname, item)}>
      <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-sm px-3 py-[7px] text-[13px] text-foreground/75 hover:bg-muted/60 hover:text-foreground [&::-webkit-details-marker]:hidden">
        <item.icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate">{item.label}</span>
        <ChevronRight className="h-3.5 w-3.5 transition-transform [details[open]>summary>&]:rotate-90" aria-hidden />
      </summary>
      <div className="ml-[18px] border-l border-border pl-1.5">
        {kids.map((c) => (
          <Row key={c.id} href={c.href} label={c.label} icon={c.icon} active={c.href === ativo} />
        ))}
      </div>
    </details>
  );
}

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.role ?? "STOREKEEPER") as PaddockRole;
  const perms = (session?.extraPermissions ?? []) as ExtraPermission[];
  const roleLabel = ROLE_LABELS[session?.role ?? ""] ?? session?.role ?? "";

  const { area, areas } = useActiveArea();
  const items = sectionsForArea(role, perms, area).flatMap((s) => s.items);
  // A barra fica escondida (CSS) no celular: sempre desenhada (sem pular no
  // desktop), mas o placar só busca dados em tela md+. O sino divide a query de
  // atrasadas com a barra de abas do celular, então não pesa a mais.
  const desktop = useIsDesktop();
  const counts = { "/os": usePlacar(desktop).patio };

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="space-y-4 border-b border-border px-4 pb-4 pt-4">
        <div className="flex gap-4">
          {/* Logo "Parada Obrigatória" (ticket): branca no escuro, preta no claro */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-ticket-preta.svg" alt="DS Car Centro Automotivo" className="h-20 w-auto shrink-0 dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-ticket-branca.svg" alt="" aria-hidden className="hidden h-20 w-auto shrink-0 dark:block" />
          <Placar torre ativo={desktop} className="min-w-0 flex-1" />
        </div>
        {podeAbrirOS(role) && (
          <Link
            href="/recepcao"
            className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nova OS
          </Link>
        )}
      </div>

      <nav aria-label="Módulos" className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        <AreaSwitcher area={area} areas={areas} className="mb-3 border-b border-border pb-3" />
        {items.map((i) => (
          <Item key={i.id} item={i} pathname={pathname} counts={counts} />
        ))}
      </nav>

      <div className="space-y-2 border-t border-border p-3">
        <SearchTrigger atalho={false} className="flex h-9 w-full items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:text-foreground" />
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Menu do usuário"
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1.5 text-left hover:bg-muted/60"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
                  {getInitials(session?.user?.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-foreground">{session?.user?.name ?? "Usuário"}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{roleLabel}</span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                DS Car{roleLabel ? ` · ${roleLabel}` : ""}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-[13px] text-muted-foreground">Tema</span>
                <ThemeToggle />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void sair()}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <OfflineStatusBar />
          <NotificationBell />
        </div>
      </div>
    </aside>
  );
}
