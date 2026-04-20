"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, ChevronLeft, Search, X } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCreateOrcamento } from "@/hooks/useQuotes"
import { useEmpresas } from "@/hooks/usePricingProfile"
import { useCustomers } from "@/hooks/useCustomers"
import { useInsurers } from "@/hooks/useInsurers"
import type { TipoResponsabilidade } from "@paddock/types"

export default function NovoOrcamentoPage() {
  const router = useRouter()
  const { mutateAsync: criar, isPending } = useCreateOrcamento()

  // Listas para os selects
  const { data: empresasData } = useEmpresas()
  const empresas = empresasData ?? []

  // Busca de cliente
  const [clienteSearch, setClienteSearch] = useState("")
  const [clienteSelecionado, setClienteSelecionado] = useState<{ id: string; name: string; document_masked: string } | null>(null)
  const { data: clientesData } = useCustomers(clienteSearch)
  const clientes = clientesData?.results ?? []

  // Busca de seguradora
  const [segSearch, setSegSearch] = useState("")
  const [seguradoraSelecionada, setSeguradoraSelecionada] = useState<{ id: string; display_name: string } | null>(null)
  const { data: segData } = useInsurers(segSearch)
  const seguradoras = segData?.results ?? []

  const [form, setForm] = useState({
    empresa_id:            "",
    tipo_responsabilidade: "cliente" as TipoResponsabilidade,
    sinistro_numero:       "",
    observacoes:           "",
    veiculo_marca:         "",
    veiculo_modelo:        "",
    veiculo_ano:           new Date().getFullYear().toString(),
    veiculo_versao:        "",
    veiculo_placa:         "",
  })

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.empresa_id) {
      toast.error("Selecione a empresa.")
      return
    }
    if (!clienteSelecionado) {
      toast.error("Busque e selecione o cliente.")
      return
    }
    if (!form.veiculo_marca || !form.veiculo_modelo) {
      toast.error("Preencha marca e modelo do veículo.")
      return
    }
    try {
      const orc = await criar({
        empresa_id:            form.empresa_id,
        customer_id:           clienteSelecionado.id,
        insurer_id:            seguradoraSelecionada?.id ?? null,
        tipo_responsabilidade: form.tipo_responsabilidade,
        sinistro_numero:       form.sinistro_numero,
        observacoes:           form.observacoes,
        veiculo: {
          marca:  form.veiculo_marca,
          modelo: form.veiculo_modelo,
          ano:    parseInt(form.veiculo_ano),
          versao: form.veiculo_versao || undefined,
          placa:  form.veiculo_placa || undefined,
        },
      })
      toast.success(`Orçamento ${orc.numero} criado!`)
      router.push(`/orcamentos/${orc.id}` as Route)
    } catch {
      toast.error("Erro ao criar orçamento. Tente novamente.")
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={"/orcamentos" as Route} className="text-white/40 hover:text-white/70 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <FileText className="h-5 w-5 text-primary-500" />
        <div>
          <h1 className="text-lg font-semibold text-white">Novo Orçamento</h1>
          <p className="text-xs text-white/40">Preencha as informações para criar o orçamento.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Empresa */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Empresa</p>
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Empresa *</Label>
            <Select value={form.empresa_id} onValueChange={(v) => set("empresa_id", v)}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome_fantasia || emp.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Cliente */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Cliente *</p>
          {clienteSelecionado ? (
            <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-md px-3 py-2">
              <div>
                <p className="text-sm text-white font-medium">{clienteSelecionado.name}</p>
                <p className="text-xs text-white/40">{clienteSelecionado.document_masked}</p>
              </div>
              <button
                type="button"
                onClick={() => { setClienteSelecionado(null); setClienteSearch("") }}
                className="text-white/30 hover:text-white/70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                <Input
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 pl-8"
                  placeholder="Buscar por nome ou CPF..."
                  value={clienteSearch}
                  onChange={(e) => setClienteSearch(e.target.value)}
                />
              </div>
              {clientes.length > 0 && (
                <div className="rounded-md border border-white/10 overflow-hidden">
                  {clientes.slice(0, 5).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setClienteSelecionado(c); setClienteSearch("") }}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                    >
                      <span className="text-sm text-white">{c.name}</span>
                      <span className="text-xs text-white/40">{c.document_masked}</span>
                    </button>
                  ))}
                </div>
              )}
              {clienteSearch.length >= 2 && clientes.length === 0 && (
                <p className="text-xs text-white/40 text-center py-2">Nenhum cliente encontrado.</p>
              )}
            </div>
          )}
        </div>

        {/* Responsabilidade e seguradora */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Responsabilidade</p>
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Quem paga o serviço?</Label>
            <Select
              value={form.tipo_responsabilidade}
              onValueChange={(v) => set("tipo_responsabilidade", v)}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cliente">Particular — cliente paga direto</SelectItem>
                <SelectItem value="seguradora">Seguro — seguradora cobre</SelectItem>
                <SelectItem value="rcf">RCF — terceiros (responsabilidade civil)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(form.tipo_responsabilidade === "seguradora" || form.tipo_responsabilidade === "rcf") && (
            <>
              {/* Busca seguradora */}
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Seguradora</Label>
                {seguradoraSelecionada ? (
                  <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-md px-3 py-2">
                    <p className="text-sm text-white">{seguradoraSelecionada.display_name}</p>
                    <button
                      type="button"
                      onClick={() => { setSeguradoraSelecionada(null); setSegSearch("") }}
                      className="text-white/30 hover:text-white/70"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                      <Input
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/20 pl-8"
                        placeholder="Buscar seguradora..."
                        value={segSearch}
                        onChange={(e) => setSegSearch(e.target.value)}
                      />
                    </div>
                    {seguradoras.length > 0 && (
                      <div className="rounded-md border border-white/10 overflow-hidden">
                        {seguradoras.slice(0, 5).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => { setSeguradoraSelecionada({ id: s.id, display_name: s.display_name }); setSegSearch("") }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                          >
                            <span className="text-sm text-white">{s.display_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Número do sinistro</Label>
                <Input
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                  placeholder="Ex: 2024/0001234"
                  value={form.sinistro_numero}
                  onChange={(e) => set("sinistro_numero", e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {/* Veículo */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Veículo</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Placa</Label>
              <Input
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 uppercase"
                placeholder="ABC-1234"
                value={form.veiculo_placa}
                onChange={(e) => set("veiculo_placa", e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Ano *</Label>
              <Input
                className="bg-white/5 border-white/10 text-white"
                type="number"
                min="1980"
                max={new Date().getFullYear() + 1}
                value={form.veiculo_ano}
                onChange={(e) => set("veiculo_ano", e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Marca *</Label>
              <Input
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                placeholder="Ex: Toyota"
                value={form.veiculo_marca}
                onChange={(e) => set("veiculo_marca", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Modelo *</Label>
              <Input
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                placeholder="Ex: Corolla"
                value={form.veiculo_modelo}
                onChange={(e) => set("veiculo_modelo", e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Versão</Label>
            <Input
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
              placeholder="Ex: 2.0 XEI CVT"
              value={form.veiculo_versao}
              onChange={(e) => set("veiculo_versao", e.target.value)}
            />
          </div>
        </div>

        {/* Observações */}
        <div className="space-y-1.5">
          <Label className="text-white/70 text-xs">Observações</Label>
          <textarea
            className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder:text-white/20 resize-none"
            rows={3}
            placeholder="Observações gerais sobre o orçamento..."
            value={form.observacoes}
            onChange={(e) => set("observacoes", e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href={"/orcamentos" as Route}
            className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            Cancelar
          </Link>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Criando..." : "Criar Orçamento"}
          </Button>
        </div>
      </form>
    </div>
  )
}
