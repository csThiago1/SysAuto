import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import type { BodyType } from '@paddock/car-3d/core';
import { api } from '@/lib/api';

const BODY_TYPES: [BodyType, ...BodyType[]] = ['hatch', 'sedan', 'suv', 'pickup', 'van'];
const BodyTypeSchema = z.enum(BODY_TYPES);

// Só o que a tela das paradas usa do GET …/checklist/entrada/ (o schema completo está no dscar-web).
const StateSchema = z.object({
  // checklist novo vem com "" (campo em branco no model)
  body_type: z.preprocess((v) => (v === '' ? null : v), BodyTypeSchema.nullable()),
  suggested_body_type: BodyTypeSchema.nullable(),
  finalized_at: z.string().nullable(),
  vehicle_color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  vehicle_make: z.string().nullable(),
  vehicle_family: z.string().nullable(),
  allow_nc_models: z.boolean(),
});
export type EntryChecklistState = z.infer<typeof StateSchema>;

/** Sem rede o GET falha e a tela segue com o rascunho local (carroceria e modelo padrão). */
export function useEntryChecklistState(osId: string) {
  return useQuery({
    queryKey: ['entry-checklist-state', osId] as const,
    queryFn: async () => StateSchema.parse(await api.get<unknown>(`/service-orders/${osId}/checklist/entrada/`)),
    enabled: osId.length > 0,
    retry: 1,
    networkMode: 'always', // offline-first: falha logo em vez de pausar
  });
}
