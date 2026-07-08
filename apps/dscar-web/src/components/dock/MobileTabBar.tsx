"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LayoutGrid } from "lucide-react";
import type { Route } from "next";
import type { PaddockRole, ExtraPermission } from "@paddock/types";
import { visibleModules, isGroupActive, type NavItem } from "./nav-config";
import { useOverdueOrders } from "@/hooks/useOverdueOrders";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const FIXED_COUNT = 4;

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
  const modules = useMemo(() => visibleModules(role, perms), [role, perms]);

  const fixed = modules.slice(0, FIXED_COUNT);
  const rest = modules.slice(FIXED_COUNT);

  function go(item: NavItem) {
    const href = item.href ?? item.children?.[0]?.href;
    if (href) router.push(href as Route);
    setMoreOpen(false);
  }

  return (
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
            <SheetDescription className="sr-only">Lista de módulos</SheetDescription>
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
  );
}
