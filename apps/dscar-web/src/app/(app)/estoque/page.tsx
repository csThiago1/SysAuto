"use client"

import {
  Package,
  Warehouse,
  FlaskConical,
  Barcode,
  Layers,
  PackagePlus,
  ArrowLeftRight,
  ClipboardList,
  FileText,
  LayoutDashboard,
} from "lucide-react"
import Link from "next/link"
import type { Route } from "next"

/* ------------------------------------------------------------------ */
/*  KPI placeholder — TODO: replace with real data from               */
/*  useInventory hooks or /api/v1/inventory/kpis/                     */
/* ------------------------------------------------------------------ */

const KPIS = [
  {
    label: "PEÇAS DISPONÍVEIS",
    value: "—",
    sub: "em 3 armazéns",
  },
  {
    label: "VALOR EM ESTOQUE",
    value: "—",
    sub: "custo NF",
  },
  {
    label: "RESERVADAS P/ OS",
    value: "—",
    sub: "aguardando consumo",
    // TODO: text-yellow-400 when value > 0
  },
  {
    label: "APROVAÇÕES PENDENTES",
    value: "—",
    sub: "perdas aguardando",
    // TODO: text-error-400 when value > 0
  },
] as const

/* ------------------------------------------------------------------ */
/*  Navigation cards                                                   */
/* ------------------------------------------------------------------ */

const SUB_MODULOS = [
  {
    href: "/estoque/armazens",
    icon: Warehouse,
    title: "Armazéns",
    description: "Galpões, pátio e hierarquia de posições",
  },
  {
    href: "/estoque/produtos/pecas",
    icon: Package,
    title: "Peças",
    description: "Cadastro comercial com SKU e margem",
  },
  {
    href: "/estoque/produtos/insumos",
    icon: FlaskConical,
    title: "Insumos",
    description: "Tintas, vernizes, materiais",
  },
  {
    href: "/estoque/unidades",
    icon: Barcode,
    title: "Unidades Físicas",
    description: "Peças rastreadas por código de barras",
  },
  {
    href: "/estoque/lotes",
    icon: Layers,
    title: "Lotes de Insumo",
    description: "Consumíveis com controle FIFO",
  },
  {
    href: "/estoque/entrada",
    icon: PackagePlus,
    title: "Entrada Manual",
    description: "Cadastrar peça ou lote sem NF-e",
  },
  {
    href: "/estoque/movimentacoes",
    icon: ArrowLeftRight,
    title: "Movimentações",
    description: "Log auditável completo",
  },
  {
    href: "/estoque/contagens",
    icon: ClipboardList,
    title: "Contagens",
    description: "Inventário cíclico e total",
  },
  {
    href: "/estoque/nfe-recebida",
    icon: FileText,
    title: "NF-e de Entrada",
    description: "Reconciliação e geração de estoque",
  },
]

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function EstoquePage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-5 w-5 text-primary-500" />
        <div>
          <h1 className="text-lg font-semibold text-white">Estoque Físico</h1>
          <p className="text-xs text-white/40 mt-0.5">
            Controle de armazéns, peças, insumos e movimentações.
          </p>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white/5 border border-white/10 rounded-lg p-5"
          >
            <div className="label-mono mb-2">{kpi.label}</div>
            <div className="text-3xl font-bold text-white font-mono">
              {kpi.value}
            </div>
            <div className="text-xs text-white/40 mt-1">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Section divider */}
      <div className="section-divider">SUBMÓDULOS</div>

      {/* 9 Navigation cards — 3 columns */}
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
