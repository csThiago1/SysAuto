"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LayoutGrid, Plus } from "lucide-react";
import type { Route } from "next";
import { ROLE_HIERARCHY, type PaddockRole, type ExtraPermission } from "@paddock/types";
import {
  visibleModules,
  isGroupActive,
  MOBILE_TABS,
  FAB_HIDDEN_SUBPATHS,
  type NavItem,
} from "./nav-config";
import { useOverdueOrders } from "@/hooks/useOverdueOrders";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AccountSheetBlock } from "./DockActions";
import { cn } from "@/lib/utils";

interface TabButtonProps {
  item: NavItem;
  active: boolean;
  badge?: number;
  onClick: () => void;
}

function TabButton({ item, active, badge, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
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
  const level = ROLE_HIERARCHY[role] ?? 0;

  // Modo operação: tabs fixas pra todos; navegação completa só no "Mais" (MANAGER+)
  const fixed = MOBILE_TABS;
  const rest = useMemo(
    () => (level >= ROLE_HIERARCHY.MANAGER ? visibleModules(role, perms) : []),
    [level, role, perms]
  );

  const fabVisible =
    level >= ROLE_HIERARCHY.CONSULTANT &&
    !FAB_HIDDEN_SUBPATHS.some((p) => pathname.includes(p));

  function go(item: NavItem) {
    const href = item.href ?? item.children?.[0]?.href;
    if (href) router.push(href as Route);
    setMoreOpen(false);
  }

  return (
    <>
    {fabVisible && (
      <button
        type="button"
        aria-label="Nova OS"
        onClick={() => router.push("/recepcao" as Route)}
        className="fixed right-4 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform md:hidden"
        style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
      >
        <Plus className="h-6 w-6" />
      </button>
    )}
    <nav
      aria-label="Navegação"
      className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-border bg-card md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {fixed.map((item) => (
        <TabButton
          key={item.id}
          item={item}
          active={isGroupActive(pathname, item)}
          badge={
            item.dynamicBadge === "overdue" && overdueCount > 0 ? overdueCount : undefined
          }
          onClick={() => go(item)}
        />
      ))}

      {/* Sempre presente: sem o header, esta folha e o unico caminho pra busca,
          notificacao, tema e SAIR no telefone. Antes ela so aparecia pra
          MANAGER+ (quem tinha modulos extras) — um almoxarife ficaria sem sair. */}
      {(
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Conta e mais módulos"
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground"
            >
              <LayoutGrid className="h-5 w-5" />
              <span>Mais</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-8">
            <SheetTitle className="sr-only">Conta e módulos</SheetTitle>
            <SheetDescription className="sr-only">
              Busca, notificações, tema, sair e lista de módulos
            </SheetDescription>

            <AccountSheetBlock />

            {rest.length > 0 && (
              <p className="label-mono mb-3 border-t border-border pt-4">Módulos</p>
            )}
            <div className="grid grid-cols-4 gap-4">
              {rest.map((item) => {
                const active = isGroupActive(pathname, item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => go(item)}
                    aria-label={item.label}
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
    </>
  );
}
