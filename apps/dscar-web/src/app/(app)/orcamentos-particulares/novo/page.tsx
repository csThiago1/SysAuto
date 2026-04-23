"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ReceiptText, ChevronLeft, Search, X } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCreateBudget } from "@/hooks/useBudgets"
import { useCustomers } from "@/hooks/useCustomers"

export default function NovoBudgetPage() {
  const router = useRouter()
  const { mutateAsync: criar, isPending } = useCreateBudget()

  // Cliente
  const [clienteSearch, setClienteSearch]   = useState("")
  const [clienteSelecionado, setClienteSel] = useState<{ id: string; name: string } | null>(null)
  const { data: clientesData }              = useCustomers(clienteSearch)
  const clientes                            = clientesData?.results ?? []

  // Veículo
  const [placa, setPlaca]         = useState("")
  const [descricao, setDescricao] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clienteSelecionado) {
      toast.error("Selecione um cliente.")
      return
    }
    if (!placa.trim()) {
      toast.error("Informe a placa do veículo.")
      return
    }
    if (!descricao.trim()) {
      toast.error("Informe a descrição do veículo.")
      return
    }
    try {
      const budget = await criar({
        customer_id:         Number(clienteSelecionado.id),
        vehicle_plate:       placa.toUpperCase().trim(),
        vehicle_description: descricao.trim(),
      })
      toast.success(`Orçamento ${budget.number} criado!`)
      router.push(`/orcamentos-particulares/${budget.id}` as Route)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar orçamento.")
    }
  }

  return (
    <div className="p-6 max-w-xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={"/orcamentos-particulares" as Route}>
          <Button variant="ghost" size="icon" className="text-white/50 hover:text-white">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <ReceiptText className="h-5 w-5 text-primary-500" />
        <h1 className="text-lg font-semibold text-white">Novo Orçamento Particular</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Cliente */}
        <div className="space-y-2">
          <Label className="text-white/70">Cliente</Label>
          {clienteSelecionado ? (
            <div className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-2">
              <span className="text-white text-sm">{clienteSelecionado.name}</span>
              <button
                type="button"
                onClick={() => { setClienteSel(null); setClienteSearch("") }}
                className="text-white/30 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  placeholder="Buscar por nome (mínimo 2 caracteres)..."
                  value={clienteSearch}
                  onChange={(e) => setClienteSearch(e.target.value)}
                  className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
              {clientes.length > 0 && (
                <ul className="rounded-lg border border-white/10 bg-[#1c1c1e] divide-y divide-white/5 max-h-48 overflow-y-auto">
                  {clientes.slice(0, 8).map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                        onClick={() => {
                          setClienteSel({ id: c.id, name: c.name })
                          setClienteSearch("")
                        }}
                      >
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Placa */}
        <div className="space-y-2">
          <Label className="text-white/70">Placa do veículo</Label>
          <Input
            placeholder="ABC1D23"
            value={placa}
            onChange={(e) => setPlaca(e.target.value.toUpperCase())}
            maxLength={8}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono uppercase"
          />
        </div>

        {/* Descrição */}
        <div className="space-y-2">
          <Label className="text-white/70">Descrição do veículo</Label>
          <Input
            placeholder="Ex: Toyota Corolla 2020 XEI"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Criando..." : "Criar Orçamento"}
        </Button>
      </form>
    </div>
  )
}
