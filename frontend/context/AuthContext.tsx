'use client';

import {
  createContext, useContext, useState, useCallback,
  type ReactNode,
} from 'react';
import { authApi } from '@/services/api/authApi';

export interface Usuario {
  id:      number;
  usuario: string;
}

interface AuthContextValue {
  usuario:     Usuario | null;
  isLoggedIn:  boolean;
  login:       (usuario: string, contrasena: string) => Promise<void>;
  registro:    (usuario: string, contrasena: string) => Promise<void>;
  logout:      () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface ApiError {
  response?: { data?: { error?: string } };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const login = useCallback(async (usr: string, pwd: string) => {
    const res = await authApi.login({ usuario: usr, contrasena: pwd });
    setUsuario(res.data.usuario);
    localStorage.setItem('lb_user', JSON.stringify(res.data.usuario));
  }, []);

  const registro = useCallback(async (usr: string, pwd: string) => {
    await authApi.registro({ usuario: usr, contrasena: pwd });
  }, []);

  const logout = useCallback(() => {
    setUsuario(null);
    localStorage.removeItem('lb_user');
  }, []);

  return (
    <AuthContext.Provider value={{
      usuario,
      isLoggedIn: !!usuario,
      login,
      registro,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}