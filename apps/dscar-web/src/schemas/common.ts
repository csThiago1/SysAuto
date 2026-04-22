import { z } from 'zod';

export const PaginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    count: z.number(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    results: z.array(item),
  });

export const DecimalStringSchema = z.string().regex(/^-?\d+(\.\d+)?$/, 'Decimal inválido');

export const RefItemSchema = z.object({
  id: z.number(),
  code: z.string(),
  label: z.string(),
  description: z.string().optional().default(''),
  is_active: z.boolean().default(true),
  sort_order: z.number().default(0),
});

export type RefItem = z.infer<typeof RefItemSchema>;
