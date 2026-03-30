"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gauge, ClipboardList, LayoutGrid, Users, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { DsCarLogo } from "@/components/DsCarLogo";
import { useUIStore } from "@/store/ui.store";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Match only the exact path, not sub-paths */
  exact?: boolean;
}

function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: <Gauge className="h-5 w-5 shrink-0" />,
  },
  {
    href: "/os",
    label: "Ordens de Serviço",
    icon: <ClipboardList className="h-5 w-5 shrink-0" />,
    // exact so /os/kanban doesn't also highlight this item
    exact: true,
  },
  {
    href: "/os/kanban",
    label: "Kanban",
    icon: <LayoutGrid className="h-5 w-5 shrink-0" />,
  },
  {
    href: "/clientes",
    label: "Clientes",
    icon: <Users className="h-5 w-5 shrink-0" />,
  },
];

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        "flex flex-col bg-secondary-950 border-r border-secondary-900 transition-all duration-normal",
        sidebarCollapsed ? "w-sidebar-compact" : "w-sidebar"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center px-4 border-b border-secondary-900">
        <DsCarLogo
          variant="light"
          iconOnly={sidebarCollapsed}
          size={20}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = isNavItemActive(item, pathname);
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href as never}
              className={cn(
                "flex items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-l-2 border-l-primary-600 bg-primary-600/10 text-primary-400 pl-[10px]"
                  : "text-secondary-300 hover:bg-secondary-900 hover:text-white"
              )}
            >
              {item.icon}
              {!sidebarCollapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse button */}
      <div className="border-t border-secondary-900 p-2">
        <button
          onClick={toggleSidebar}
          className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm text-secondary-400 hover:bg-secondary-900 hover:text-white transition-colors"
          title={sidebarCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-5 w-5 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="h-5 w-5 shrink-0" />
              <span>Recolher</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
