"use client"

import { useState } from "react"
import { CheckCheck, Trash2, AlertCircle, Search, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useAmostrasPendentes, useAceitarMatch, useDescartarAmostra } from "@/hooks/useBenchmark"
import { useServicosCanonico, usePecasCanonicas } from "@/hooks/usePricingCatalog"
import type { BenchmarkAmostra } from "@paddock/types"

export default function BenchmarkRevisaoPage() {
  const { data: pendentes = [], isLoading } = useAmostrasPendentes()
  const [selected, setSelected] = useState<BenchmarkAmostra | null>(null)
  const [canonicalId, setCanonicalId] = useState("")
  const [canonicalNome, setCanonicalNome] = useState("")
  const [canonicalSearch, setCanonicalSearch] = useState("")
  const [motivoDescarte, setMotivoDescarte] = useState("")
  const [showDescarte, setShowDescarte] = useState(false)

  const { data: servicos = [] } = useServicosCanonico(
    selected?.tipo_item !== "peca" && canonicalSearch.length >= 2 ? canonicalSearch : undefined
  )
  const { data: pecas = [] } = usePecasCanonicas(
    selected?.tipo_item === "peca" && canonicalSearch.length >= 2 ? canonicalSearch : undefined
  )
  const resultadosBusca = selected?.tipo_item === "peca" ? pecas : servicos

  const { mutateAsync: aceitar, isPending: aceitando } = useAceitarMatch(selected?.id ?? "")
  const { mutateAsync: descartar, isPending: descartando } = useDescartarAmostra(selected?.id ?? "")

  async function handleAceitar() {
    if (!canonicalId.trim()) {
      toast.error("Selecione o serviço ou peça canônica.")
      return
    }
    try {
      await aceitar(canonicalId)
      toast.success("Match aceito e alias criado!")
      setSelected(null)
      setCanonicalId("")
      setCanonicalNome("")
      setCanonicalSearch("")
    } catch {
      toast.error("Erro ao aceitar match.")
    }
  }

  async function handleDescartar() {
    if (!motivoDescarte.trim()) {
      toast.error("Informe o motivo do descarte.")
      return
    }
    try {
      await descartar(motivoDescarte)
      toast.success("Amostra descartada.")
      setSelected(null)
      setShowDescarte(false)
      setMotivoDescarte("")
    } catch {
      toast.error("Erro ao descartar amostra.")
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-yellow-500" />
        <div>
          <h1 className="text-lg font-semibold text-white">Revisão de Aliases</h1>
          <p className="text-xs text-white/40 mt-0.5">
            Amostras com confiança &lt; 85% aguardando classificação manual.
          </p>
        </div>
        {pendentes.length > 0 && (
          <Badge
            variant="outline"
            className="ml-auto border-yellow-500/30 text-yellow-400 bg-yellow-400/10"
          >
            {pendentes.length} pendentes
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Lista */}
        <div className="rounded-lg border border-white/10 overflow-hidden">
          {isLoading ? (
            <div className="p-6 text-white/40 text-xs text-center">Carregando...</div>
          ) : pendentes.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-sm">
              Nenhuma amostra pendente de revisão.
            </div>
          ) : (
            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
              {pendentes.map((a) => (
                <button
                  key={a.id}
                  className={`w-full text-left px-4 py-3 hover:bg-white/5 transition-colors ${selected?.id === a.id ? "bg-white/10" : ""}`}
                  onClick={() => {
                    setSelected(a)
                    setShowDescarte(false)
                    setMotivoDescarte("")
                    setCanonicalId("")
                    setCanonicalNome("")
                    setCanonicalSearch("")
                  }}
                >
                  <div className="text-sm text-white truncate">{a.descricao_bruta}</div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-white/40">
                    <span>R$ {parseFloat(a.valor_praticado).toFixed(2)}</span>
                    {a.alias_match_confianca && (
                      <span className="text-yellow-400">
                        {(parseFloat(a.alias_match_confianca) * 100).toFixed(0)}%
                      </span>
                    )}
                    <span>{a.tipo_item}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Painel de detalhe */}
        {selected ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
            <div>
              <p className="text-xs text-white/40">Descrição bruta</p>
              <p className="text-sm text-white mt-1">{selected.descricao_bruta}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-white/40">Valor</p>
                <p className="text-white">R$ {parseFloat(selected.valor_praticado).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-white/40">Confiança atual</p>
                <p className="text-yellow-400">
                  {selected.alias_match_confianca
                    ? `${(parseFloat(selected.alias_match_confianca) * 100).toFixed(0)}%`
                    : "Sem match"}
                </p>
              </div>
              {selected.veiculo_marca && (
                <div>
                  <p className="text-white/40">Veículo</p>
                  <p className="text-white">
                    {selected.veiculo_marca} {selected.veiculo_modelo} {selected.veiculo_ano}
                  </p>
                </div>
              )}
              {selected.servico_nome && (
                <div>
                  <p className="text-white/40">Sugestão atual</p>
                  <p className="text-white">{selected.servico_nome}</p>
                </div>
              )}
            </div>

            {!showDescarte ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-xs">
                    {selected?.tipo_item === "peca" ? "Peça canônica" : "Serviço canônico"} *
                  </Label>
                  {canonicalNome ? (
                    <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-md px-3 py-2">
                      <span className="text-sm text-white">{canonicalNome}</span>
                      <button
                        type="button"
                        onClick={() => { setCanonicalId(""); setCanonicalNome(""); setCanonicalSearch("") }}
                        className="text-white/30 hover:text-white/70"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                        <Input
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/20 pl-8"
                          placeholder={selected?.tipo_item === "peca" ? "Buscar peça..." : "Buscar serviço..."}
                          value={canonicalSearch}
                          onChange={(e) => setCanonicalSearch(e.target.value)}
                        />
                      </div>
                      {resultadosBusca.length > 0 && (
                        <div className="rounded-md border border-white/10 overflow-hidden max-h-40 overflow-y-auto">
                          {resultadosBusca.slice(0, 6).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setCanonicalId(item.id)
                                setCanonicalNome(item.nome)
                                setCanonicalSearch("")
                              }}
                              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                            >
                              <span className="text-sm text-white">{item.nome}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAceitar}
                    disabled={aceitando}
                    className="flex-1 bg-success-600 hover:bg-success-700 text-white"
                    size="sm"
                  >
                    <CheckCheck className="h-3.5 w-3.5 mr-1" />
                    {aceitando ? "Aceitando..." : "Aceitar Match"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDescarte(true)}
                    className="border-error-500/40 text-error-400 hover:bg-error-500/10 hover:text-error-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-xs">Motivo do descarte</Label>
                  <Input
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                    value={motivoDescarte}
                    onChange={(e) => setMotivoDescarte(e.target.value)}
                    placeholder="Ex: linha sem informação útil"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDescarte(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDescartar}
                    disabled={descartando}
                  >
                    {descartando ? "Descartando..." : "Confirmar Descarte"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
            Selecione uma amostra para revisar.
          </div>
        )}
      </div>
    </div>
  )
}
