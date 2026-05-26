import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/stores/auth.store';
import { API_BASE_URL, DEFAULT_TENANT } from '@/lib/constants';

type AuthUser = NonNullable<ReturnType<typeof useAuthStore.getState>['user']> | null;
type UserRole = NonNullable<AuthUser>['role'];

const VALID_ROLES: readonly UserRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'CONSULTANT', 'STOREKEEPER'];

interface JWTPayload {
  sub?: string;
  email?: string;
  name?: string;
  role?: string;
  permissions?: string[];
}

/** Response from POST /api/v1/auth/login/ */
interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface AuthReturn {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  user: AuthUser;
}

function normalizeRole(role: string | undefined): UserRole {
  return VALID_ROLES.includes(role as UserRole) ? role as UserRole : 'CONSULTANT';
}

export function useAuth(): AuthReturn {
  const { setAuth, logout: storeLogout, isAuthenticated, user } = useAuthStore();

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/login/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Domain': DEFAULT_TENANT,
          },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) return false;

        const data = (await res.json()) as LoginResponse;
        const token = data.access_token;
        const refreshToken = data.refresh_token;

        // Store tokens securely on native platforms
        if (Platform.OS !== 'web') {
          await SecureStore.setItemAsync('access_token', token);
          await SecureStore.setItemAsync('refresh_token', refreshToken);
        }

        // Decode JWT payload (no verification needed — backend already verified)
        const payloadB64 = token.split('.')[1] ?? '';
        let decoded: JWTPayload = {};
        try { decoded = JSON.parse(atob(payloadB64)) as JWTPayload; } catch { /* fallback */ }

        const userName = decoded.name ?? email.split('@')[0] ?? email;
        const userRole = normalizeRole(decoded.role);
        const userId = decoded.sub ?? email;

        setAuth(
          { id: userId, email: decoded.email ?? email, name: userName, role: userRole },
          token,
          refreshToken,
        );
        return true;
      } catch {
        return false;
      }
    },
    [setAuth],
  );

  const logout = useCallback(async (): Promise<void> => {
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync('auth-storage');
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
    }
    storeLogout();
  }, [storeLogout]);

  return { login, logout, isAuthenticated, user };
}
