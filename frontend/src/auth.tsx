/**
 * Auth context for Lexis.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, loadAuth, setAuth as persistAuth, clearAuth } from './api';

export type User = { id: string; email: string; name: string };

type Ctx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { token, user: u } = await loadAuth();
      if (token && u) {
        try {
          const fresh = await api.me();
          setUser(fresh);
        } catch {
          await clearAuth();
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res: any = await api.login(email, password);
    await persistAuth(res.token, res.user);
    setUser(res.user);
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const res: any = await api.signup(email, password, name);
    await persistAuth(res.token, res.user);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await clearAuth();
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
