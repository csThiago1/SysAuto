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
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"

/* ------------------------------------------------------------------ */
/*  Dashboard stats                                                    */
/* ------------------------------------------------------------------ */

interface DashboardStats {
  pecas_disponiveis: number
  valor_em_estoque: string
  reservadas_os: number
  aprovacoes_pendentes: number
}

function formatCompactCurrency(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return "—"
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  })
}

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
  const { data: stats } = useQuery({
    queryKey: ["inventory", "dashboard-stats"],
    queryFn: () =>
      apiFetch<DashboardStats>("/api/proxy/inventory/dashboard-stats/"),
  })

  const reservadas = stats?.reservadas_os ?? 0
  const pendentes = stats?.aprovacoes_pendentes ?? 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-5 w-5 text-primary-500" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Estoque Físico</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Controle de armazéns, peças, insumos e movimentações.
          </p>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Peças Disponíveis */}
        <div className="bg-muted/50 border border-border rounded-lg p-5">
          <div className="label-mono mb-2">PEÇAS DISPONÍVEIS</div>
          <div className="text-3xl font-bold text-foreground font-mono">
            {stats?.pecas_disponiveis ?? "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">em estoque</div>
        </div>

        {/* Valor em Estoque */}
        <div className="bg-muted/50 border border-border rounded-lg p-5">
          <div className="label-mono mb-2">VALOR EM ESTOQUE</div>
          <div className="text-3xl font-bold text-foreground font-mono">
            {stats ? formatCompactCurrency(stats.valor_em_estoque) : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">custo NF</div>
        </div>

        {/* Reservadas p/ OS */}
        <div className="bg-muted/50 border border-border rounded-lg p-5">
          <div className="label-mono mb-2">RESERVADAS P/ OS</div>
          <div
            className={`text-3xl font-bold font-mono ${
              reservadas > 0 ? "text-yellow-400" : "text-foreground"
            }`}
          >
            {stats ? reservadas : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">aguardando consumo</div>
        </div>

        {/* Aprovações Pendentes */}
        <div className="bg-muted/50 border border-border rounded-lg p-5">
          <div className="label-mono mb-2">APROVAÇÕES PENDENTES</div>
          <div
            className={`text-3xl font-bold font-mono ${
              pendentes > 0 ? "text-error-400" : "text-foreground"
            }`}
          >
            {stats ? pendentes : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">perdas aguardando</div>
        </div>
      </div>

      {/* Section divider */}
      <div className="section-divider">SUBMÓDULOS</div>

      {/* 9 Navigation cards — 3 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SUB_MODULOS.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href as Route}
            className="group rounded-lg border border-border bg-muted/50 p-5 hover:bg-muted hover:border-border transition-all space-y-2"
          >
            <mod.icon className="h-5 w-5 text-primary-500 group-hover:text-primary-400 transition-colors" />
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
