/* =============================================================
 * Contexto de autenticación (useAuth).
 * -------------------------------------------------------------
 * Al iniciar, si hay token se verifica con GET /auth/me. Mientras
 * verifica, el estado es "loading" (no se muestra deslogueado en falso).
 * ============================================================= */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import * as authApi from '@/api/auth';
import { ApiError } from '@/api/client';
import { getToken } from '@/api/token';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  loading: boolean;
  isAuthenticated: boolean;
  user: authApi.AuthUser | null;
  profile: authApi.AuthProfile | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<authApi.AuthUser | null>(null);
  const [profile, setProfile] = useState<authApi.AuthProfile | null>(null);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setProfile(null);
      setStatus('unauthenticated');
      return;
    }
    try {
      const me = await authApi.getMe();
      setUser(me.user);
      setProfile(me.profile);
      setStatus('authenticated');
    } catch (err) {
      // 401 (u otro fallo de sesión): limpiar estado. El client ya borró token.
      setUser(null);
      setProfile(null);
      setStatus('unauthenticated');
      if (!(err instanceof ApiError)) throw err;
    }
  }, []);

  // Verificación inicial de sesión.
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      await authApi.login(email, password);
      await refreshUser();
    },
    [refreshUser],
  );

  const register = useCallback(
    async (email: string, password: string, username: string) => {
      await authApi.register(email, password, username);
    },
    [],
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setProfile(null);
    setStatus('unauthenticated');
  }, []);

  const value: AuthContextValue = {
    status,
    loading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    user,
    profile,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
