import type { TeamMember } from "@paddock/types"
import { ScrollFade } from "@/components/ui/scroll-fade"

interface Props {
  members: TeamMember[]
}

export function TeamProductivityTable({ members }: Props) {
  if (members.length === 0) {
    return (
      // Vazio compacto e alinhado a esquerda: centralizado num card alto o
      // texto caia bem embaixo do FAB flutuante e ficava cortado.
      <div className="bg-card rounded-xl border border-border px-4 py-3">
        <h3 className="mb-1 text-sm font-semibold text-foreground/70">Produtividade da Equipe</h3>
        <p className="text-sm text-muted-foreground">
          Nenhum apontamento registrado este mês.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground/70">Produtividade da Equipe (mês)</h3>
      </div>
      {/* Mobile card view */}
      <div className="md:hidden divide-y divide-white/5">
        {members.map((m) => (
          <div key={m.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="font-medium text-foreground/90 truncate">{m.name}</span>
            <span className="shrink-0 font-mono text-[12px] tabular-nums text-foreground/60">
              {m.open_count} abertas · <span className="font-semibold text-success-400">{m.delivered_month} entregues</span>
            </span>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <ScrollFade>
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-4 py-2.5 text-left">Colaborador</th>
                <th className="px-4 py-2.5 text-right">OS Abertas</th>
                <th className="px-4 py-2.5 text-right">Entregues (mês)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {members.map((m) => (
                <tr key={m.name} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium text-foreground/90">{m.name}</td>
                  <td className="px-4 py-2.5 text-right text-foreground/60">{m.open_count}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="font-semibold text-success-400">{m.delivered_month}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollFade>
      </div>
    </div>
  )
}
