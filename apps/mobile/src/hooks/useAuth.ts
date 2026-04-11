import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/stores/auth.store';
import { DEV_ACCESS_CODE } from '@/lib/constants';

type AuthUser = NonNullable<ReturnType<typeof useAuthStore.getState>['user']> | null;

// Dev JWT simples — base64 fake (sem assinatura real, apenas para dev local)
function createDevToken(email: string): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: `dev-${email}`,
      email,
      role: 'ADMIN',
      active_company: 'dscar',
      tenant_schema: 'tenant_dscar',
      exp: Math.floor(Date.now() / 1000) + 86400,
    })
  );
  const signature = btoa('dev-signature');
  return `${header}.${payload}.${signature}`;
}

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
      if (password !== DEV_ACCESS_CODE) return false;
      const token = createDevToken(email);
      setAuth(
        { id: `dev-${email}`, email, name: email.split('@')[0] ?? email, role: 'ADMIN' },
        token,
        token
      );
      return true;
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
