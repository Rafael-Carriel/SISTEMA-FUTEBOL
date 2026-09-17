'use client';

import { useEffect, type ReactNode } from 'react';
import { Loader2Icon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export interface AuthGuardProps {
  /** Content rendered once the user is authenticated (and authorized). */
  children: ReactNode;
  /**
   * Optional organization the user must belong to. When provided, access is
   * granted only if the role check passes.
   */
  orgId?: string;
  /** Papel mínimo na org: member lê, admin escreve. Padrão: member. */
  requiredRole?: 'admin' | 'member';
}

export function AuthGuard({ children, orgId, requiredRole = 'member' }: AuthGuardProps) {
  const { user, loading, isOrgAdmin, isOrgMember } = useAuth();

  const hasAccess =
    !orgId || !user
      ? Boolean(user)
      : requiredRole === 'admin'
        ? isOrgAdmin(orgId)
        : isOrgMember(orgId);
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
