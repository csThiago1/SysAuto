"use client"

import { Package, Layers, FileText, Printer } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"

const SUB_MODULOS = [
  {
    href: "/estoque/unidades",
    icon: Package,
    title: "Unidades Físicas",
    description: "Peças rastreadas individualmente por código de barras.",
  },
  {
    href: "/estoque/lotes",
    icon: Layers,
    title: "Lotes de Insumo",
    description: "Insumos consumíveis (tinta, lixa, etc.) com controle de saldo FIFO.",
  },
  {
    href: "/estoque/nfe-recebida",
    icon: FileText,
    title: "NF-e de Entrada",
    description: "Notas fiscais recebidas, reconciliação e geração de estoque.",
  },
  {
    href: "/configuracao-motor/impressoras",
    icon: Printer,
    title: "Impressoras de Etiqueta",
    description: "Configuração de impressoras ZPL para etiquetas de estoque.",
  },
]

export default function EstoquePage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Package className="h-5 w-5 text-primary-500" />
        <div>
          <h1 className="text-lg font-semibold text-white">Estoque Físico</h1>
          <p className="text-xs text-white/40 mt-0.5">
            Controle de unidades físicas, lotes de insumo e NF-e de entrada.
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
