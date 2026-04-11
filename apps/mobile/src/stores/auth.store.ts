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

// Web: localStorage | Native: SecureStore
const secureStorage =
  Platform.OS === 'web'
    ? {
        getItem: (name: string): string | null => localStorage.getItem(name),
        setItem: (name: string, value: string): void => localStorage.setItem(name, value),
        removeItem: (name: string): void => localStorage.removeItem(name),
      }
    : {
        getItem: (name: string): Promise<string | null> => SecureStore.getItemAsync(name),
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
    }
  )
);
