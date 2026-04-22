import { z } from 'zod';
import { DecimalStringSchema, RefItemSchema } from './common';

export const ItemOperationReadSchema = z.object({
  id: z.number(),
  operation_type: RefItemSchema,
  labor_category: RefItemSchema,
  hours: DecimalStringSchema,
  hourly_rate: DecimalStringSchema,
  labor_cost: DecimalStringSchema,
});

export const ItemOperationWriteSchema = z.object({
  operation_type_code: z.string(),
  labor_category_code: z.string(),
  hours: z.string(),
  hourly_rate: z.string(),
  labor_cost: z.string().optional(),
});

export type ItemOperationRead = z.infer<typeof ItemOperationReadSchema>;
export type ItemOperationWrite = z.infer<typeof ItemOperationWriteSchema>;

export const BucketSchema = z.enum(['IMPACTO', 'SEM_COBERTURA', 'SOB_ANALISE']);
export const PayerBlockSchema = z.enum([
  'SEGURADORA', 'COMPLEMENTO_PARTICULAR', 'FRANQUIA', 'PARTICULAR',
]);
export const ItemTypeSchema = z.enum([
  'PART', 'SERVICE', 'EXTERNAL_SERVICE', 'FEE', 'DISCOUNT',
]);
export const PartTypeSchema = z.enum(['GENUINA', 'ORIGINAL', 'OUTRAS_FONTES', 'VERDE', '']);
export const SupplierSchema = z.enum(['OFICINA', 'SEGURADORA']);
