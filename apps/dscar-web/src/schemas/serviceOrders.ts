import { z } from 'zod';
import {
  BucketSchema, ItemOperationReadSchema, ItemTypeSchema,
  PartTypeSchema, PayerBlockSchema, SupplierSchema,
} from './items';
import { DecimalStringSchema } from './common';

export const OSStatusSchema = z.enum([
  'reception', 'initial_survey', 'budget', 'waiting_parts', 'repair',
  'mechanic', 'bodywork', 'painting', 'assembly', 'polishing', 'washing',
  'final_survey', 'ready', 'delivered', 'cancelled',
]);

export const VersionStatusSchema = z.enum([
  'pending', 'approved', 'rejected',
  'analisado', 'autorizado', 'correcao', 'em_analise', 'negado',
  'superseded',
]);

export const EventTypeSchema = z.enum([
  'STATUS_CHANGE', 'AUTO_TRANSITION', 'VERSION_CREATED', 'VERSION_APPROVED',
  'VERSION_REJECTED', 'ITEM_ADDED', 'ITEM_REMOVED', 'ITEM_EDITED',
  'IMPORT_RECEIVED', 'PARECER_ADDED', 'PHOTO_UPLOADED', 'PHOTO_REMOVED',
  'PAYMENT_RECORDED', 'FISCAL_ISSUED', 'SIGNATURE_CAPTURED', 'BUDGET_LINKED',
]);

export const ServiceOrderVersionItemSchema = z.object({
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

export const ServiceOrderVersionSchema = z.object({
  id: z.number(),
  version_number: z.number(),
  external_version: z.string(),
  external_numero_vistoria: z.string(),
  external_integration_id: z.string(),
  source: z.string(),
  status: VersionStatusSchema,
  status_display: z.string(),
  status_label: z.string(),
  subtotal: DecimalStringSchema,
  discount_total: DecimalStringSchema,
  net_total: DecimalStringSchema,
  labor_total: DecimalStringSchema,
  parts_total: DecimalStringSchema,
  total_seguradora: DecimalStringSchema,
  total_complemento_particular: DecimalStringSchema,
  total_franquia: DecimalStringSchema,
  content_hash: z.string(),
  raw_payload_s3_key: z.string(),
  hourly_rates: z.record(z.string()).default({}),
  global_discount_pct: DecimalStringSchema,
  created_at: z.string(),
  created_by: z.string(),
  approved_at: z.string().nullable(),
  items: z.array(ServiceOrderVersionItemSchema),
});

export const ServiceOrderReadSchema = z.object({
  id: z.number(),
  os_number: z.string(),
  customer: z.number(),
  customer_name: z.string(),
  customer_type: z.enum(['PARTICULAR', 'SEGURADORA']),
  vehicle_plate: z.string(),
  vehicle_description: z.string(),
  status: OSStatusSchema,
  status_display: z.string(),
  previous_status: z.string(),
  source_budget: z.number().nullable(),
  insurer: z.number().nullable(),
  insurer_name: z.string(),
  casualty_number: z.string(),
  external_budget_number: z.string(),
  policy_number: z.string(),
  policy_item: z.string(),
  franchise_amount: DecimalStringSchema,
  notes: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  active_version: ServiceOrderVersionSchema.nullable(),
});

export const ServiceOrderEventSchema = z.object({
  id: z.number(),
  event_type: EventTypeSchema,
  event_type_display: z.string(),
  actor: z.string(),
  payload: z.record(z.unknown()).default({}),
  from_state: z.string(),
  to_state: z.string(),
  created_at: z.string(),
});

export const ServiceOrderParecerSchema = z.object({
  id: z.number(),
  version: z.number().nullable(),
  source: z.string(),
  source_display: z.string(),
  flow_number: z.number().nullable(),
  author_external: z.string(),
  author_org: z.string(),
  author_internal: z.string(),
  parecer_type: z.string(),
  parecer_type_display: z.string(),
  body: z.string(),
  created_at_external: z.string().nullable(),
  created_at: z.string(),
});

export type ServiceOrder = z.infer<typeof ServiceOrderReadSchema>;
export type ServiceOrderVersion = z.infer<typeof ServiceOrderVersionSchema>;
export type ServiceOrderEvent = z.infer<typeof ServiceOrderEventSchema>;
export type OSStatus = z.infer<typeof OSStatusSchema>;
export type EventType = z.infer<typeof EventTypeSchema>;
