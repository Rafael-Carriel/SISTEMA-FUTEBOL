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

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2Icon className="size-6 animate-spin" aria-label="Carregando" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg font-black tracking-tight">Sem acesso a este futebol</p>
        <p className="text-sm text-muted-foreground">Peça ao administrador um convite com o seu e-mail.</p>
        <button
          type="button"
          onClick={() => window.location.assign('/app')}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Meus futebóis
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

export default AuthGuard;
