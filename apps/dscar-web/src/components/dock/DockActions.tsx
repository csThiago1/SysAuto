"use client";

import { useSession, signOut } from "next-auth/react";
import { Search, LogOut } from "lucide-react";
import { NotificationBell } from "@/components/header/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ROLE_LABELS, getInitials } from "./nav-config";

/**
 * Utilitários do app — busca e o bloco de conta do telefone.
 * No desktop os mesmos controles moram no rodapé da `Sidebar`.
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

/**
 * Mesmos controles, no telefone: a barra lateral não existe abaixo de `md`, e
 * sem isto o mobile ficava sem busca, notificação, tema e SAIR.
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
