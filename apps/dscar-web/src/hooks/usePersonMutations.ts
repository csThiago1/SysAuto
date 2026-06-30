/**
 * usePersonMutations — Mutations de create/update/deactivate de Person.
 * CRUD genérico via @/lib/crud-mutations; cep_lookup é caso especial.
 */

import { useMutation } from "@tanstack/react-query";
import type { Person, CreatePersonPayload, UpdatePersonPayload, CepData } from "@paddock/types";

import { apiFetch } from "@/lib/api";
import { useCreate, useDelete, useUpdate } from "@/lib/crud-mutations";

export const useCreatePerson = () => useCreate<Person, CreatePersonPayload>("persons");
export const useUpdatePerson = () => useUpdate<Person, UpdatePersonPayload>("persons");
export const useDeactivatePerson = () => useDelete("persons");

export function useCepLookup() {
  return useMutation({
    mutationFn: (cep: string) =>
      apiFetch<CepData>(`/api/proxy/persons/cep/${cep.replace(/\D/g, "")}/`),
  });
}
