import { z } from 'zod';

export const SignatureDocumentTypeSchema = z.enum([
  'BUDGET_APPROVAL',
  'OS_OPEN',
  'OS_DELIVERY',
  'COMPLEMENT_APPROVAL',
  'INSURANCE_ACCEPTANCE',
]);

export const SignatureMethodSchema = z.enum([
  'CANVAS_TABLET',
  'REMOTE_LINK',
  'SCAN_PDF',
]);

export const SignatureSchema = z.object({
  id: z.number(),
  service_order: z.number().nullable(),
  budget: z.number().nullable(),
  document_type: SignatureDocumentTypeSchema,
  document_type_display: z.string(),
  method: SignatureMethodSchema,
  method_display: z.string(),
  signer_name: z.string(),
  signer_cpf: z.string(),
  signature_hash: z.string(),
  ip_address: z.string().nullable(),
  user_agent: z.string(),
  signed_at: z.string(),
  notes: z.string(),
});

export const SignatureDetailSchema = SignatureSchema.extend({
  signature_png_base64: z.string(),
});

export type Signature = z.infer<typeof SignatureSchema>;
export type SignatureDetail = z.infer<typeof SignatureDetailSchema>;
export type SignatureDocumentType = z.infer<typeof SignatureDocumentTypeSchema>;
export type SignatureMethod = z.infer<typeof SignatureMethodSchema>;
