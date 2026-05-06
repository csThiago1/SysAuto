import type { TeamMember } from "@paddock/types"

interface Props {
  members: TeamMember[]
}

export function TeamProductivityTable({ members }: Props) {
  if (members.length === 0) {
    return (
      <div className="bg-muted/50 rounded-md border border-border shadow-sm p-4">
        <h3 className="text-sm font-semibold text-foreground/70 mb-3">Produtividade da Equipe</h3>
        <p className="text-sm text-muted-foreground py-4 text-center">Nenhum dado de produtividade este mês.</p>
      </div>
    )
  }

  return (
    <div className="bg-muted/50 rounded-md border border-border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground/70">Produtividade da Equipe (mês)</h3>
      </div>
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
    </div>
  )
}
