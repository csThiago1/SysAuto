"use client";

import { useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Menu, LogOut, ChevronDown, Building2 } from "lucide-react";
import { ROLE_HIERARCHY, type PaddockRole } from "@paddock/types";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { NotificationBell } from "@/components/header/NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { useOverdueOrders } from "@/hooks/useOverdueOrders";
import {
  NAV_SECTIONS,
  ROLE_LABELS,
  isActiveRoute,
  isGroupActive,
  getInitials,
} from "./Sidebar";

// ─── MobileSidebar ───────────────────────────────────────────────────

export function MobileSidebar(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const { data: overdueData } = useOverdueOrders();
  const overdueCount = (overdueData ?? []).filter(
    (o) => o.urgency === "overdue" || o.urgency === "due_today"
  ).length;

  const [open, setOpen] = useState(false);
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

  const toggleGroup = useCallback((id: string) => {
    setExpandedGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }, []);

  const handleNav = useCallback(
    (href: string) => {
      router.push(href as Parameters<typeof router.push>[0]);
      setOpen(false);
    },
    [router]
  );

  const userInitials = getInitials(session?.user?.name);
  const roleLabel = ROLE_LABELS[session?.role ?? ""] ?? session?.role ?? "";
  const userRoleLevel = ROLE_HIERARCHY[(session?.role ?? "STOREKEEPER") as PaddockRole] ?? 0;
  const visibleSections = NAV_SECTIONS.filter((s) =>
    !s.minRole || userRoleLevel >= (ROLE_HIERARCHY[s.minRole] ?? 0)
  );

  return (
    <>
      {/* ── Mobile top bar ── */}
      <header className="flex md:hidden items-center justify-between h-14 px-4 border-b border-border bg-card shrink-0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Abrir menu de navegação"
        >
          <Menu size={22} />
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/dscar-logo.png"
          alt="DS Car"
          className="h-8 w-auto object-contain logo-themed"
          draggable={false}
        />

        <NotificationBell />
      </header>

      {/* ── Sheet overlay ── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>

          {/* ── Sheet header / logo ── */}
          <div className="flex items-center gap-3 px-5 min-h-[64px] border-b border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/dscar-logo.png"
              alt="DS Car"
              className="h-10 w-auto object-contain flex-shrink-0 logo-themed"
              draggable={false}
            />
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-[15px] text-foreground tracking-wide">
                DSCAR
              </span>
              <span className="font-normal text-[9px] text-muted-foreground tracking-[1.5px] uppercase mt-0.5">
                Centro Automotivo
              </span>
            </div>
          </div>

          {/* ── Navigation ── */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-thin">
            {visibleSections.map((section) => (
              <div key={section.label}>
                <div className="section-divider px-5 pt-4 pb-1.5">
                  {section.label}
                </div>

                {section.items.map((item) => {
                  const active = isGroupActive(pathname, item);
                  const expanded = expandedGroups.includes(item.id);
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
                        className={[
                          "relative flex items-center w-[calc(100%-20px)] mx-2.5 rounded-lg transition-all duration-150",
                          "px-5 py-2.5 gap-3",
                          active
                            ? "bg-primary/[0.12] text-primary"
                            : "text-muted-foreground active:bg-muted",
                        ].join(" ")}
                      >
                        {active && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-sm bg-primary" />
                        )}

                        <item.icon size={20} className="flex-shrink-0" />
                        <span className="text-[13.5px] font-medium whitespace-nowrap overflow-hidden text-ellipsis text-left">
                          {item.label}
                        </span>

                        {badge != null && (
                          <span className="ml-auto bg-primary text-white text-xs font-bold font-mono px-[7px] py-[2px] rounded-[10px] leading-4">
                            {badge}
                          </span>
                        )}
                        {item.children && (
                          <ChevronDown
                            size={16}
                            className={[
                              "text-muted-foreground/60 transition-transform duration-200",
                              badge == null ? "ml-auto" : "",
                              expanded ? "rotate-180" : "",
                            ].join(" ")}
                          />
                        )}
                      </button>

                      {/* ── Children ── */}
                      {item.children && expanded && (
                        <div className="animate-fade-in">
                          {item.children.map((child) => {
                            const childActive = isActiveRoute(pathname, child.href);

                            return (
                              <button
                                key={child.id}
                                type="button"
                                onClick={() => handleNav(child.href)}
                                className={[
                                  "flex items-center gap-2.5 w-[calc(100%-20px)] mx-2.5 pl-[52px] pr-5 py-2",
                                  "rounded-md transition-all duration-150 text-left",
                                  childActive
                                    ? "bg-primary/[0.08] text-primary font-medium"
                                    : "text-muted-foreground active:bg-muted/50",
                                ].join(" ")}
                              >
                                <span
                                  className={[
                                    "w-[5px] h-[5px] rounded-full flex-shrink-0 transition-colors duration-150",
                                    childActive ? "bg-primary" : "bg-muted-foreground/30",
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
          <div className="border-t border-border p-4">
            <div className="flex items-center rounded-lg bg-muted/50 p-2 gap-2.5">
              <div className="w-[34px] h-[34px] rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center font-bold text-[13px] text-white flex-shrink-0">
                {userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-foreground/85 whitespace-nowrap overflow-hidden text-ellipsis">
                  {session?.user?.name ?? "Usuário"}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Building2 size={10} className="text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground font-normal truncate">
                    DS Car{roleLabel ? ` · ${roleLabel}` : ""}
                  </span>
                </div>
              </div>
              <ThemeToggle />
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: "/login" })}
                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                aria-label="Sair"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
