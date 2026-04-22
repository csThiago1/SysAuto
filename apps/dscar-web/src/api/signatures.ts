import { apiRequest } from './client';
import { PaginatedSchema } from '../schemas/common';
import {
  SignatureDetailSchema,
  SignatureSchema,
} from '../schemas/signatures';
import type {
  Signature,
  SignatureDetail,
  SignatureDocumentType,
  SignatureMethod,
} from '../schemas/signatures';

export async function listSignatures(params: {
  service_order?: number;
  budget?: number;
  document_type?: string;
} = {}): Promise<{ count: number; results: Signature[] }> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) qs.set(k, String(v));
  });
  const data = await apiRequest<unknown>(`/signatures/?${qs.toString()}`);
  const parsed = PaginatedSchema(SignatureSchema).parse(data);
  return { count: parsed.count, results: parsed.results };
}

export async function getSignature(id: number): Promise<SignatureDetail> {
  const data = await apiRequest<unknown>(`/signatures/${id}/`);
  return SignatureDetailSchema.parse(data);
}

export async function captureSignature(input: {
  document_type: SignatureDocumentType;
  method: SignatureMethod;
  signer_name: string;
  signature_png_base64: string;
  service_order_id?: number | null;
  budget_id?: number | null;
  signer_cpf?: string;
  notes?: string;
}): Promise<SignatureDetail> {
  const data = await apiRequest<unknown>('/signatures/capture/', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return SignatureDetailSchema.parse(data);
}

export async function verifySignature(id: number): Promise<{
  signature_id: number;
  integrity_valid: boolean;
  stored_hash: string;
}> {
  return apiRequest(`/signatures/${id}/verify/`);
}
