import { z } from 'zod';
import {
  BucketSchema, ItemOperationReadSchema, ItemTypeSchema,
  PartTypeSchema, PayerBlockSchema, SupplierSchema,
} from './items';
import { DecimalStringSchema } from './common';

export const BudgetVersionStatusSchema = z.enum([
  'draft', 'sent', 'approved', 'rejected', 'expired', 'revision', 'superseded',
]);

export const BudgetVersionItemReadSchema = z.object({
  id: z.number(),
  bucket: BucketSchema,
  payer_block: PayerBlockSchema,
  impact_area: z.number().nullable(),
  item_type: ItemTypeSchema,
  description: z.string(),
  external_code: z.string(),
  part_type: PartTypeSchema,
  supplier: SupplierSchema,
  quantity: DecimalStringSchema,
  unit_price: DecimalStringSchema,
  unit_cost: DecimalStringSchema.nullable(),
  discount_pct: DecimalStringSchema,
  net_price: DecimalStringSchema,
  flag_abaixo_padrao: z.boolean(),
  flag_acima_padrao: z.boolean(),
  flag_inclusao_manual: z.boolean(),
  flag_codigo_diferente: z.boolean(),
  flag_servico_manual: z.boolean(),
  flag_peca_da_conta: z.boolean(),
  sort_order: z.number(),
  operations: z.array(ItemOperationReadSchema),
});

export const BudgetVersionReadSchema = z.object({
  id: z.number(),
  version_number: z.number(),
  status: BudgetVersionStatusSchema,
  status_display: z.string(),
  status_label: z.string(),
  valid_until: z.string().nullable(),
  subtotal: DecimalStringSchema,
  discount_total: DecimalStringSchema,
  net_total: DecimalStringSchema,
  labor_total: DecimalStringSchema,
  parts_total: DecimalStringSchema,
  pdf_s3_key: z.string(),
  sent_at: z.string().nullable(),
  approved_at: z.string().nullable(),
  approved_by: z.string(),
  approval_evidence_s3_key: z.string(),
  created_by: z.string(),
  created_at: z.string(),
  items: z.array(BudgetVersionItemReadSchema),
});

export const BudgetReadSchema = z.object({
  id: z.number(),
  number: z.string(),
  customer: z.number(),
  customer_name: z.string(),
  vehicle_plate: z.string(),
  vehicle_description: z.string(),
  cloned_from: z.number().nullable(),
  service_order: z.number().nullable(),
  active_version: BudgetVersionReadSchema.nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Budget = z.infer<typeof BudgetReadSchema>;
export type BudgetVersion = z.infer<typeof BudgetVersionReadSchema>;
export type BudgetVersionItem = z.infer<typeof BudgetVersionItemReadSchema>;
export type BudgetVersionStatus = z.infer<typeof BudgetVersionStatusSchema>;
