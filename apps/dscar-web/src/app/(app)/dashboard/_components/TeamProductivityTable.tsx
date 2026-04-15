import type { TeamMember } from "@paddock/types"

interface Props {
  members: TeamMember[]
}

export function TeamProductivityTable({ members }: Props) {
  if (members.length === 0) {
    return (
      <div className="bg-white rounded-md border border-neutral-200 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Produtividade da Equipe</h3>
        <p className="text-sm text-neutral-400 py-4 text-center">Nenhum dado de produtividade este mês.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-md border border-neutral-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100">
        <h3 className="text-sm font-semibold text-neutral-700">Produtividade da Equipe (mês)</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-neutral-50">
          <tr className="text-[11px] font-semibold uppercase text-neutral-400">
            <th className="px-4 py-2.5 text-left">Colaborador</th>
            <th className="px-4 py-2.5 text-right">OS Abertas</th>
            <th className="px-4 py-2.5 text-right">Entregues (mês)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {members.map((m) => (
            <tr key={m.name} className="hover:bg-neutral-50">
              <td className="px-4 py-2.5 font-medium text-neutral-800">{m.name}</td>
              <td className="px-4 py-2.5 text-right text-neutral-600">{m.open_count}</td>
              <td className="px-4 py-2.5 text-right">
                <span className="font-semibold text-emerald-700">{m.delivered_month}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
