"use client"

import { useState } from "react"
import { FlaskConical, ArrowRight } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { PermissionGate } from "@/components/PermissionGate"
import { useServicosCanonico } from "@/hooks/usePricingCatalog"
import { useTiposPintura, useTamanhos } from "@/hooks/usePricingProfile"
import { useFichaResolver } from "@/hooks/useFichaTecnica"
import type { CategoriaTamanho, FichaResolvida } from "@paddock/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function multiplyDecimal(value: string, multiplier: string): string {
  const v = parseFloat(value)
  const m = parseFloat(multiplier)
  if (isNaN(v) || isNaN(m)) return value
  return (v * m).toFixed(4).replace(/\.?0+$/, "")
}

function applyMultiplicadoresFrontend(
  ficha: FichaResolvida,
  tamanho: CategoriaTamanho,
  aplica: boolean
): FichaResolvida {
  if (!aplica) return ficha
  return {
    ...ficha,
    maos_obra: ficha.maos_obra.map((mo) => ({
      ...mo,
      horas: mo.afetada_por_tamanho
        ? multiplyDecimal(mo.horas, tamanho.multiplicador_horas)
        : mo.horas,
    })),
    insumos: ficha.insumos.map((ins) => ({
      ...ins,
      quantidade: ins.afetado_por_tamanho
        ? multiplyDecimal(ins.quantidade, tamanho.multiplicador_insumos)
        : ins.quantidade,
    })),
  }
}

// ─── SimuladorContent ─────────────────────────────────────────────────────────

function SimuladorContent() {
  const [servicoId, setServicoId] = useState("")
  const [tipoPinturaId, setTipoPinturaId] = useState("")
  const [tamanhoId, setTamanhoId] = useState("")

  const { data: servicos = [] } = useServicosCanonico()
  const { data: tiposPintura = [] } = useTiposPintura()
  const { data: tamanhos = [] } = useTamanhos()

  const servicoSelecionado = servicos.find((s) => s.id === servicoId)
  const tipoPinturaSelecionada = tiposPintura.find((t) => t.id === tipoPinturaId)
  const tamanhoSelecionado = tamanhos.find((t) => t.id === tamanhoId)

  const { data: fichaBase, isLoading: loadingFicha, error } = useFichaResolver(
    servicoId,
    tipoPinturaSelecionada?.codigo
  )

  const aplica = servicoSelecionado?.aplica_multiplicador_tamanho ?? false
  const fichaComMulti =
    fichaBase && tamanhoSelecionado
      ? applyMultiplicadoresFrontend(fichaBase, tamanhoSelecionado, aplica)
      : null

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Simulador de Fichas Técnicas</h1>
        <p className="mt-1 text-sm text-white/50">
          Visualize a ficha base e o resultado com multiplicadores de tamanho.
        </p>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-white/5 rounded-md border border-white/10">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Serviço</Label>
          <Select value={servicoId} onValueChange={setServicoId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um serviço" />
            </SelectTrigger>
            <SelectContent>
              {servicos.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Tipo de Pintura</Label>
          <Select value={tipoPinturaId} onValueChange={setTipoPinturaId}>
            <SelectTrigger>
              <SelectValue placeholder="Genérica (sem variação)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Genérica (sem variação)</SelectItem>
              {tiposPintura.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Tamanho do Veículo</Label>
          <Select value={tamanhoId} onValueChange={setTamanhoId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um tamanho" />
            </SelectTrigger>
            <SelectContent>
              {tamanhos.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome} ({t.multiplicador_horas}h / {t.multiplicador_insumos}i)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Multiplicador info */}
      {servicoSelecionado && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-white/60">Aplica multiplicador de tamanho:</span>
          {aplica ? (
            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
              Sim
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-white/40">
              Não — serviço com tempo/quantidade fixos
            </Badge>
          )}
        </div>
      )}

      {/* Loading / Error */}
      {servicoId && loadingFicha && (
        <p className="text-sm text-white/40">Buscando ficha técnica...</p>
      )}
      {servicoId && error && !loadingFicha && (
        <div className="p-4 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
          Ficha técnica não encontrada para este serviço/tipo de pintura.
        </div>
      )}

      {/* Comparativo lado a lado */}
      {fichaBase && (
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4">
          {/* Ficha Base */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-white/70">
              Ficha Base — v{fichaBase.versao}
            </h2>
            <FichaTable ficha={fichaBase} label="Base" />
          </div>

          {/* Separador */}
          <div className="flex items-center justify-center pt-8">
            <ArrowRight className="h-5 w-5 text-white/30" />
          </div>

          {/* Ficha com multiplicadores */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-white/70">
              Com Multiplicadores
              {tamanhoSelecionado && (
                <span className="ml-2 text-white/40 font-normal">
                  ({tamanhoSelecionado.nome})
                </span>
              )}
            </h2>
            {fichaComMulti && tamanhoSelecionado ? (
              <FichaTable ficha={fichaComMulti} label="Com mult." variant="adjusted" />
            ) : (
              <div className="flex items-center justify-center h-32 rounded-md border border-dashed border-white/10 text-sm text-white/40">
                {!aplica
                  ? "— serviço não aplica multiplicador"
                  : "Selecione um tamanho para ver o resultado"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── FichaTable ───────────────────────────────────────────────────────────────

function FichaTable({
  ficha,
  label,
  variant = "base",
}: {
  ficha: FichaResolvida
  label: string
  variant?: "base" | "adjusted"
}) {
  const isAdjusted = variant === "adjusted"

  return (
    <div className="flex flex-col gap-3">
      {/* Mão de Obra */}
      <div>
        <p className="text-xs font-medium text-white/50 mb-1 uppercase tracking-wide">
          Mão de Obra
        </p>
        {ficha.maos_obra.length === 0 ? (
          <p className="text-xs text-white/40">—</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-white/10 bg-white/5">
            <Table>
              <TableHeader className="bg-white/[0.03]">
                <TableRow>
                  <TableHead className="text-xs py-1.5">Categoria</TableHead>
                  <TableHead className="text-xs py-1.5 text-right w-20">Horas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ficha.maos_obra.map((mo, i) => (
                  <TableRow key={i}>
                    <TableCell className="py-1.5 text-xs">{mo.categoria_nome}</TableCell>
                    <TableCell
                      className={`py-1.5 text-xs text-right font-mono ${
                        isAdjusted && mo.afetada_por_tamanho
                          ? "text-amber-700 font-semibold"
                          : "text-white/70"
                      }`}
                    >
                      {mo.horas}h
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Insumos */}
      <div>
        <p className="text-xs font-medium text-white/50 mb-1 uppercase tracking-wide">
          Insumos
        </p>
        {ficha.insumos.length === 0 ? (
          <p className="text-xs text-white/40">—</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-white/10 bg-white/5">
            <Table>
              <TableHeader className="bg-white/[0.03]">
                <TableRow>
                  <TableHead className="text-xs py-1.5">Material</TableHead>
                  <TableHead className="text-xs py-1.5 text-right w-24">Qtde</TableHead>
                  <TableHead className="text-xs py-1.5 w-16">Unid.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ficha.insumos.map((ins, i) => (
                  <TableRow key={i}>
                    <TableCell className="py-1.5 text-xs">{ins.material_nome}</TableCell>
                    <TableCell
                      className={`py-1.5 text-xs text-right font-mono ${
                        isAdjusted && ins.afetado_por_tamanho
                          ? "text-amber-700 font-semibold"
                          : "text-white/70"
                      }`}
                    >
                      {ins.quantidade}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs text-white/50">
                      {ins.unidade_base}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page Export (com PermissionGate ADMIN) ───────────────────────────────────

export default function SimuladorPage() {
  return (
    <PermissionGate
      role="ADMIN"
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <FlaskConical className="h-10 w-10 text-white/30 mx-auto mb-3" />
            <p className="text-sm text-white/50">
              Acesso restrito a Administradores.
            </p>
          </div>
        </div>
      }
    >
      <SimuladorContent />
    </PermissionGate>
  )
}
