"use client";

import { cn } from "@/lib/utils";
import { AREAS, type AreaId } from "./areas";

export function AreaSwitcher({
  area,
  areas,
  onChange,
  className,
}: {
  area: AreaId;
  areas: AreaId[];
  onChange: (a: AreaId) => void;
  className?: string;
}): React.ReactElement {
  return (
    <div role="tablist" aria-label="Áreas" className={cn("flex flex-wrap gap-1", className)}>
      {AREAS.filter((a) => areas.includes(a.id)).map((a) => (
        <button
          key={a.id}
          type="button"
          role="tab"
          aria-selected={a.id === area}
          onClick={() => onChange(a.id)}
          className={cn(
            "rounded-sm px-2.5 py-1 text-[13px] transition-colors",
            a.id === area
              ? "bg-muted/60 font-medium text-foreground"
              : "text-foreground/75 hover:bg-muted/60 hover:text-foreground"
          )}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
