"use client"

import type { CatalogOption } from "./catalog.schema"

/** Logo da montadora ou monograma, no padrão do `InsurerLogo` compacto. */
export function MakeLogo({ make }: { make: Pick<CatalogOption, "label" | "logo_url"> }) {
  if (make.logo_url) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-muted/50">
        <img src={make.logo_url} alt="" className="h-5 w-5 object-contain" />
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold text-foreground select-none"
    >
      {make.label.slice(0, 2).toUpperCase() || "?"}
    </span>
  )
}
