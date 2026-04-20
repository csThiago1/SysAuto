// expo-constants disponivel para uso em funcionalidades futuras (ex: expoConfig.version)
// import Constants from 'expo-constants';

const isDev = __DEV__;

export const API_BASE_URL = isDev
  ? 'http://localhost:8000'
  : 'https://api.dscar.paddock.solutions';

export const DEFAULT_TENANT = isDev ? 'dscar.localhost' : 'dscar.paddock.solutions';

/** Retorna o domínio de tenant correto para o ambiente atual. */
export function getTenantDomain(slug: string): string {
  return isDev ? `${slug}.localhost` : `${slug}.paddock.solutions`;
}

export const DEV_JWT_SECRET = 'dscar-dev-secret-paddock-2025';
export const DEV_ACCESS_CODE = 'paddock123'; // senha dev — documentada no CLAUDE.md

export const SYNC_INTERVAL_MS = 30_000; // 30 segundos
export const MAX_PHOTO_SIZE_PX = 1920;
export const JPEG_QUALITY = 0.8;
