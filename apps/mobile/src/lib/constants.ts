const isDev = __DEV__;

// Hostname .local é resolvido pelo Bonjour/mDNS — funciona independente do IP
export const API_BASE_URL = isDev
  ? 'http://MacBook-Pro-de-Thiago.local:8000'
  : 'https://api.dscar.paddock.solutions';

export const DEFAULT_TENANT = isDev ? 'dscar.localhost' : 'dscar.paddock.solutions';

/** Retorna o domínio de tenant correto para o ambiente atual. */
export function getTenantDomain(slug: string): string {
  return isDev ? `${slug}.localhost` : `${slug}.paddock.solutions`;
}

export const SYNC_INTERVAL_MS = 30_000; // 30 segundos
export const MAX_PHOTO_SIZE_PX = 1920;
export const JPEG_QUALITY = 0.8;
