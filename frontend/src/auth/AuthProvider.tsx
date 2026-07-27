import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMe, googleSignInUrl, logout as apiLogout } from '../api';
import type { SessionUser } from '../types';

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  signInUrl: string;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // A single GET /auth/me on mount — it always resolves to 200, so this never
    // blocks anonymous use even when Google sign-in is unconfigured (D4).
    getMe()
      .then((result) => {
        if (!cancelled) {
          setUser(result);
        }
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

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signInUrl: googleSignInUrl(window.location.pathname),
      logout,
    }),
    [user, loading, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
