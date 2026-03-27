/**
 * API Client — DS Car ERP
 * Conecta ao backend Django em desenvolvimento (localhost:8000).
 * Token JWT armazenado em memória (access) e localStorage (refresh).
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

let accessToken: string | null = null;

function getRefreshToken(): string | null {
  return localStorage.getItem('dscar_refresh_token');
}

function setTokens(access: string, refresh: string): void {
  accessToken = access;
  localStorage.setItem('dscar_refresh_token', refresh);
}

function clearTokens(): void {
  accessToken = null;
  localStorage.removeItem('dscar_refresh_token');
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await fetch(`${BASE_URL}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) { clearTokens(); return null; }
    const data = await res.json();
    accessToken = data.access;
    if (data.refresh) localStorage.setItem('dscar_refresh_token', data.refresh);
    return accessToken;
  } catch {
    clearTokens();
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const makeRequest = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> ?? {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  };

  let res = await makeRequest(accessToken);

  // Token expirado → tentar refresh
  if (res.status === 401 && getRefreshToken()) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await makeRequest(newToken);
    }
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err.detail ?? err.message ?? JSON.stringify(err);
    } catch { /* ignore */ }
    throw new Error(detail);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<void> {
  const data = await apiRequest<{ access: string; refresh: string }>('/auth/token/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setTokens(data.access, data.refresh);
}

export function logout(): void {
  clearTokens();
}

export function isAuthenticated(): boolean {
  return !!accessToken || !!getRefreshToken();
}
