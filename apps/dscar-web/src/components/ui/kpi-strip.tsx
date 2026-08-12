import { cn } from "@/lib/utils"

export interface KpiItem {
  label: string
  value: string
  icon: React.ReactNode
  /** classes da pastilha, ex: "bg-success-500/10 text-success-400" */
  iconClass: string
  /** destaca o valor (ex: alerta) — classes no valor */
  valueClass?: string
  /** período do valor, ex: "Agosto/2026" — evita KPI sem contexto de qual mês é */
  period?: string
}

/** Régua contínua de KPIs — células divididas por 1px, pastilha + label + valor mono. */
export function KpiStrip({ items, className }: { items: KpiItem[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border md:grid-cols-4", className)}>
      {items.map((kpi) => (
        <div key={kpi.label} className="flex items-center gap-2.5 bg-card px-3 py-2.5">
          <span className={cn("flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg text-sm", kpi.iconClass)}>
            {kpi.icon}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[11px] leading-tight text-muted-foreground">
              {kpi.label}
              {kpi.period && <span className="text-muted-foreground/50"> · {kpi.period}</span>}
            </span>
            <span className={cn("block font-mono text-[17px] font-semibold leading-tight tabular-nums", kpi.valueClass)}>
              {kpi.value}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}
