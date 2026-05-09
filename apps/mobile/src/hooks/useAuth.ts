import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/stores/auth.store';
import { API_BASE_URL, DEFAULT_TENANT } from '@/lib/constants';

type AuthUser = NonNullable<ReturnType<typeof useAuthStore.getState>['user']> | null;

interface JWTPayload {
  sub?: string;
  email?: string;
  name?: string;
  role?: string;
  extra_permissions?: string[];
}

interface AuthReturn {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  user: AuthUser;
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

        const data = (await res.json()) as { access: string; refresh: string };
        const token = data.access;

        // Decodifica payload para extrair dados do usuário real
        const payloadB64 = token.split('.')[1] ?? '';
        let decoded: JWTPayload = {};
        try {
          decoded = JSON.parse(atob(payloadB64)) as JWTPayload;
        } catch {
          // fallback
        }

        const userName = decoded.name ?? email.split('@')[0] ?? email;
        const userRole = decoded.role ?? 'CONSULTANT';
        const userId = decoded.sub ?? email;

        setAuth(
          { id: userId, email: decoded.email ?? email, name: userName, role: userRole },
          token,
          data.refresh,
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
    }
    storeLogout();
  }, [storeLogout]);

  return { login, logout, isAuthenticated, user };
}
