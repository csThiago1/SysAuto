import { apiRequest } from './client';
import { PaymentSchema } from '../schemas/payments';
import type { Payment } from '../schemas/payments';

export async function listPayments(serviceOrderId: number): Promise<{ count: number; results: Payment[] }> {
  const data = await apiRequest<{ count: number; results: unknown[] }>(
    `/service-orders/${serviceOrderId}/payments/`,
  );
  return {
    count: data.count,
    results: data.results.map((r) => PaymentSchema.parse(r)),
  };
}

export async function recordPayment(
  serviceOrderId: number,
  input: {
    payer_block: string;
    amount: string;
    method: string;
    reference?: string;
    fiscal_doc_ref?: string;
  },
): Promise<Payment> {
  const data = await apiRequest<unknown>(
    `/service-orders/${serviceOrderId}/payments/`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return PaymentSchema.parse(data);
}
