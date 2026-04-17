"use client"

import { SlidersHorizontal, Clock } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"

const SUB_MODULOS = [
  {
    href: "/configuracao-motor/custos",
    icon: Clock,
    title: "Custos",
    description: "Parâmetros de custo/hora, rateio de despesas e fallback por categoria.",
  },
]

export default function ConfiguracaoMotorPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <SlidersHorizontal className="h-5 w-5 text-primary-500" />
        <div>
          <h1 className="text-lg font-semibold text-white">Configuração do Motor</h1>
          <p className="text-xs text-white/40 mt-0.5">
            Parâmetros de precificação do Motor de Orçamentos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SUB_MODULOS.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href as Route}
            className="group rounded-lg border border-white/10 bg-white/5 p-5 hover:bg-white/10 hover:border-white/20 transition-all space-y-2"
          >
            <mod.icon className="h-5 w-5 text-primary-500 group-hover:text-primary-400 transition-colors" />
            <div>
              <h2 className="text-sm font-semibold text-white">{mod.title}</h2>
              <p className="text-xs text-white/50 mt-0.5">{mod.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
