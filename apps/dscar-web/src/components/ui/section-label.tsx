import { cn } from "@/lib/utils"

/** Título de seção da torre (mesmo estilo do .section-divider). Organiza sem card em volta. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("section-divider", className)}>
      {children}
    </p>
  )
}
