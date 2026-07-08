"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Search,
  LogOut,
  ChevronLeft,
  ChevronDown,
  Building2,
} from "lucide-react";
import { type PaddockRole, type ExtraPermission } from "@paddock/types";
import { NotificationBell } from "@/components/header/NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { useOverdueOrders } from "@/hooks/useOverdueOrders";
export {
  NAV_SECTIONS, ROLE_LABELS, isActiveRoute, isGroupActive, getInitials,
} from "@/components/dock/nav-config";
export type { NavChild, NavItem, NavSection } from "@/components/dock/nav-config";
import {
  NAV_SECTIONS, ROLE_LABELS, isActiveRoute, isGroupActive, getInitials,
  visibleSections,
} from "@/components/dock/nav-config";

// ─── DS Car Logo (inline) ─────────────────────────────────────────────

function DSCarLogoInline({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/dscar-logo.png"
        alt="DS Car"
        className="h-9 w-9 object-contain logo-themed"
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
        className="h-12 w-auto object-contain flex-shrink-0 logo-themed"
        draggable={false}
      />
      <div className="flex flex-col leading-none">
        <span className="font-extrabold text-[16px] text-foreground tracking-wide">
          DSCAR
        </span>
        <span className="font-normal text-[9.5px] text-muted-foreground tracking-[1.5px] uppercase mt-0.5">
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
  const userRole = (session?.role ?? "STOREKEEPER") as PaddockRole;
  const userPerms = (session?.extraPermissions ?? []) as ExtraPermission[];
  const sections = useMemo(
    () => visibleSections(userRole, userPerms),
    [userRole, userPerms]
  );

  return (
    <aside
      ref={sidebarRef}
      className={[
        "relative flex-col h-screen bg-card shadow-lg",
        "transition-[width] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        "flex-shrink-0 overflow-hidden",
        "hidden md:flex",
        collapsed ? "w-[72px]" : "w-[260px]",
      ].join(" ")}
    >
      {/* ── Header ── */}
      <div
        className={[
          "flex items-center border-b border-border min-h-[76px]",
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
              className="w-7 h-7 rounded-md border border-border bg-muted/50 text-muted-foreground
                         flex items-center justify-center hover:bg-muted hover:text-foreground
                         transition-all duration-150 flex-shrink-0"
              aria-label="Recolher sidebar"
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

      {/* ── Search / Command Palette trigger ── */}
      {!collapsed && (
        <button
          type="button"
          onClick={() => {
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
          }}
          className="flex items-center rounded-lg border border-border bg-muted/50 mx-4 my-3 px-3 py-2 gap-2 hover:bg-muted transition-colors text-left"
        >
          <Search size={18} className="text-muted-foreground flex-shrink-0" />
          <span className="text-[13px] text-muted-foreground font-normal flex-1">
            Buscar...
          </span>
          <kbd className="text-[10px] text-muted-foreground/70 font-mono bg-muted border border-border rounded px-1.5 py-0.5">
            ⌘K
          </kbd>
        </button>
      )}

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-thin">
        {sections.map((section) => (
          <div key={section.label}>
            {/* Section label */}
            {collapsed ? (
              <hr className="border-border mx-3 my-2" />
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
                        ? "bg-primary/[0.12] text-primary"
                        : hovered
                        ? "bg-muted text-foreground/70"
                        : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {/* Active bar */}
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-sm bg-primary" />
                    )}

                    <item.icon size={20} className="flex-shrink-0" />

                    {!collapsed && (
                      <>
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
                      </>
                    )}

                    {/* Numeric badge no modo colapsado */}
                    {collapsed && badge != null && (
                      <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-primary text-white text-xs font-bold font-mono flex items-center justify-center px-0.5 leading-none">
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
                                ? "bg-primary/[0.08] text-primary font-medium"
                                : childHovered
                                ? "bg-muted/50 text-foreground/60"
                                : "text-muted-foreground",
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
        <div
          className={[
            "flex items-center rounded-lg bg-muted/50",
            "hover:bg-muted transition-colors duration-150",
            collapsed ? "p-2 justify-center" : "p-2 gap-2.5",
          ].join(" ")}
        >
          <div className="w-[34px] h-[34px] rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center font-bold text-[13px] text-white flex-shrink-0">
            {userInitials}
          </div>
          {!collapsed && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* ── Tooltip (collapsed mode) ── */}
      {collapsed && (
        <div
          className={[
            "absolute left-[calc(100%+12px)] z-50 bg-popover border border-border",
            "text-popover-foreground px-3 py-1.5 rounded-md text-[12px] font-medium whitespace-nowrap",
            "pointer-events-none shadow-lg",
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
