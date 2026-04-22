import { z } from 'zod';
import { apiRequest } from './client';
import { PaginatedSchema } from '../schemas/common';
import {
  ServiceOrderEventSchema,
  ServiceOrderParecerSchema,
  ServiceOrderReadSchema,
  ServiceOrderVersionSchema,
} from '../schemas/serviceOrders';
import type {
  ServiceOrder,
  ServiceOrderEvent,
  ServiceOrderVersion,
} from '../schemas/serviceOrders';

export async function listServiceOrdersV2(params: {
  search?: string;
  customer_type?: string;
  status?: string;
  page?: number;
} = {}): Promise<{ count: number; results: ServiceOrder[] }> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) qs.set(k, String(v));
  });
  const data = await apiRequest<unknown>(`/service-orders/?${qs.toString()}`);
  const parsed = PaginatedSchema(ServiceOrderReadSchema).parse(data);
  return { count: parsed.count, results: parsed.results };
}

export async function getServiceOrder(id: number): Promise<ServiceOrder> {
  const data = await apiRequest<unknown>(`/service-orders/${id}/`);
  return ServiceOrderReadSchema.parse(data);
}

export async function changeStatusV2(
  id: number,
  newStatus: string,
  notes?: string,
): Promise<ServiceOrder> {
  const data = await apiRequest<unknown>(
    `/service-orders/${id}/change-status/`,
    {
      method: 'POST',
      body: JSON.stringify({ new_status: newStatus, notes: notes ?? '' }),
    },
  );
  return ServiceOrderReadSchema.parse(data);
}

export async function listEvents(
  id: number,
  eventType?: string,
): Promise<{ count: number; results: ServiceOrderEvent[] }> {
  const qs = new URLSearchParams();
  if (eventType) qs.set('event_type', eventType);
  const data = await apiRequest<{ count: number; results: unknown[] }>(
    `/service-orders/${id}/events/?${qs.toString()}`,
  );
  return {
    count: data.count,
    results: data.results.map((r) => ServiceOrderEventSchema.parse(r)),
  };
}

export async function listPareceres(id: number) {
  const data = await apiRequest<unknown[]>(`/service-orders/${id}/pareceres/`);
  return z.array(ServiceOrderParecerSchema).parse(data);
}

export async function addInternalParecer(
  id: number,
  body: string,
  parecerType = 'COMENTARIO_INTERNO',
) {
  const data = await apiRequest<unknown>(
    `/service-orders/${id}/pareceres/`,
    {
      method: 'POST',
      body: JSON.stringify({ body, parecer_type: parecerType }),
    },
  );
  return ServiceOrderParecerSchema.parse(data);
}

export async function addComplement(
  id: number,
  items: Array<{
    description: string;
    quantity: string;
    unit_price: string;
    net_price: string;
    item_type?: string;
    impact_area?: number | null;
  }>,
  approvedBy: string,
): Promise<ServiceOrderVersion> {
  const data = await apiRequest<unknown>(
    `/service-orders/${id}/complement/`,
    {
      method: 'POST',
      body: JSON.stringify({ items, approved_by: approvedBy }),
    },
  );
  return ServiceOrderVersionSchema.parse(data);
}

export async function approveVersion(
  serviceOrderId: number,
  versionId: number,
): Promise<ServiceOrderVersion> {
  const data = await apiRequest<unknown>(
    `/service-orders/${serviceOrderId}/versions/${versionId}/approve/`,
    { method: 'POST' },
  );
  return ServiceOrderVersionSchema.parse(data);
}
