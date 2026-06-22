"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { PixKeyInput } from "@/components/ui/masked-input";
import { toast } from "sonner";

type Categoria = "PARTS" | "SERVICE" | "MATERIAL" | "GENERAL";
type PixKeyType = "" | "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";

interface SupplierProfileData {
  category: Categoria;
  default_payment_days: number;
  default_payment_method: string;
  bank_name: string;
  bank_agency: string;
  bank_account: string;
  pix_key: string;
  pix_key_type: PixKeyType;
  notes: string;
}

const CATEGORIA_LABEL: Record<Categoria, string> = {
  PARTS: "Peças",
  SERVICE: "Serviços",
  MATERIAL: "Material",
  GENERAL: "Geral",
};

function useSupplierProfile(personId: string) {
  return useQuery<SupplierProfileData>({
    queryKey: ["supplier-profile", personId],
    queryFn: () =>
      apiFetch<SupplierProfileData>(
        `/api/proxy/persons/${personId}/supplier-profile/`,
      ),
    enabled: !!personId,
  });
}

function useUpdateSupplierProfile(personId: string) {
  const qc = useQueryClient();
  return useMutation<SupplierProfileData, Error, Partial<SupplierProfileData>>({
    mutationFn: (data) =>
      apiFetch<SupplierProfileData>(
        `/api/proxy/persons/${personId}/supplier-profile/`,
        { method: "PATCH", body: JSON.stringify(data) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["supplier-profile", personId] });
      toast.success("Perfil de fornecedor salvo.");
    },
    onError: (err) => toast.error(err.message || "Erro ao salvar perfil."),
  });
}

export function SupplierProfileTab({ personId }: { personId: string }) {
  const { data: profile, isLoading } = useSupplierProfile(personId);
  const update = useUpdateSupplierProfile(personId);
  const [form, setForm] = useState<SupplierProfileData>({
    category: "GENERAL",
    default_payment_days: 30,
    default_payment_method: "",
    bank_name: "",
    bank_agency: "",
    bank_account: "",
    pix_key: "",
    pix_key_type: "",
    notes: "",
  });

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  function handleChange<K extends keyof SupplierProfileData>(
    key: K,
    value: SupplierProfileData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    update.mutate(form);
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Perfil de Fornecedor</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div>
            <Label>Categoria</Label>
            <select
              value={form.category}
              onChange={(e) => handleChange("category", e.target.value as Categoria)}
              className="w-full rounded border bg-background px-3 py-2"
            >
              {Object.entries(CATEGORIA_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Prazo de pagamento padrão (dias)</Label>
            <Input
              type="number"
              value={form.default_payment_days}
              onChange={(e) => handleChange("default_payment_days", Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Banco</Label>
            <Input
              value={form.bank_name}
              onChange={(e) => handleChange("bank_name", e.target.value)}
              placeholder="Ex: Itaú"
            />
          </div>
          <div>
            <Label>Agência</Label>
            <Input
              value={form.bank_agency}
              onChange={(e) => handleChange("bank_agency", e.target.value)}
              placeholder="Ex: 0001"
            />
          </div>
          <div>
            <Label>Conta corrente</Label>
            <Input
              value={form.bank_account}
              onChange={(e) => handleChange("bank_account", e.target.value)}
              placeholder="Ex: 12345-6"
            />
          </div>
          <div>
            <Label>Tipo de chave PIX</Label>
            <select
              value={form.pix_key_type}
              onChange={(e) => handleChange("pix_key_type", e.target.value as PixKeyType)}
              className="w-full rounded border bg-background px-3 py-2"
            >
              <option value="">—</option>
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
              <option value="EMAIL">E-mail</option>
              <option value="PHONE">Telefone</option>
              <option value="RANDOM">Aleatória</option>
            </select>
          </div>
          <div className="col-span-2">
            <Label>Chave PIX</Label>
            <PixKeyInput
              pixType={form.pix_key_type}
              value={form.pix_key}
              onValueChange={(v) => handleChange("pix_key", v)}
            />
          </div>
          <div className="col-span-2">
            <Label>Observações</Label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              className="w-full rounded border bg-background px-3 py-2"
              rows={3}
            />
          </div>
          <div className="col-span-2 flex justify-end">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
