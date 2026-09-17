'use client';

import { useEffect, type ReactNode } from 'react';
import { Loader2Icon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export interface AuthGuardProps {
  /** Content rendered once the user is authenticated (and authorized). */
  children: ReactNode;
  /**
   * Optional organization the user must belong to. When provided, access is
   * granted only if `hasOrgAccess(orgId)` returns true.
   */
  orgId?: string;
}

export function AuthGuard({ children, orgId }: AuthGuardProps) {
  const { user, loading, hasOrgAccess } = useAuth();

  const hasAccess = !orgId || (user ? hasOrgAccess(orgId) : false);
  const isAuthorized = Boolean(user) && hasAccess;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.href = '/login';
    }
  }, [loading, user]);

  if (loading || !isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2Icon className="size-6 animate-spin" aria-label="Carregando" />
      </div>
    );
  }

  return <>{children}</>;
}

export default AuthGuard;
