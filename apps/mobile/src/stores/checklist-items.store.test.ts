import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/constants', () => ({
  API_BASE_URL: 'http://api',
  getTenantDomain: (slug: string) => `${slug}.test`,
}));
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: { getState: () => ({ token: 't', activeCompany: 'dscar', logout: () => undefined }) },
}));

import { syncChecklistItems, useChecklistItemsStore } from './checklist-items.store';

const OS = 'os-1';
let calls = 0;
let status = 200;
let body: unknown = {};

beforeEach(() => {
  calls = 0;
  status = 200;
  body = {};
  useChecklistItemsStore.setState({ items: {}, locked: {} });
  useChecklistItemsStore.getState().setItemStatus(OS, 'entrada', 'tires', 'estepe', 'ok');
  vi.stubGlobal('fetch', async () => {
    calls++;
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  });
});

describe('syncChecklistItems', () => {
  it('envia os itens', async () => {
    expect(await syncChecklistItems(OS)).toBe('synced');
    expect(calls).toBe(1);
  });

  it('409 checklist_locked é definitivo: não tenta de novo', async () => {
    status = 409;
    body = { detail: 'x', code: 'checklist_locked' };
    expect(await syncChecklistItems(OS)).toBe('locked');
    expect(await syncChecklistItems(OS)).toBe('locked');
    expect(calls).toBe(1);
  });

  it('outros erros propagam e o próximo envio tenta de novo', async () => {
    status = 503;
    await expect(syncChecklistItems(OS)).rejects.toThrow('HTTP 503');
    status = 200;
    expect(await syncChecklistItems(OS)).toBe('synced');
    expect(calls).toBe(2);
  });
});
