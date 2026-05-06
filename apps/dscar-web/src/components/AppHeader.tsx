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
  "/dashboard": "Dashboard",
  "/service-orders": "Ordens de Serviço",
  "/service-orders/new": "Nova OS",
  "/service-orders/kanban": "Kanban",
  "/cadastros": "Cadastros",
  "/rh": "Recursos Humanos",
  "/rh/colaboradores": "Colaboradores",
  "/rh/colaboradores/novo": "Nova Admissão",
  "/rh/ponto": "Ponto",
  "/rh/ponto/espelho": "Espelho de Ponto",
  "/rh/metas": "Metas",
  "/rh/vales": "Vales e Benefícios",
  "/rh/folha": "Folha de Pagamento",
  "/rh/folha/contracheque": "Contracheques",
};

function getPageTitle(pathname: string): string {
  // Exato primeiro
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Padrões dinâmicos
  if (pathname.match(/^\/service-orders\/[^/]+$/)) return "Ordem de Serviço";
  if (pathname.match(/^\/rh\/colaboradores\/[^/]+$/)) return "Colaborador";
  if (pathname.match(/^\/rh\/folha\/[^/]+$/)) return "Detalhe da Folha";
  if (pathname.match(/^\/os\/[^/]+$/)) return "Ordem de Serviço";
  return "DS Car ERP";
}

export function AppHeader(): React.ReactElement {
  const pathname = usePathname();
  const { data: session } = useSession();
  const title = getPageTitle(pathname);

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      {/* Page title */}
      <h1 className="text-lg font-semibold text-foreground/90">{title}</h1>

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
            <span className="text-sm font-medium text-foreground/70 hidden sm:block">
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
          <LogOut className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </header>
  );
}
