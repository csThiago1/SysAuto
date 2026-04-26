import { cn } from "@/lib/utils"

interface SectionDividerProps {
  label: string
  className?: string
}

export function SectionDivider({ label, className }: SectionDividerProps) {
  return (
    <div className={cn("section-divider", className)}>
      {label}
    </div>
  )
}
