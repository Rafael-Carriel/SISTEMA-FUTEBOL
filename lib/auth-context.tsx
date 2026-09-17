'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  onIdTokenChanged,
  type User,
  type IdTokenResult,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

export type AuthClaims = Record<string, unknown> | null;

export interface AuthContextValue {
  /** Currently authenticated Firebase user, or null when signed out. */
  user: User | null;
  /** True while the initial auth state / claims are being resolved. */
  loading: boolean;
  /** Custom claims from the current ID token, or null when signed out. */
  claims: AuthClaims;
  /** Whether the current user has the admin claim. */
  isAdmin: () => boolean;
  /** Whether the current user can access the given organization. */
  hasOrgAccess: (orgId: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function extractClaims(token: IdTokenResult | null): AuthClaims {
  return token ? (token.claims as Record<string, unknown>) : null;
}

function readClaimArray(claims: AuthClaims, key: string): string[] {
  if (!claims) return [];
  const value = claims[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<AuthClaims>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setClaims(null);
      }
      setLoading(false);
    });

    // onIdTokenChanged fires on sign-in, sign-out and token refresh, keeping
    // custom claims in sync after the backend updates them.
    const unsubscribeToken = onIdTokenChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setClaims(null);
        return;
      }
      try {
        const token = await nextUser.getIdTokenResult();
        setClaims(extractClaims(token));
      } catch {
        setClaims(null);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeToken();
    };
  }, []);

  const isAdmin = useCallback((): boolean => {
    if (!claims) return false;
    if (claims.admin === true) return true;
    if (claims.role === 'admin') return true;
    return readClaimArray(claims, 'roles').includes('admin');
  }, [claims]);

  const hasOrgAccess = useCallback(
    (orgId: string): boolean => {
      if (!orgId) return false;
      if (!claims) return false;
      if (isAdmin()) return true;
      if (claims.orgId === orgId) return true;
      return readClaimArray(claims, 'orgs').includes(orgId);
    },
    [claims, isAdmin],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, claims, isAdmin, hasOrgAccess }),
    [user, loading, claims, isAdmin, hasOrgAccess],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
