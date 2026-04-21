import { apiRequest } from './client';
import { PaginatedSchema, RefItemSchema } from '../schemas/common';
import type { RefItem } from '../schemas/common';

export async function listOperationTypes(): Promise<RefItem[]> {
  const data = await apiRequest<unknown>('/items/operation-types/');
  return PaginatedSchema(RefItemSchema).parse(data).results;
}

export async function listLaborCategories(): Promise<RefItem[]> {
  const data = await apiRequest<unknown>('/items/labor-categories/');
  return PaginatedSchema(RefItemSchema).parse(data).results;
}
