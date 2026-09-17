'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { collection, getDoc, getDocs, doc } from 'firebase/firestore';
import { Goal, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import AuthGuard from '@/components/auth-guard';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import type { Organization } from '@/lib/fut-types';
import { createOrganization, setCurrentOrg } from '@/lib/organizations';

export default function MyFutsPage() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'organizations'));
        const mine: Organization[] = [];
        for (const d of snap.docs) {
          const m = await getDoc(doc(db, 'organizations', d.id, 'members', user.uid));
          if (m.exists()) mine.push({ id: d.id, ...(d.data() as Omit<Organization, 'id'>) });
        }
        setOrgs(mine);
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
      setError(err instanceof Error ? err.message : 'Não foi possível criar o futebol.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <AuthGuard>
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <header className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Goal className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Meus futebóis</h1>
            <p className="text-sm text-muted-foreground">Escolha um futebol para entrar. Admin edita, jogador consulta.</p>
          </div>
        </header>

        {loading ? (
          <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Carregando…</p>
        ) : orgs.length === 0 ? (
          <Card className="mt-8"><CardContent className="p-6 text-sm text-muted-foreground">Você ainda não participa de nenhum futebol. Crie o primeiro abaixo.</CardContent></Card>
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
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black"><Plus className="size-5" /> Criar novo futebol do zero</CardTitle></CardHeader>
          <CardContent>
            {error ? <p className="mb-3 text-sm font-semibold text-destructive">{error}</p> : null}
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
