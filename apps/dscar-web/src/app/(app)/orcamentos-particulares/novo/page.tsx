"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ReceiptText, ChevronLeft, Search, X, AlertTriangle, CheckCircle } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useQuery } from "@tanstack/react-query"
import { useCreateBudget } from "@/hooks/useBudgets"

interface PersonResult {
  id: number
  full_name: string
}

interface PlateData {
  plate: string
  make: string
  model: string
  version: string
  engine: string
  year: number | null
  chassis: string
  color: string
  fuel_type: string
  situation: string
  situation_code: number
}

function usePersonSearch(search: string) {
  return useQuery({
    queryKey: ["persons", "search", search],
    queryFn: async () => {
      const res = await fetch(`/api/proxy/persons/?search=${encodeURIComponent(search)}`)
      if (!res.ok) throw new Error("Erro ao buscar pessoas")
      const data = await res.json() as { results?: PersonResult[] } | PersonResult[]
      if (!Array.isArray(data) && "results" in data) return data.results ?? []
      return data as PersonResult[]
    },
    enabled: search.length >= 2,
  })
}

function usePlateLookup(plate: string) {
  const normalized = plate.replace(/[^A-Z0-9]/gi, "").toUpperCase()
  return useQuery<PlateData>({
    queryKey: ["plate", normalized],
    queryFn: async () => {
      const res = await fetch(`/api/plate/${normalized}`)
      if (!res.ok) throw new Error("Placa não encontrada")
      return res.json() as Promise<PlateData>
    },
    enabled: normalized.length >= 7,
    retry: false,
    staleTime: 1000 * 60 * 60 * 24, // 24h
  })
}

export default function NovoBudgetPage() {
  const router = useRouter()
  const { mutateAsync: criar, isPending } = useCreateBudget()

  // Cliente
  const [clienteSearch, setClienteSearch]   = useState("")
  const [clienteSelecionado, setClienteSel] = useState<{ id: number; name: string } | null>(null)
  const { data: clientes = [] }             = usePersonSearch(clienteSearch)

  // Veículo
  const [placa,       setPlaca]       = useState("")
  const [marca,       setMarca]       = useState("")
  const [modelo,      setModelo]      = useState("")
  const [versao,      setVersao]      = useState("")
  const [motorizacao, setMotorizacao] = useState("")
  const [combustivel, setCombustivel] = useState("")
  const [cor,         setCor]         = useState("")
  const [ano,         setAno]         = useState("")
  const [chassi,      setChassi]      = useState("")

  const { data: plateData, isFetching: buscandoPlaca, isError: placaNaoEncontrada } =
    usePlateLookup(placa)

  useEffect(() => {
    if (!plateData) return
    if (plateData.make)      setMarca(plateData.make)
    if (plateData.model)     setModelo(plateData.model)
    if (plateData.version)   setVersao(plateData.version)
    if (plateData.engine)    setMotorizacao(plateData.engine)
    if (plateData.fuel_type) setCombustivel(plateData.fuel_type)
    if (plateData.color)     setCor(plateData.color)
    if (plateData.year)      setAno(String(plateData.year))
    // Chassi vem mascarado da API — não preencher automaticamente
    if (plateData.chassis && !plateData.chassis.includes("*")) {
      setChassi(plateData.chassis)
    }
    if (plateData.situation_code !== 0) {
      toast.error(`Veículo com restrição: ${plateData.situation}`, { duration: 8000 })
    } else {
      toast.success("Dados do veículo preenchidos pela placa!")
    }
  }, [plateData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clienteSelecionado) { toast.error("Selecione um cliente."); return }
    if (!placa.trim())        { toast.error("Informe a placa do veículo."); return }
    if (!marca.trim() || !modelo.trim()) {
      toast.error("Informe marca e modelo do veículo.")
      return
    }
    const descricao = [marca, modelo, versao, motorizacao, combustivel, ano]
      .map((s) => s.trim()).filter(Boolean).join(" ")
    const anoNum = ano ? parseInt(ano, 10) : null
    try {
      const budget = await criar({
        customer_id:         clienteSelecionado.id,
        vehicle_plate:       placa.toUpperCase().trim(),
        vehicle_description: descricao,
        vehicle_chassis:     chassi.trim(),
        vehicle_version:     versao.trim(),
        vehicle_engine:      motorizacao.trim(),
        vehicle_color:       cor.trim(),
        vehicle_year:        anoNum && !isNaN(anoNum) ? anoNum : null,
      })
      toast.success(`Orçamento ${budget.number} criado!`)
      router.push(`/orcamentos-particulares/${budget.id}` as Route)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar orçamento.")
    }
  }

  const hasRestriction = plateData && plateData.situation_code !== 0
  const isOk           = plateData && plateData.situation_code === 0 && placa.length >= 7

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
                          setClienteSel({ id: c.id, name: c.full_name })
                          setClienteSearch("")
                        }}
                      >
                        {c.full_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Veículo */}
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Veículo</p>

          {/* Placa + status */}
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Placa</Label>
            <div className="flex items-center gap-3">
              <Input
                placeholder="ABC1D23"
                value={placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                maxLength={8}
                className="w-32 bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono uppercase tracking-widest font-bold"
              />
              {buscandoPlaca && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-primary-600" />
              )}
              {isOk && !buscandoPlaca && (
                <span className="flex items-center gap-1 text-xs text-success-400">
                  <CheckCircle className="h-3.5 w-3.5" /> Sem restrição
                </span>
              )}
              {placaNaoEncontrada && placa.length >= 7 && !buscandoPlaca && (
                <span className="text-xs text-warning-400">Não encontrada — preencha manualmente</span>
              )}
            </div>
          </div>

          {/* Alerta de restrição */}
          {hasRestriction && (
            <div className="flex items-start gap-2 rounded-lg border border-error-500/30 bg-error-500/10 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-error-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-error-300">Veículo com restrição</p>
                <p className="text-xs text-error-400/80 mt-0.5">{plateData.situation}</p>
              </div>
            </div>
          )}

          {/* Montadora + Modelo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Montadora *</Label>
              <Input
                placeholder="Chevrolet"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Modelo *</Label>
              <Input
                placeholder="Onix"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
          </div>

          {/* Versão + Motorização */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Versão / Trim</Label>
              <Input
                placeholder="LT1, EXL, Touring…"
                value={versao}
                onChange={(e) => setVersao(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Motorização</Label>
              <Input
                placeholder="1.0T, 2.0, 1.6"
                value={motorizacao}
                onChange={(e) => setMotorizacao(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
          </div>

          {/* Combustível + Cor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Combustível</Label>
              <Input
                placeholder="Flex, Gasolina, Diesel…"
                value={combustivel}
                onChange={(e) => setCombustivel(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Cor</Label>
              <Input
                placeholder="Cinza, Branco, Preto…"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
          </div>

          {/* Ano */}
          <div className="w-32 space-y-1.5">
            <Label className="text-white/70 text-xs">Ano modelo</Label>
            <Input
              placeholder="2024"
              value={ano}
              onChange={(e) => setAno(e.target.value)}
              maxLength={4}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>

          {/* Chassi */}
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">
              Chassi{" "}
              <span className="text-white/30 font-normal">(ver CRLV — API retorna incompleto)</span>
            </Label>
            <Input
              placeholder="9BWZZZ377VT004251"
              value={chassi}
              onChange={(e) => setChassi(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              maxLength={17}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono text-xs tracking-widest"
            />
            {chassi.length > 0 && chassi.length !== 17 && (
              <p className="text-xs text-warning-400">{chassi.length}/17 dígitos</p>
            )}
            {chassi.length === 17 && (
              <p className="text-xs text-success-400">✓ Chassi completo</p>
            )}
          </div>
        </div>

        <Button type="submit" disabled={isPending || buscandoPlaca} className="w-full">
          {isPending ? "Criando..." : "Criar Orçamento"}
        </Button>
      </form>
    </div>
  )
}
