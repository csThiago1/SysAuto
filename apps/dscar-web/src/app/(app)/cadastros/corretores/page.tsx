"use client"

import React, { useState } from "react"
import { Building2, User, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { usePersons } from "@/hooks/usePersons"
import { PersonFormModal } from "@/components/Cadastros/PersonFormModal"
import type { Person } from "@paddock/types"

export default function CorretoresPage() {
  const { data: officesData, isLoading: loadingOffices } = usePersons({ role: "BROKER", kind: "PJ" })
  const [selectedOffice, setSelectedOffice] = useState<Person | null>(null)
  const { data: membersData, isLoading: loadingMembers } = usePersons(
    selectedOffice ? { role: "BROKER", kind: "PF", officeId: selectedOffice.id } : undefined
  )
  const [newOfficeOpen, setNewOfficeOpen] = useState(false)
  const [newBrokerOpen, setNewBrokerOpen] = useState(false)

  const offices = officesData?.results ?? []
  const members = membersData?.results ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Corretores</h1>
        <Button onClick={() => setNewOfficeOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Escritório
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-6 min-h-[400px]">
        {/* Painel esquerdo — Escritórios */}
        <div className="col-span-2 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Escritórios <Building2 className="inline h-3 w-3 ml-1" />
          </p>
          {loadingOffices ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : offices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum escritório cadastrado.</p>
          ) : (
            offices.map((office) => (
              <button
                key={office.id}
                onClick={() => setSelectedOffice(office)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedOffice?.id === office.id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border hover:border-border text-foreground/70"
                }`}
              >
                <p className="text-sm font-medium">{office.full_name}</p>
                {office.fantasy_name && (
                  <p className="text-xs text-muted-foreground mt-0.5">{office.fantasy_name}</p>
                )}
              </button>
            ))
          )}
        </div>

        {/* Painel direito — Corretores do escritório selecionado */}
        <div className="col-span-3">
          {!selectedOffice ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p className="text-sm">Selecione um escritório para ver os corretores</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Corretores — {selectedOffice.full_name}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewBrokerOpen(true)}
                  className="gap-1"
                >
                  <Plus className="h-3 w-3" /> Corretor
                </Button>
              </div>
              {loadingMembers ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum corretor vinculado.</p>
              ) : (
                members.map((broker) => (
                  <Card key={broker.id}>
                    <CardContent className="flex items-center gap-3 py-3">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{broker.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {broker.contacts?.find((c) => c.contact_type === "CELULAR")?.value ?? "Sem telefone"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <PersonFormModal
        open={newOfficeOpen}
        onOpenChange={setNewOfficeOpen}
        defaultRoles={["BROKER"]}
        defaultKind="PJ"
      />
      <PersonFormModal
        open={newBrokerOpen}
        onOpenChange={setNewBrokerOpen}
        defaultRoles={["BROKER"]}
        defaultKind="PF"
      />
    </div>
  )
}
