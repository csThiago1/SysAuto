import { z } from 'zod';

export const ImportAttemptSchema = z.object({
  id: z.number(),
  source: z.string(),
  source_display: z.string(),
  trigger: z.string(),
  trigger_display: z.string(),
  casualty_number: z.string(),
  budget_number: z.string(),
  version_number: z.number().nullable(),
  http_status: z.number().nullable(),
  parsed_ok: z.boolean(),
  error_message: z.string(),
  error_type: z.string(),
  raw_hash: z.string(),
  service_order: z.number().nullable(),
  version_created: z.number().nullable(),
  duplicate_of: z.number().nullable(),
  duration_ms: z.number().nullable(),
  created_at: z.string(),
  created_by: z.string(),
});

export type ImportAttempt = z.infer<typeof ImportAttemptSchema>;
