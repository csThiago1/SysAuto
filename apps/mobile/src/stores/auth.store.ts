import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'CONSULTANT' | 'STOREKEEPER';
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  activeCompany: string;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string, refreshToken: string) => void;
  setActiveCompany: (slug: string) => void;
  logout: () => void;
}

/** Checa se um JWT já expirou (com margem de 30s). */
function isTokenExpired(token: string): boolean {
  try {
    const payloadB64 = token.split('.')[1] ?? '';
    const payload = JSON.parse(atob(payloadB64)) as { exp?: number };
    if (!payload.exp) return false;
    return Date.now() >= (payload.exp - 30) * 1000;
  } catch {
    return true;
  }
}

// Web: localStorage | Native: SecureStore (com retry para Keychain intermitente)
const secureStorage =
  Platform.OS === 'web'
    ? {
        getItem: (name: string): string | null => localStorage.getItem(name),
        setItem: (name: string, value: string): void => localStorage.setItem(name, value),
        removeItem: (name: string): void => localStorage.removeItem(name),
      }
    : {
        getItem: async (name: string): Promise<string | null> => {
          // Retry: Keychain pode não estar disponível imediatamente no cold boot
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              return await SecureStore.getItemAsync(name);
            } catch (err) {
              if (__DEV__) console.warn(`SecureStore.getItem tentativa ${attempt + 1} falhou`, err);
              if (attempt < 2) await new Promise((r) => setTimeout(r, 200));
            }
          }
          return null;
        },
        setItem: (name: string, value: string): Promise<void> =>
          SecureStore.setItemAsync(name, value),
        removeItem: (name: string): Promise<void> => SecureStore.deleteItemAsync(name),
      };

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      activeCompany: 'dscar',
      isAuthenticated: false,
      setAuth: (user, token, refreshToken) =>
        set({ user, token, refreshToken, isAuthenticated: true }),
      setActiveCompany: (slug) => set({ activeCompany: slug }),
      logout: () =>
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => secureStorage),
      onRehydrateStorage: () => (state) => {
        // Invalida token expirado que ficou no Keychain entre rebuilds
        if (state?.token && isTokenExpired(state.token)) {
          if (__DEV__) console.info('Token expirado detectado na hidratação — limpando sessão');
          state.logout();
        }
      },
    }
  )
);
