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

export type OrgRole = 'admin' | 'member';

export interface AuthContextValue {
  /** Currently authenticated Firebase user, or null when signed out. */
  user: User | null;
  /** True while the initial auth state / claims are being resolved. */
  loading: boolean;
  /** Custom claims from the current ID token, or null when signed out. */
  claims: AuthClaims;
  /** Whether the current user has the admin claim (legacy ou qualquer org). */
  isAdmin: () => boolean;
  /** Papel do usuário na org via claim organizations (null quando sem acesso). */
  orgRole: (orgId: string) => OrgRole | null;
  /** True quando admin da org (claim ou legacy global). */
  isOrgAdmin: (orgId: string) => boolean;
  /** True quando membro ou admin da org. */
  isOrgMember: (orgId: string) => boolean;
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

function readOrgMap(claims: AuthClaims): Record<string, string> {
  if (!claims) return {};
  const value = claims.organizations;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Record<string, string>;
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
    if (readClaimArray(claims, 'roles').includes('admin')) return true;
    return Object.values(readOrgMap(claims)).includes('admin');
  }, [claims]);

  const orgRole = useCallback(
    (orgId: string): OrgRole | null => {
      if (!orgId || !claims) return null;
      const role = readOrgMap(claims)[orgId];
      return role === 'admin' || role === 'member' ? role : null;
    },
    [claims],
  );

  const isOrgAdmin = useCallback(
    (orgId: string): boolean => {
      if (!orgId) return false;
      if (orgRole(orgId) === 'admin') return true;
      return false;
    },
    [orgRole],
  );

  const isOrgMember = useCallback(
    (orgId: string): boolean => {
      if (!orgId) return false;
      const role = orgRole(orgId);
      if (role === 'admin' || role === 'member') return true;
      if (claims?.orgId === orgId) return true;
      return readClaimArray(claims, 'orgs').includes(orgId);
    },
    [orgRole, claims],
  );

  const hasOrgAccess = useCallback(
    (orgId: string): boolean => isOrgMember(orgId),
    [isOrgMember],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, claims, isAdmin, orgRole, isOrgAdmin, isOrgMember, hasOrgAccess }),
    [user, loading, claims, isAdmin, orgRole, isOrgAdmin, isOrgMember, hasOrgAccess],
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
