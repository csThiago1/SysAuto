/**
 * usePersonMutations — Mutations de create/update/deactivate de Person
 * Separado do usePersons para adesão ao SRP (Single Responsibility).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Person, CreatePersonPayload, UpdatePersonPayload, CepData } from "@paddock/types";
import { apiFetch } from "@/lib/api";

export function useCreatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePersonPayload) =>
      apiFetch<Person>("/api/proxy/persons/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["persons"] }),
  });
}

export function useUpdatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: UpdatePersonPayload }) =>
      apiFetch<Person>(`/api/proxy/persons/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["persons"] }),
  });
}

export function useDeactivatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) =>
      apiFetch(`/api/proxy/persons/${id}/`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["persons"] }),
  });
}

export function useCepLookup() {
  return useMutation({
    mutationFn: (cep: string) =>
      apiFetch<CepData>(`/api/proxy/persons/cep/${cep.replace(/\D/g, "")}/`),
  });
}
