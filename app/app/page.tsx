'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { joinGroup } from '@/lib/group-access';
import { signOut } from 'firebase/auth';
import { Goal, LogOut, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import AuthGuard from '@/components/auth-guard';
import { useAuth } from '@/lib/auth-context';
import { auth } from '@/lib/firebase';
import type { Organization } from '@/lib/fut-types';
import { createOrganization, listMyOrganizations, setCurrentOrg } from '@/lib/organizations';

export default function MyFutsPage() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

function isPermissionError(err: unknown): boolean {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code ?? '') : '';
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return code === 'permission-denied' || /missing or insufficient permissions/i.test(msg) || /permission-denied/i.test(msg);
}


  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        setOrgs(await listMyOrganizations(user.uid));
      } catch {
        setError('Não foi possível carregar seus futebóis. Tente novamente.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setCreating(true);
    try {
      const org = await createOrganization(name, user);
      window.location.assign(`/f/${org.slug}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível criar o futebol.';
      setError(isPermissionError(err) ? 'Não foi possível criar o futebol. Tente novamente ou fale com o suporte.' : msg);
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setJoining(true);
    setJoinError(null);
    try {
      const orgId = await joinGroup(code, user);
      window.location.assign('/f/' + encodeURIComponent(orgId));
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Não foi possível entrar. Tente novamente.');
    } finally { setJoining(false); }
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
    } finally {
      window.localStorage.removeItem('na-trave:org');
      window.location.assign('/login');
    }
  }

  return (
    <AuthGuard>
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Goal className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Meus futebóis</h1>
              <p className="text-sm text-muted-foreground">Escolha um futebol para entrar. Admin edita, jogador consulta.</p>
              {user?.email ? <p className="mt-1 text-xs font-semibold text-muted-foreground">{user.email}</p> : null}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="shrink-0 gap-2">
            <LogOut className="size-4" /> Sair
          </Button>
        </header>

        {loading ? (
          <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Carregando…</p>
        ) : orgs.length === 0 ? (
          <Card className="mt-8"><CardContent className="p-6 text-sm text-muted-foreground">Você ainda não participa de nenhum futebol. Entre com o código da galera ou crie o seu abaixo.</CardContent></Card>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {orgs.map((o) => (
              <Card key={o.id} className="transition hover:-translate-y-0.5 hover:shadow-lg">
                <CardHeader><CardTitle className="text-lg font-black">{o.name}</CardTitle></CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-muted-foreground">/{o.slug || o.id}</span>
                  <Button
                    onClick={() => {
                      setCurrentOrg(o.slug || o.id);
                      window.location.assign(`/f/${o.slug || o.id}`);
                    }}
                  >
                    Entrar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="mt-8">
          <CardHeader><CardTitle>Entrar com código</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Peça o código ao administrador. Você poderá acompanhar o elenco e as estatísticas.</p>
            <form onSubmit={handleJoin} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="group-code">Código do futebol</Label>
                <Input id="group-code" placeholder="Ex.: A1B2C3D4E5F6" value={code} onChange={e => setCode(e.target.value)} disabled={joining} className="h-11 uppercase" />
              </div>
              <Button type="submit" disabled={joining || !code.trim()} className="h-11">{joining ? <Spinner /> : 'Entrar no futebol'}</Button>
            </form>
            {joinError ? <p role="alert" className="text-sm text-destructive">{joinError}</p> : null}
          </CardContent>
        </Card>
        <Card className="mt-8">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black"><Plus className="size-5" /> Criar meu futebol</CardTitle></CardHeader>
          <CardContent>
            {error ? <p className="mb-3 text-sm font-semibold text-destructive">{error}</p> : null}
            <p className="mb-3 text-sm text-muted-foreground">Você será o responsável e poderá adicionar administradores. Sua conta também pode participar de outros grupos.</p>
            <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="new-fut">Nome do futebol</Label>
                <Input id="new-fut" placeholder="Ex.: Fut das Quintas" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
              </div>
              <Button type="submit" disabled={creating || name.trim().length < 2} className="h-11">
                {creating ? <><Spinner /> Criando…</> : 'Criar e virar admin'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
}
