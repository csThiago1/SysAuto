"use client"

import React, { use, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  useInsurer,
  useInsurerTenantProfile,
  useUpdateInsurerTenantProfile,
} from "@/hooks/useInsurers"
import type { InsurerTenantProfile } from "@paddock/types"

interface Props {
  params: Promise<{ id: string }>
}

export default function InsurerDetailPage({ params }: Props) {
  const { id } = use(params)
  const { data: insurer, isLoading: loadingInsurer } = useInsurer(id)
  const { data: profile, isLoading: loadingProfile } = useInsurerTenantProfile(id)
  const updateProfile = useUpdateInsurerTenantProfile()
  const [activeTab, setActiveTab] = useState<"geral" | "operacional">("geral")

  const { register, handleSubmit } = useForm<Partial<InsurerTenantProfile>>({
    values: profile,
  })

  if (loadingInsurer || loadingProfile) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (!insurer) return <p className="text-white/50">Seguradora não encontrada.</p>

  async function onSubmit(data: Partial<InsurerTenantProfile>) {
    try {
      await updateProfile.mutateAsync({ insurerId: id, data })
    } catch {
      // toast já disparado no hook
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/cadastros/seguradoras">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-white">{insurer.name}</h1>
          {insurer.trade_name && (
            <p className="text-sm text-white/50">{insurer.trade_name}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {(["geral", "operacional"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "text-white border-b-2 border-primary"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            {tab === "geral" ? "Dados Gerais" : "Perfil Operacional"}
          </button>
        ))}
      </div>

      {activeTab === "geral" && (
        <Card>
          <CardContent className="pt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-white/40">CNPJ</p>
              <p className="text-sm text-white">{insurer.cnpj}</p>
            </div>
            <div>
              <p className="text-xs text-white/40">Abreviação</p>
              <p className="text-sm text-white">{insurer.abbreviation || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-white/40">Integração Cilia</p>
              <p className="text-sm text-white">{insurer.uses_cilia ? "Sim" : "Não"}</p>
            </div>
            <div>
              <p className="text-xs text-white/40">Status</p>
              <p className="text-sm text-white">{insurer.is_active ? "Ativa" : "Inativa"}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "operacional" && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Contato Sinistros */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contato de Sinistros</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input {...register("contact_sinistro_nome")} />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input {...register("contact_sinistro_phone")} />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input type="email" {...register("contact_sinistro_email")} />
              </div>
            </CardContent>
          </Card>

          {/* Contato Financeiro */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contato Financeiro</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input {...register("contact_financeiro_nome")} />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input {...register("contact_financeiro_phone")} />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input type="email" {...register("contact_financeiro_email")} />
              </div>
            </CardContent>
          </Card>

          {/* Contato Comercial */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contato Comercial</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input {...register("contact_comercial_nome")} />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input {...register("contact_comercial_phone")} />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input type="email" {...register("contact_comercial_email")} />
              </div>
            </CardContent>
          </Card>

          {/* SLA e Portal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SLA e Portal</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">SLA de resposta (dias úteis)</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  {...register("sla_dias_uteis", { valueAsNumber: true })}
                />
              </div>
              <div>
                <Label className="text-xs">Portal de acionamento (URL)</Label>
                <Input type="url" placeholder="https://..." {...register("portal_url")} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Observações operacionais</Label>
                <Textarea
                  rows={3}
                  {...register("observacoes_operacionais")}
                  placeholder="Orientações internas, documentos exigidos..."
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Salvando..." : "Salvar Perfil"}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
