import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  clearAuthToken,
  fetchMeRequest,
  getAuthToken,
  loginRequest,
  registerUnauthorizedHandler,
  setAuthToken,
} from '../services/api';
import type { PublicUser } from '../types';

interface AuthContextValue {
  user: PublicUser | null;
  token: string | null;
  loading: boolean;
  login(email: string, senha: string): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(() => getAuthToken());
  const [loading, setLoading] = useState<boolean>(() => Boolean(getAuthToken()));

  const logout = useCallback(() => {
    clearAuthToken();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(logout);
    return () => {
      registerUnauthorizedHandler(null);
    };
  }, [logout]);

  useEffect(() => {
    const storedToken = getAuthToken();
    if (!storedToken) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    fetchMeRequest()
      .then((res) => {
        if (cancelled) return;
        setToken(storedToken);
        setUser(res.user);
      })
      .catch(() => {
        if (cancelled) return;
        clearAuthToken();
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    const res = await loginRequest(email, senha);
    setAuthToken(res.token);
    setToken(res.token);
    setUser(res.user);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser utilizado dentro de AuthProvider.');
  }
  return ctx;
}
