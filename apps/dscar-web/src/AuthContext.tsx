/**
 * AuthContext — DS Car ERP
 * Gerencia estado de autenticação JWT em toda a aplicação.
 * Tenta restaurar sessão via refresh token ao carregar.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { login as apiLogin, logout as apiLogout, isAuthenticated } from './api/client';

// Em modo mock, autenticação é local (sem backend)
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA !== 'false';
const MOCK_AUTH_KEY = 'dscar_mock_auth';

interface AuthState {
  authenticated: boolean;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    authenticated: false,
    loading: true,
    error: null,
  });

  // Restaura sessão ao montar
  useEffect(() => {
    if (USE_MOCK_DATA) {
      const saved = localStorage.getItem(MOCK_AUTH_KEY) === 'true';
      setState({ authenticated: saved, loading: false, error: null });
    } else if (isAuthenticated()) {
      setState({ authenticated: true, loading: false, error: null });
    } else {
      setState({ authenticated: false, loading: false, error: null });
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setState(s => ({ ...s, loading: true, error: null }));

    if (USE_MOCK_DATA) {
      // Credenciais mock: qualquer usuário não-vazio com senha "dscar"
      if (username.trim() && password === 'dscar') {
        localStorage.setItem(MOCK_AUTH_KEY, 'true');
        setState({ authenticated: true, loading: false, error: null });
      } else {
        setState({ authenticated: false, loading: false, error: 'Senha incorreta. Em modo demo use: dscar' });
      }
      return;
    }

    try {
      await apiLogin(username, password);
      setState({ authenticated: true, loading: false, error: null });
    } catch (err: any) {
      setState({ authenticated: false, loading: false, error: err.message ?? 'Usuário ou senha incorretos.' });
    }
  }, []);

  const logout = useCallback(() => {
    if (USE_MOCK_DATA) {
      localStorage.removeItem(MOCK_AUTH_KEY);
    } else {
      apiLogout();
    }
    setState({ authenticated: false, loading: false, error: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
