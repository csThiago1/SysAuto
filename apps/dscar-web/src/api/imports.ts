import { apiFetchMultipart, apiRequest } from './client';
import { ImportAttemptSchema } from '../schemas/imports';
import { PaginatedSchema } from '../schemas/common';
import type { ImportAttempt } from '../schemas/imports';

export async function listAttempts(params: {
  casualty_number?: string;
  parsed_ok?: boolean;
  page?: number;
} = {}): Promise<{ count: number; results: ImportAttempt[] }> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) qs.set(k, String(v));
  });
  const data = await apiRequest<unknown>(`/imports/attempts/?${qs.toString()}`);
  const parsed = PaginatedSchema(ImportAttemptSchema).parse(data);
  return { count: parsed.count, results: parsed.results };
}

export async function fetchCilia(input: {
  casualty_number: string;
  budget_number: string;
  version_number?: number | null;
}): Promise<ImportAttempt> {
  const data = await apiRequest<unknown>('/imports/attempts/cilia/fetch/', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return ImportAttemptSchema.parse(data);
}

export async function uploadXmlIfx(input: {
  file: File;
  insurer_code: 'porto' | 'azul' | 'itau';
}): Promise<ImportAttempt> {
  const formData = new FormData();
  formData.append('file', input.file);
  formData.append('insurer_code', input.insurer_code);

  const data = await apiFetchMultipart('/imports/attempts/xml/upload/', formData);
  return ImportAttemptSchema.parse(data);
}
