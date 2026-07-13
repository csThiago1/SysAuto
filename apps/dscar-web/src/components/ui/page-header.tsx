/**
 * PageHeader — Header de página com título, subtítulo e ações
 * Componente padrão para o topo de todas as páginas do ERP.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  /** Elementos de ação — ex: <Button>Nova OS</Button> */
  actions?: ReactNode;
}

export function PageHeader({ title, description, backHref, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex items-start gap-3 min-w-0">
        {backHref && (
          <Button variant="ghost" size="icon" asChild>
            <Link href={backHref as any}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Voltar</span>
            </Link>
          </Button>
        )}
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-foreground break-words">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
