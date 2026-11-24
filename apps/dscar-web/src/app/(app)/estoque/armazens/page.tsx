"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { toast } from "sonner"
import type { ArmazemTipo } from "@paddock/types"
import {
  useArmazens,
  useArmazemCreate,
} from "@/hooks/useInventoryLocation"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Button } from "@/components/ui/button"

const TIPO_BADGE: Record<
  ArmazemTipo,
  { label: string; className: string }
> = {
  galpao: {
    label: "GALPÃO",
    className: "bg-info-500/10 text-info-400 border border-info-500/20",
  },
  patio: {
    label: "PÁTIO",
    className: "bg-warning-500/10 text-warning-400 border border-warning-500/20",
  },
}

export default function ArmazensPage() {
  const { data: armazens = [], isLoading } = useArmazens()
  const createMut = useArmazemCreate()

  const [showForm, setShowForm] = useState(false)
  const [nome, setNome] = useState("")
  const [codigo, setCodigo] = useState("")
  const [tipo, setTipo] = useState<ArmazemTipo>("galpao")

  async function handleCreate() {
    if (!nome.trim() || !codigo.trim()) {
      toast.error("Preencha nome e código.")
      return
    }
    try {
      await createMut.mutateAsync({ nome: nome.trim(), codigo: codigo.trim(), tipo })
      toast.success("Armazém criado.")
      setNome("")
      setCodigo("")
      setTipo("galpao")
      setShowForm(false)
    } catch {
      toast.error("Erro ao criar armazém.")
    }
  }

  return (
    <div className="px-0 py-3 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="page-title">Armazéns</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {armazens.length} armazé{armazens.length !== 1 ? "ns" : "m"}
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="h-4 w-4" />
          Novo Armazém
        </Button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label-mono text-muted-foreground mb-1.5 block">NOME</label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Galpão Principal"
                className="w-full"
              />
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-1.5 block">CÓDIGO</label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="G1"
                className="w-full"
              />
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-1.5 block">TIPO</label>
              <NativeSelect
                value={tipo}
                onChange={(e) => setTipo(e.target.value as ArmazemTipo)}
              >
                <option value="galpao">Galpão</option>
                <option value="patio">Pátio</option>
              </NativeSelect>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/60 hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? "Criando..." : "Criar"}
            </Button>
          </div>
        </div>
      )}

      {/* Cards grid */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : armazens.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/50 p-8 text-center text-muted-foreground text-sm">
          Nenhum armazém cadastrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {armazens.map((a) => {
            const badge = TIPO_BADGE[a.tipo] ?? TIPO_BADGE.galpao
            return (
              <Link
                key={a.id}
                href={`/estoque/armazens/${a.id}` as Route}
                className="group rounded-lg border border-border bg-muted/50 p-5 hover:bg-muted hover:border-border transition-colors space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="label-mono">{a.codigo}</span>
                    <h2 className="text-sm font-semibold text-foreground mt-1">
                      {a.nome}
                    </h2>
                  </div>
                  <span
                    className={`text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {a.total_ruas} rua{a.total_ruas !== 1 ? "s" : ""}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
