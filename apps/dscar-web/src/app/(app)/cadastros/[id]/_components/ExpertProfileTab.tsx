"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { toast } from "sonner";

interface ExpertProfileData {
  registration_number: string;
  insurers: string[];
}

function useExpertProfile(personId: string) {
  return useQuery<ExpertProfileData>({
    queryKey: ["expert-profile", personId],
    queryFn: () =>
      apiFetch<ExpertProfileData>(
        `/api/proxy/persons/${personId}/expert-profile/`,
      ),
    enabled: !!personId,
  });
}

function useUpdateExpertProfile(personId: string) {
  const qc = useQueryClient();
  return useMutation<ExpertProfileData, Error, Partial<ExpertProfileData>>({
    mutationFn: (data) =>
      apiFetch<ExpertProfileData>(
        `/api/proxy/persons/${personId}/expert-profile/`,
        { method: "PATCH", body: JSON.stringify(data) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["expert-profile", personId] });
      toast.success("Perfil de perito salvo.");
    },
    onError: (err) => toast.error(err.message || "Erro ao salvar perfil."),
  });
}

export function ExpertProfileTab({ personId }: { personId: string }) {
  const { data: profile, isLoading } = useExpertProfile(personId);
  const update = useUpdateExpertProfile(personId);
  const [form, setForm] = useState<ExpertProfileData>({
    registration_number: "",
    insurers: [],
  });

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    update.mutate(form);
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Perfil de Perito</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Número de registro</Label>
            <Input
              value={form.registration_number}
              onChange={(e) =>
                setForm((p) => ({ ...p, registration_number: e.target.value }))
              }
              placeholder="Ex: CREA-AM 12345"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Vínculo com seguradoras é gerenciado no detalhe da seguradora.
          </p>
          <div className="flex justify-end">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
