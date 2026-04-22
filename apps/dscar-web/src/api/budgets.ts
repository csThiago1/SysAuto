import { z } from 'zod';
import { apiRequest } from './client';
import { PaginatedSchema } from '../schemas/common';
import {
  BudgetReadSchema,
  BudgetVersionItemReadSchema,
  BudgetVersionReadSchema,
} from '../schemas/budgets';
import type { Budget, BudgetVersion, BudgetVersionItem } from '../schemas/budgets';

// Lista / Detalhe
export async function listBudgets(params: {
  search?: string;
  customer?: number;
  page?: number;
} = {}): Promise<{ count: number; results: Budget[] }> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.customer) qs.set('customer', String(params.customer));
  if (params.page) qs.set('page', String(params.page));
  const data = await apiRequest<unknown>(`/budgets/?${qs.toString()}`);
  const parsed = PaginatedSchema(BudgetReadSchema).parse(data);
  return { count: parsed.count, results: parsed.results };
}

export async function getBudget(id: number): Promise<Budget> {
  const data = await apiRequest<unknown>(`/budgets/${id}/`);
  return BudgetReadSchema.parse(data);
}

// Create
export async function createBudget(input: {
  customer_id: number;
  vehicle_plate: string;
  vehicle_description: string;
}): Promise<Budget> {
  const data = await apiRequest<unknown>('/budgets/', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return BudgetReadSchema.parse(data);
}

export async function cloneBudget(id: number): Promise<Budget> {
  const data = await apiRequest<unknown>(`/budgets/${id}/clone/`, { method: 'POST' });
  return BudgetReadSchema.parse(data);
}

// Versions
export async function getBudgetVersion(budgetId: number, versionId: number): Promise<BudgetVersion> {
  const data = await apiRequest<unknown>(`/budgets/${budgetId}/versions/${versionId}/`);
  return BudgetVersionReadSchema.parse(data);
}

export async function sendBudgetVersion(budgetId: number, versionId: number): Promise<BudgetVersion> {
  const data = await apiRequest<unknown>(
    `/budgets/${budgetId}/versions/${versionId}/send/`,
    { method: 'POST' },
  );
  return BudgetVersionReadSchema.parse(data);
}

export async function approveBudgetVersion(
  budgetId: number,
  versionId: number,
  input: { approved_by: string; evidence_s3_key?: string },
): Promise<{ version: BudgetVersion; service_order: unknown }> {
  const data = await apiRequest<{ version: unknown; service_order: unknown }>(
    `/budgets/${budgetId}/versions/${versionId}/approve/`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return {
    version: BudgetVersionReadSchema.parse(data.version),
    service_order: data.service_order,
  };
}

export async function rejectBudgetVersion(budgetId: number, versionId: number): Promise<BudgetVersion> {
  const data = await apiRequest<unknown>(
    `/budgets/${budgetId}/versions/${versionId}/reject/`,
    { method: 'POST' },
  );
  return BudgetVersionReadSchema.parse(data);
}

export async function reviseBudgetVersion(budgetId: number, versionId: number): Promise<BudgetVersion> {
  const data = await apiRequest<unknown>(
    `/budgets/${budgetId}/versions/${versionId}/revision/`,
    { method: 'POST' },
  );
  return BudgetVersionReadSchema.parse(data);
}

export function budgetPdfUrl(budgetId: number, versionId: number): string {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';
  return `${base}/budgets/${budgetId}/versions/${versionId}/pdf/`;
}

// Items
export async function createBudgetItem(
  budgetId: number,
  versionId: number,
  input: {
    description: string;
    quantity: string;
    unit_price: string;
    net_price: string;
    item_type?: string;
    external_code?: string;
    operations?: Array<{
      operation_type_code: string;
      labor_category_code: string;
      hours: string;
      hourly_rate: string;
    }>;
  },
): Promise<BudgetVersionItem> {
  const data = await apiRequest<unknown>(
    `/budgets/${budgetId}/versions/${versionId}/items/`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return BudgetVersionItemReadSchema.parse(data);
}

export async function deleteBudgetItem(
  budgetId: number,
  versionId: number,
  itemId: number,
): Promise<void> {
  await apiRequest<void>(
    `/budgets/${budgetId}/versions/${versionId}/items/${itemId}/`,
    { method: 'DELETE' },
  );
}

// Suppress unused import warning — z used implicitly via Zod schemas
void z;
