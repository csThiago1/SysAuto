import { useAuthStore } from '@/stores/auth.store';
import { API_BASE_URL } from './constants';

class ApiError extends Error {
  public readonly status: number;
  public readonly data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { token, activeCompany } = useAuthStore.getState();

  // Garante trailing slash no path (Django APPEND_SLASH=True)
  // Separa query string para não adicionar '/' dentro dos parâmetros
  const [pathname, queryString] = path.split('?');
  const slashedPath = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const normalizedPath = queryString ? `${slashedPath}?${queryString}` : slashedPath;
  const url = `${API_BASE_URL}/api/v1${normalizedPath}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-Domain': `${activeCompany}.localhost`,
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    if (response.status === 401) {
      // Token inválido ou expirado — forçar logout para redirecionar ao login.
      useAuthStore.getState().logout();
    }
    throw new ApiError(response.status, `HTTP ${response.status}`, data);
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string): Promise<T> => apiFetch<T>(path),
  post: <T>(path: string, body: unknown): Promise<T> =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown): Promise<T> =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string): Promise<unknown> => apiFetch(path, { method: 'DELETE' }),
};

export { ApiError };
