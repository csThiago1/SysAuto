/**
 * AuthContext — DS Car ERP
 * Gerencia estado de autenticação JWT em toda a aplicação.
 * Tenta restaurar sessão via refresh token ao carregar.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { login as apiLogin, logout as apiLogout, isAuthenticated } from './api/client';

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

  // Restaura sessão ao montar — tenta refresh se houver token salvo
  useEffect(() => {
    if (isAuthenticated()) {
      // Refresh token presente — marcar como autenticado (cliente.ts vai fazer refresh no primeiro request)
      setState({ authenticated: true, loading: false, error: null });
    } else {
      setState({ authenticated: false, loading: false, error: null });
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      await apiLogin(username, password);
      setState({ authenticated: true, loading: false, error: null });
    } catch (err: any) {
      setState({ authenticated: false, loading: false, error: err.message ?? 'Usuário ou senha incorretos.' });
    }
  }, []);

  const logout = useCallback(() => {
    apiLogout();
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
