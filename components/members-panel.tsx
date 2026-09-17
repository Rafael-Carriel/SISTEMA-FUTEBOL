'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateGroupCode } from '@/lib/group-access';
import { Spinner } from '@/components/ui/spinner';
import type { Member, Role } from '@/lib/fut-types';
import {
  listMembers,
  removeMember,
  updateMemberRole,
} from '@/lib/members';

export function MembersPanel({ orgId, ownerId }: { orgId: string; ownerId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(await listMembers(orgId));
      const access = await getDoc(doc(db, 'organizations', orgId, 'settings', 'access'));
      setCode(access.data()?.joinCode ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar membros.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCode() {
    setSaving(true); setError(null); setOk(null);
    try {
      setCode(await generateGroupCode(orgId));
      setOk('Código válido por 7 dias. Compartilhe com a galera. O código anterior foi desativado.');
    } catch { setError('Não foi possível gerar o código. Tente novamente.'); }
    finally { setSaving(false); }
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

      <div className="space-y-3 rounded-xl border border-border p-4">
        <p className="text-sm text-muted-foreground">Compartilhe o código para entrar como jogador, com acesso de consulta. Depois, você pode promover um membro a administrador abaixo.</p>
        {code ? <p className="select-all font-mono text-xl font-bold tracking-widest">{code}</p> : null}
        <Button onClick={handleCode} disabled={saving}>{saving ? <Spinner /> : null}{code ? 'Substituir código (revoga o anterior)' : 'Gerar código de entrada'}</Button>
        <p className="text-xs text-muted-foreground">Na tela Meus futebóis, escolha Entrar com código. O cadastro no elenco é separado do acesso à conta.</p>
      </div>

      <ul className="divide-y divide-border">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{m.displayName || m.email || m.userId}</p>
              <p className="text-xs text-muted-foreground">
                {m.userId === ownerId ? 'Responsável — administrador permanente' : m.role === 'admin' ? 'Administrador — edita tudo' : 'Jogador — só consulta'}
              </p>
            </div>
            <select
              aria-label="Trocar papel"
              disabled={m.userId === ownerId}
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
              disabled={m.userId === ownerId}
              aria-label="Remover membro"
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
