"use client"

import { SlidersHorizontal, Clock, Percent, Layers, FlaskConical } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"

const SUB_MODULOS = [
  {
    href: "/configuracao-motor/custos",
    icon: Clock,
    title: "Custos",
    description: "Parâmetros de custo/hora, rateio de despesas e fallback por categoria.",
  },
  {
    href: "/configuracao-motor/margens",
    icon: Percent,
    title: "Margens",
    description: "Margens por segmento e markups específicos por peça ou faixa de custo.",
  },
  {
    href: "/configuracao-motor/snapshots",
    icon: Layers,
    title: "Snapshots",
    description: "Histórico imutável de cálculos de preço para auditoria.",
  },
  {
    href: "/configuracao-motor/simulador",
    icon: FlaskConical,
    title: "Simulador",
    description: "Calcule preços de serviços e peças com contexto veicular completo.",
  },
]

export default function ConfiguracaoMotorPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <SlidersHorizontal className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Configuração do Motor</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Parâmetros de precificação do Motor de Orçamentos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SUB_MODULOS.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href as Route}
            className="group rounded-lg border border-border bg-muted/50 p-5 hover:bg-muted hover:border-border transition-all space-y-2"
          >
            <mod.icon className="h-5 w-5 text-primary group-hover:text-primary/80 transition-colors" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">{mod.title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
