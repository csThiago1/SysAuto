"use client"

import React, { useState } from "react"
import { Plus, Search } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useExperts, useCreateExpert, useUpdateExpert } from "@/hooks/useExperts"
import type { Expert } from "@paddock/types"

interface ExpertFormValues {
  name: string
  email: string
  phone: string
  is_active: boolean
}

export default function EspecialistasPage() {
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Expert | null>(null)
  const { data: experts, isLoading } = useExperts({ search })
  const createExpert = useCreateExpert()
  const updateExpert = useUpdateExpert()

  const { register, handleSubmit, reset } = useForm<ExpertFormValues>({
    defaultValues: { name: "", email: "", phone: "", is_active: true },
  })

  function openNew() {
    setEditing(null)
    reset({ name: "", email: "", phone: "", is_active: true })
    setFormOpen(true)
  }

  function openEdit(expert: Expert) {
    setEditing(expert)
    reset({
      name: expert.name,
      email: expert.email,
      phone: expert.phone,
      is_active: expert.is_active,
    })
    setFormOpen(true)
  }

  async function onSubmit(data: ExpertFormValues) {
    try {
      if (editing) {
        await updateExpert.mutateAsync({ id: editing.id, data })
        toast.success("Especialista atualizado.")
      } else {
        await createExpert.mutateAsync(data)
        toast.success("Especialista cadastrado.")
      }
      setFormOpen(false)
    } catch {
      toast.error("Erro ao salvar. Tente novamente.")
    }
  }

  const expertList = experts ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Especialistas / Peritos</h1>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Especialista
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : expertList.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhum especialista cadastrado.
        </p>
      ) : (
        <div className="space-y-2">
          {expertList.map((expert) => (
            <Card
              key={expert.id}
              className="cursor-pointer hover:border-border transition-colors"
              onClick={() => openEdit(expert)}
            >
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{expert.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {expert.phone || "Sem telefone"} · {expert.email || "Sem e-mail"}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    expert.is_active
                      ? "bg-success-900/40 text-success-400"
                      : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {expert.is_active ? "Ativo" : "Inativo"}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Especialista" : "Novo Especialista"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input {...register("name", { required: true })} placeholder="Nome completo" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input {...register("phone")} placeholder="(92) 99999-0000" />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" {...register("email")} placeholder="perito@email.com" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
              <input type="checkbox" {...register("is_active")} className="accent-primary" />
              Ativo
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createExpert.isPending || updateExpert.isPending}
              >
                {createExpert.isPending || updateExpert.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
