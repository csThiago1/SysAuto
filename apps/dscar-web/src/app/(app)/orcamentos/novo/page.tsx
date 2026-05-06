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
import { useCreateOrcamento } from "@/hooks/useQuotes"
import { useCustomers } from "@/hooks/useCustomers"
import { useMinhaEmpresaId } from "@/hooks/usePricingProfile"
import { VehiclePlateSearch, type VehicleData } from "@/components/vehicle/VehiclePlateSearch"

export default function NovoOrcamentoPage() {
  const router = useRouter()
  const empresaId = useMinhaEmpresaId()
  const { mutateAsync: criar, isPending } = useCreateOrcamento()

  // Busca de cliente
  const [clienteSearch, setClienteSearch] = useState("")
  const [clienteSelecionado, setClienteSelecionado] = useState<{ id: string; name: string; document_masked: string } | null>(null)
  const { data: clientesData } = useCustomers(clienteSearch)
  const clientes = clientesData?.results ?? []

  // Veículo via VehiclePlateSearch
  const [vehicle, setVehicle] = useState<VehicleData | null>(null)
  const [observacoes, setObservacoes] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!empresaId) {
      toast.error("Aguarde o carregamento da empresa.")
      return
    }
    if (!clienteSelecionado) {
      toast.error("Busque e selecione o cliente.")
      return
    }
    if (!vehicle || !vehicle.make || !vehicle.model) {
      toast.error("Preencha marca e modelo do veículo.")
      return
    }
    try {
      const orc = await criar({
        empresa_id:            empresaId,
        customer_id:           clienteSelecionado.id,
        insurer_id:            null,
        tipo_responsabilidade: "cliente",
        sinistro_numero:       "",
        observacoes,
        veiculo: {
          marca:  vehicle.make,
          modelo: vehicle.model,
          ano:    vehicle.year ?? new Date().getFullYear(),
          versao: vehicle.vehicle_version || undefined,
          placa:  vehicle.plate || undefined,
        },
      })
      toast.success(`Orçamento ${orc.numero} criado!`)
      router.push(`/orcamentos/${orc.id}` as Route)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar orçamento.")
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={"/orcamentos" as Route} className="text-muted-foreground hover:text-foreground/70 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <FileText className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Novo Orçamento</h1>
          <p className="text-xs text-muted-foreground">Preencha as informações para criar o orçamento.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Cliente */}
        <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente *</p>
          {clienteSelecionado ? (
            <div className="flex items-center justify-between bg-muted/50 border border-border rounded-md px-3 py-2">
              <div>
                <p className="text-sm text-foreground font-medium">{clienteSelecionado.name}</p>
                <p className="text-xs text-muted-foreground">{clienteSelecionado.document_masked}</p>
              </div>
              <button
                type="button"
                onClick={() => { setClienteSelecionado(null); setClienteSearch("") }}
                className="text-muted-foreground hover:text-foreground/70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 pl-8"
                  placeholder="Buscar por nome ou CPF..."
                  value={clienteSearch}
                  onChange={(e) => setClienteSearch(e.target.value)}
                />
              </div>
              {clientes.length > 0 && (
                <div className="rounded-md border border-border overflow-hidden">
                  {clientes.slice(0, 5).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setClienteSelecionado(c); setClienteSearch("") }}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/50 border-b border-white/5 last:border-0 transition-colors"
                    >
                      <span className="text-sm text-foreground">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.document_masked}</span>
                    </button>
                  ))}
                </div>
              )}
              {clienteSearch.length >= 2 && clientes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">Nenhum cliente encontrado.</p>
              )}
            </div>
          )}
        </div>

        {/* Veículo */}
        <VehiclePlateSearch value={vehicle} onChange={setVehicle} />

        {/* Observações */}
        <div className="space-y-1.5">
          <Label className="text-foreground/70 text-xs">Observações</Label>
          <textarea
            className="w-full text-sm bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 resize-none"
            rows={3}
            placeholder="Observações gerais sobre o orçamento..."
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href={"/orcamentos" as Route}
            className="px-4 py-2 text-sm text-foreground/60 hover:text-foreground transition-colors"
          >
            Cancelar
          </Link>
          <Button type="submit" disabled={isPending || !empresaId}>
            {isPending ? "Criando..." : "Criar Orçamento"}
          </Button>
        </div>
      </form>
    </div>
  )
}
