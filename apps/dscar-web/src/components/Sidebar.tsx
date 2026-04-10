"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { Gauge, ClipboardList, LayoutGrid, UsersRound, Briefcase, PanelLeftClose, PanelLeftOpen, ChevronDown, ChevronRight, List, Wallet, BookOpen, ReceiptText, TrendingUp } from "lucide-react";
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
    href: "/cadastros",
    label: "Cadastros",
    icon: <UsersRound className="h-5 w-5 shrink-0" />,
  },
  {
    href: "/rh",
    label: "RH",
    icon: <Briefcase className="h-5 w-5 shrink-0" />,
  },
];

const osSubItems = [
  { href: "/service-orders", label: "Lista", icon: <List className="h-4 w-4 shrink-0" /> },
  { href: "/service-orders/kanban", label: "Kanban", icon: <LayoutGrid className="h-4 w-4 shrink-0" /> },
];

const financeiroSubItems = [
  { href: "/financeiro/lancamentos", label: "Lançamentos", icon: <ReceiptText className="h-4 w-4 shrink-0" /> },
  { href: "/financeiro/plano-contas", label: "Plano de Contas", icon: <BookOpen className="h-4 w-4 shrink-0" /> },
  { href: "/financeiro/contas-pagar", label: "Contas a Pagar", icon: <TrendingUp className="h-4 w-4 shrink-0 rotate-180" /> },
  { href: "/financeiro/contas-receber", label: "Contas a Receber", icon: <TrendingUp className="h-4 w-4 shrink-0" /> },
];

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  const osIsActive =
    pathname.startsWith("/service-orders") || pathname.startsWith("/os");

  const financeiroIsActive = pathname.startsWith("/financeiro");

  const [osOpen, setOsOpen] = useState<boolean>(osIsActive);
  const [financeiroOpen, setFinanceiroOpen] = useState<boolean>(financeiroIsActive);

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
        {/* Dashboard */}
        {navItems.slice(0, 1).map((item) => {
          const isActive = isNavItemActive(item, pathname);
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href as Route}
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

        {/* OS submenu */}
        <div>
          <button
            type="button"
            onClick={() => setOsOpen((p) => !p)}
            className={cn(
              "flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition-colors",
              osIsActive
                ? "border-l-2 border-l-primary-600 bg-primary-600/10 text-primary-400 pl-[10px]"
                : "text-secondary-300 hover:bg-secondary-900 hover:text-white"
            )}
            title="OS"
          >
            <ClipboardList className="h-5 w-5 shrink-0" />
            {!sidebarCollapsed && (
              <>
                <span className="flex-1 truncate text-left">OS</span>
                {osOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
              </>
            )}
          </button>

          {osOpen && !sidebarCollapsed && (
            <div className="mt-1 space-y-1">
              {osSubItems.map((sub) => {
                const isSubActive = pathname === sub.href || pathname.startsWith(sub.href + "/");
                return (
                  <Link
                    key={sub.href}
                    href={sub.href as Route}
                    className={cn(
                      "flex items-center gap-3 rounded pl-8 pr-3 py-2 text-sm font-medium transition-colors",
                      isSubActive
                        ? "text-primary-400 bg-primary-600/10"
                        : "text-secondary-400 hover:bg-secondary-900 hover:text-white"
                    )}
                  >
                    {sub.icon}
                    <span className="truncate">{sub.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Financeiro submenu */}
        <div>
          <button
            type="button"
            onClick={() => setFinanceiroOpen((p) => !p)}
            className={cn(
              "flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition-colors",
              financeiroIsActive
                ? "border-l-2 border-l-primary-600 bg-primary-600/10 text-primary-400 pl-[10px]"
                : "text-secondary-300 hover:bg-secondary-900 hover:text-white"
            )}
            title="Financeiro"
          >
            <Wallet className="h-5 w-5 shrink-0" />
            {!sidebarCollapsed && (
              <>
                <span className="flex-1 truncate text-left">Financeiro</span>
                {financeiroOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
              </>
            )}
          </button>

          {financeiroOpen && !sidebarCollapsed && (
            <div className="mt-1 space-y-1">
              {financeiroSubItems.map((sub) => {
                const isSubActive = pathname === sub.href || pathname.startsWith(sub.href + "/");
                return (
                  <Link
                    key={sub.href}
                    href={sub.href as Route}
                    className={cn(
                      "flex items-center gap-3 rounded pl-8 pr-3 py-2 text-sm font-medium transition-colors",
                      isSubActive
                        ? "text-primary-400 bg-primary-600/10"
                        : "text-secondary-400 hover:bg-secondary-900 hover:text-white"
                    )}
                  >
                    {sub.icon}
                    <span className="truncate">{sub.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Remaining nav items (Cadastros, RH) */}
        {navItems.slice(1).map((item) => {
          const isActive = isNavItemActive(item, pathname);
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href as Route}
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
