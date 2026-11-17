import { z } from 'zod';

/** Pastas das fotos de "antes": checklist de entrada (novo) e vistoria inicial (OS antigas). */
const BEFORE_FOLDERS = new Set(['checklist_entrada', 'vistoria_inicial']);

const PhotoSchema = z.object({
  id: z.string(),
  url: z.string(),
  folder: z.string(),
  slot: z.string().nullish(),
});

export type BeforePhoto = { id: string; url: string; slot?: string };

/**
 * GET /service-orders/{id}/photos/ devolve todas as fotos ativas (o backend ignora ?folder=):
 * filtra aqui as de "antes", em ordem de upload. Item malformado é descartado.
 */
export function parseBeforePhotos(data: unknown): BeforePhoto[] {
  const list = Array.isArray(data) ? data : z.object({ results: z.array(z.unknown()) }).safeParse(data).data?.results ?? [];
  return list.flatMap((item) => {
    const p = PhotoSchema.safeParse(item);
    if (!p.success || !BEFORE_FOLDERS.has(p.data.folder)) return [];
    return [{ id: p.data.id, url: p.data.url, ...(p.data.slot ? { slot: p.data.slot } : {}) }];
  });
}
