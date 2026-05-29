'use client';

import {
  createContext, useContext, useState, useEffect, useCallback,
  type ReactNode,
} from 'react';
import { authApi } from '@/services/api/authApi';

export interface Usuario {
  id:     number;
  email:  string;
  nombre: string;
  role:   string;
}

interface AuthContextValue {
  usuario:     Usuario | null;
  isLoggedIn:  boolean;
  isLoading:   boolean;
  login:       (email: string, contrasena: string) => Promise<void>;
  registro:    (email: string, contrasena: string, nombre?: string) => Promise<void>;
  logout:      () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario]   = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Al montar — verificar token guardado
  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('lb_token');
      if (!token) { setIsLoading(false); return; }

      try {
        const res = await authApi.me(token);
        setUsuario(res.data.usuario);
      } catch {
        // Token inválido o expirado — limpiar
        localStorage.removeItem('lb_token');
        localStorage.removeItem('lb_user');
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = useCallback(async (email: string, pwd: string) => {
    const res = await authApi.login({ email, contrasena: pwd });
    const { token, usuario: user } = res.data;
    localStorage.setItem('lb_token', token);
    localStorage.setItem('lb_user', JSON.stringify(user));
    setUsuario(user);
  }, []);

  const registro = useCallback(async (email: string, pwd: string, nombre?: string) => {
    const res = await authApi.registro({ email, contrasena: pwd, nombre });
    const { token, usuario: user } = res.data;
    localStorage.setItem('lb_token', token);
    localStorage.setItem('lb_user', JSON.stringify(user));
    setUsuario(user);
  }, []);

  const logout = useCallback(() => {
    setUsuario(null);
    localStorage.removeItem('lb_token');
    localStorage.removeItem('lb_user');
  }, []);

  return (
    <AuthContext.Provider value={{
      usuario,
      isLoggedIn: !!usuario,
      isLoading,
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