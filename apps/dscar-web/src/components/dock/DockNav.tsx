"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import { useSession } from "next-auth/react";
import { useReducedMotion } from "motion/react";
import type { PaddockRole, ExtraPermission } from "@paddock/types";
import { visibleModules, isActiveRoute, isGroupActive } from "./nav-config";
import { Dock, type DockModule } from "./Dock";
import { DockActions } from "./DockActions";
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
        "fixed bottom-3 left-1/2 -translate-x-1/2 z-40 hidden md:flex",
        "transition-transform duration-300 ease-out",
        hidden && "translate-y-[140%]"
      )}
    >
      <Dock
        modules={modules}
        onNavigate={(href) => router.push(href as Route)}
        trailing={<DockActions />}
      />
    </div>
  );
}
