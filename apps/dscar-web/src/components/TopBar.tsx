"use client";

import { useSession, signOut } from "next-auth/react";
import { Search, LogOut } from "lucide-react";
import { NotificationBell } from "@/components/header/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ROLE_LABELS, getInitials } from "@/components/dock/nav-config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TopBar(): React.ReactElement {
  const { data: session } = useSession();
  const roleLabel = ROLE_LABELS[session?.role ?? ""] ?? session?.role ?? "";

  return (
    <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dscar-logo.png" alt="DS Car" className="h-7 w-auto object-contain logo-themed" draggable={false} />
        <span className="text-[13px] font-semibold text-foreground/85">DSCAR</span>
        <span className="hidden text-[11px] uppercase tracking-[1.5px] text-muted-foreground sm:inline">
          Centro Automotivo
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() =>
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
          }
          className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-left transition-colors hover:bg-muted"
        >
          <Search size={15} className="text-muted-foreground" />
          <span className="hidden text-xs text-muted-foreground md:inline">Buscar...</span>
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70 md:inline">
            ⌘K
          </kbd>
        </button>

        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Menu do usuário"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-[12px] font-bold text-primary-foreground"
            >
              {getInitials(session?.user?.name)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-[13px] font-semibold text-foreground/85">
                {session?.user?.name ?? "Usuário"}
              </p>
              <p className="text-xs font-normal text-muted-foreground">
                DS Car{roleLabel ? ` · ${roleLabel}` : ""}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[13px] text-muted-foreground">Tema</span>
              <ThemeToggle />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut({ callbackUrl: "/login" })}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
