"use client";

import Link from "next/link";
import { ChartColumn, Handshake, Wallet, Wrench, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AREAS, areaHome, type AreaId } from "./areas";

const ICONES: Record<AreaId, LucideIcon> = {
  oficina: Wrench,
  comercial: Handshake,
  financeiro: Wallet,
  gestao: ChartColumn,
};

export function AreaSwitcher({
  area,
  areas,
  onNavigate,
  className,
}: {
  area: AreaId;
  areas: AreaId[];
  onNavigate?: () => void;
  className?: string;
}): React.ReactElement {
  return (
    <nav aria-label="Áreas" className={className}>
      <p className="label-mono mb-1.5">Área</p>
      <div className="grid grid-cols-2 gap-1.5">
        {AREAS.filter((a) => areas.includes(a.id)).map((a) => {
          const Icone = ICONES[a.id];
          const ativa = a.id === area;
          return (
            <Link
              key={a.id}
              href={areaHome(a.id)}
              aria-current={ativa ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "flex h-11 items-center gap-1.5 rounded-sm border px-2 text-[13px] font-medium transition-colors md:h-9",
                ativa
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted/40 text-foreground/80 hover:bg-muted hover:text-foreground"
              )}
            >
              <Icone className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{a.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
