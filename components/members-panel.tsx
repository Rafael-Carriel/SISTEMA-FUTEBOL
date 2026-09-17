'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import type { Member, Role } from '@/lib/fut-types';
import {
  inviteMember,
  listMembers,
  removeMember,
  updateMemberRole,
} from '@/lib/members';

export function MembersPanel({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(await listMembers(orgId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar membros.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setSaving(true);
    try {
      await inviteMember(orgId, orgName, email, role);
      setEmail('');
      setOk(`Convite ${role === 'admin' ? 'de administrador' : 'de jogador'} criado para ${email.trim()}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível convidar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Carregando membros…
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <header className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-brand-ink" />
        <h2 className="text-lg font-black tracking-tight">Administradores e jogadores</h2>
      </header>
      {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
      {ok ? <p className="text-sm font-semibold text-brand-ink">{ok}</p> : null}

      <form onSubmit={handleInvite} className="grid gap-3 sm:grid-cols-[1fr_150px_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">E-mail do convite</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="jogador@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-role">Papel</Label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-semibold"
          >
            <option value="member">Jogador (só vê)</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={saving || !email.trim()} className="h-10">
            {saving ? <Spinner /> : <UserPlus className="size-4" />}
            Convidar
          </Button>
        </div>
      </form>

      <ul className="divide-y divide-border">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{m.displayName || m.email || m.userId}</p>
              <p className="text-xs text-muted-foreground">
                {m.role === 'admin' ? 'Administrador — edita tudo' : 'Jogador — só consulta'}
              </p>
            </div>
            <select
              aria-label="Trocar papel"
              value={m.role}
              onChange={async (e) => {
                setError(null);
                try {
                  await updateMemberRole(orgId, m.userId, e.target.value as Role);
                  await refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Não foi possível trocar o papel.');
                }
              }}
              className="h-9 rounded-lg border border-input bg-background px-2 text-xs font-semibold"
            >
              <option value="member">Jogador</option>
              <option value="admin">Admin</option>
            </select>
            <Button
              variant="ghost"
              size="lg"
              className="h-9 px-2 text-destructive"
              onClick={async () => {
                if (!confirm('Remover este membro?')) return;
                setError(null);
                try {
                  await removeMember(orgId, m.userId);
                  await refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Não foi possível remover.');
                }
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum membro ainda.</p>
      ) : null}
    </section>
  );
}
