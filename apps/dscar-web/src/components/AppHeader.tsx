"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import { LogOut, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/header/NotificationBell";

const PAGE_TITLES: Record<string, string> = {
  "/os": "Ordens de Serviço",
  "/os/nova": "Nova OS",
  "/clientes": "Clientes",
};

function getPageTitle(pathname: string): string {
  if (pathname.match(/^\/os\/[^/]+$/)) return "Detalhe da OS";
  return PAGE_TITLES[pathname] ?? "DS Car ERP";
}

export function AppHeader(): React.ReactElement {
  const pathname = usePathname();
  const { data: session } = useSession();
  const title = getPageTitle(pathname);

  return (
    <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-6">
      {/* Page title */}
      <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notification bell — overdue / due-today service orders */}
        <NotificationBell />

        {/* Active company badge */}
        <Badge variant="secondary" className="gap-1.5 font-medium">
          <Building2 className="h-3 w-3" />
          DS Car
        </Badge>

        {/* User info */}
        {session?.user && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white text-sm font-bold">
              {session.user.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <span className="text-sm font-medium text-neutral-700 hidden sm:block">
              {session.user.name}
            </span>
          </div>
        )}

        {/* Sign out */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void signOut({ callbackUrl: "/login" })}
          title="Sair"
        >
          <LogOut className="h-4 w-4 text-neutral-500" />
        </Button>
      </div>
    </header>
  );
}
