/**
 * usePersonMutations — Mutations de create/update/deactivate de Person.
 * CRUD genérico via @/lib/crud-mutations.
 */

import type { Person, CreatePersonPayload, UpdatePersonPayload } from "@paddock/types";

import { useCreate, useDelete, useUpdate } from "@/lib/crud-mutations";

export const useCreatePerson = () => useCreate<Person, CreatePersonPayload>("persons");
export const useUpdatePerson = () => useUpdate<Person, UpdatePersonPayload>("persons");
export const useDeactivatePerson = () => useDelete("persons");
