import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/stores/auth.store';
import { API_BASE_URL, DEFAULT_TENANT } from '@/lib/constants';

type AuthUser = NonNullable<ReturnType<typeof useAuthStore.getState>['user']> | null;

interface AuthReturn {
  loginDev: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  user: AuthUser;
}

export function useAuth(): AuthReturn {
  const { setAuth, logout: storeLogout, isAuthenticated, user } = useAuthStore();

  const loginDev = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/dev-token/`, {
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

        // Decodifica payload para extrair name (sem verificar assinatura — já validado pelo backend)
        const payloadB64 = token.split('.')[1] ?? '';
        let name = email.split('@')[0] ?? email;
        try {
          const decoded = JSON.parse(atob(payloadB64)) as { name?: string };
          if (decoded.name) name = decoded.name;
        } catch {
          // mantém name do email
        }

        setAuth(
          { id: `dev-${email}`, email, name, role: 'ADMIN' },
          token,
          data.refresh,
        );
        return true;
      } catch {
        return false;
      }
    },
    [setAuth]
  );

  const logout = useCallback(async (): Promise<void> => {
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync('auth-storage');
    }
    storeLogout();
  }, [storeLogout]);

  return { loginDev, logout, isAuthenticated, user };
}
