import { z } from 'zod';
import { DecimalStringSchema } from './common';

export const PaymentMethodSchema = z.enum(['PIX', 'BOLETO', 'DINHEIRO', 'CARTAO', 'TRANSFERENCIA']);
export const PaymentStatusSchema = z.enum(['pending', 'received', 'refunded']);
export const PaymentPayerBlockSchema = z.enum([
  'SEGURADORA', 'COMPLEMENTO_PARTICULAR', 'FRANQUIA', 'PARTICULAR',
]);

export const PaymentSchema = z.object({
  id: z.number(),
  service_order: z.number(),
  payer_block: PaymentPayerBlockSchema,
  payer_block_display: z.string(),
  amount: DecimalStringSchema,
  method: PaymentMethodSchema,
  method_display: z.string(),
  reference: z.string(),
  received_at: z.string().nullable(),
  received_by: z.string(),
  fiscal_doc_ref: z.string(),
  status: PaymentStatusSchema,
  created_at: z.string(),
});

export type Payment = z.infer<typeof PaymentSchema>;
