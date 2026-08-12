"use client";

import { useSession, signOut } from "next-auth/react";
import { Search, LogOut } from "lucide-react";
import { NotificationBell } from "@/components/header/NotificationBell";
import { OfflineStatusBar } from "@/components/offline/OfflineStatusBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ROLE_LABELS, getInitials } from "./nav-config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Utilitários do app — busca, notificações, conta.
 *
 * Viviam num header de largura inteira que não fazia mais nada: 48px de altura
 * permanente para uma logo e três botões encostados na quina. Aqui eles moram
 * na doca, depois de um divisor, como o Dock do macOS separa apps de utilidades.
 *
 * A doca é `md:` — no telefone estes mesmos controles ficam na folha "Mais"
 * da MobileTabBar. Ver `AccountSheetBlock`.
 */

/**
 * Abre a paleta de comandos — a mesma tecla, num alvo clicável.
 * `atalho` sai no telefone: nao existe ⌘ pra prometer ali.
 */
export function SearchTrigger({
  className,
  atalho = true,
}: {
  className?: string;
  atalho?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label="Buscar (⌘K)"
      onClick={() =>
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
      }
      className={
        className ??
        "flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      }
    >
      <Search className="h-4 w-4" />
      {atalho ? (
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70">
          ⌘K
        </kbd>
      ) : (
        <span>Buscar</span>
      )}
    </button>
  );
}

export function DockActions(): React.ReactElement {
  const { data: session } = useSession();
  const roleLabel = ROLE_LABELS[session?.role ?? ""] ?? session?.role ?? "";

  return (
    <>
      {/* Divisor: navegação de um lado, utilidades do outro. */}
      <span className="mx-1 h-8 w-px self-center bg-border" aria-hidden />

      <OfflineStatusBar />
      <SearchTrigger />

      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground">
        <NotificationBell />
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Menu do usuário"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-[12px] font-bold text-primary-foreground"
          >
            {getInitials(session?.user?.name)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" sideOffset={12} className="w-56">
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
    </>
  );
}

/**
 * Mesmos controles, no telefone: a doca não existe abaixo de `md`, e sem isto
 * matar o header tirava busca, notificação, tema e SAIR do mobile inteiro.
 */
export function AccountSheetBlock(): React.ReactElement {
  const { data: session } = useSession();
  const roleLabel = ROLE_LABELS[session?.role ?? ""] ?? session?.role ?? "";

  return (
    <div className="mb-5 space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-[12px] font-bold text-primary-foreground">
          {getInitials(session?.user?.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground/85">
            {session?.user?.name ?? "Usuário"}
          </p>
          <p className="text-xs text-muted-foreground">
            DS Car{roleLabel ? ` · ${roleLabel}` : ""}
          </p>
        </div>
        <NotificationBell />
        <ThemeToggle />
      </div>

      <div className="flex items-center gap-2">
        <SearchTrigger
          atalho={false}
          className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground"
        />
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/login" })}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  );
}
