"use client"

import { useState } from "react"
import { Plus, Building2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useEmpresas, useCreateEmpresa } from "@/hooks/usePricingProfile"
import type { EmpresaPayload } from "@/hooks/usePricingProfile"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { formatCNPJ, onlyDigits } from "@paddock/utils"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

const EMPTY_FORM: EmpresaPayload = {
  cnpj: "",
  nome_fantasia: "",
  razao_social: "",
  inscricao_estadual: "",
}

export default function EmpresasPage() {
  const { data: empresas = [], isLoading } = useEmpresas()
  const { mutateAsync: criar, isPending } = useCreateEmpresa()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [form, setForm] = useState<EmpresaPayload>(EMPTY_FORM)

  const set = (field: keyof EmpresaPayload, value: string) =>
    setForm((p) => ({ ...p, [field]: value }))

  async function handleSave() {
    if (!form.cnpj || !form.nome_fantasia || !form.razao_social) {
      toast.error("Preencha CNPJ, nome fantasia e razão social.")
      return
    }
    try {
      await criar({ ...form, is_active: true })
      toast.success("Empresa cadastrada com sucesso.")
      setSheetOpen(false)
      setForm(EMPTY_FORM)
    } catch {
      toast.error("Erro ao cadastrar empresa. Verifique os dados e tente novamente.")
    }
  }

  return (
    <div className="px-0 py-3 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Empresas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Empresas cadastradas no motor de orçamentos.
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Empresa
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton columns={4} rows={4} />
      ) : empresas.length === 0 ? (
        <div className="rounded-md border px-4 py-12 text-center space-y-3">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada.</p>
          <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Cadastrar primeira empresa
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Nome Fantasia</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Razão Social</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empresas.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.nome_fantasia}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{e.cnpj}</TableCell>
                  <TableCell>{e.razao_social}</TableCell>
                  <TableCell>
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        e.is_active
                          ? "bg-success-500/10 text-success-400"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      {e.is_active ? "Ativa" : "Inativa"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[420px]">
          <SheetHeader>
            <SheetTitle>Nova Empresa</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">CNPJ *</Label>
              <Input
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
                value={formatCNPJ(form.cnpj)}
                onChange={(e) => set("cnpj", onlyDigits(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome Fantasia *</Label>
              <Input
                placeholder="Ex: DS Car Centro Automotivo"
                value={form.nome_fantasia}
                onChange={(e) => set("nome_fantasia", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Razão Social *</Label>
              <Input
                placeholder="Ex: DS Car Comércio e Serviços Ltda"
                value={form.razao_social}
                onChange={(e) => set("razao_social", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Inscrição Estadual</Label>
              <Input
                placeholder="Opcional"
                value={form.inscricao_estadual ?? ""}
                onChange={(e) => set("inscricao_estadual", e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
