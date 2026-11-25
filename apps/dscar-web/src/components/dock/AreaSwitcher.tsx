"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { AREAS, areaHome, type AreaId } from "./areas";

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
    <nav aria-label="Áreas" className={cn("flex flex-wrap gap-1", className)}>
      {AREAS.filter((a) => areas.includes(a.id)).map((a) => (
        <Link
          key={a.id}
          href={areaHome(a.id)}
          aria-current={a.id === area ? "page" : undefined}
          onClick={onNavigate}
          className={cn(
            "rounded-sm px-2.5 py-2 text-[13px] transition-colors md:py-1",
            a.id === area
              ? "bg-muted/60 font-medium text-foreground"
              : "text-foreground/75 hover:bg-muted/60 hover:text-foreground"
          )}
        >
          {a.label}
        </Link>
      ))}
    </nav>
  );
}
