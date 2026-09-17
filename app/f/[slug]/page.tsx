'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { collection, getDoc, getDocs, query, where, doc } from 'firebase/firestore';
import { Goal, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import AuthGuard from '@/components/auth-guard';
import { FutApp } from '@/components/fut-app';
import { OrgSwitcher } from '@/components/org-switcher';
import { MembersPanel } from '@/components/members-panel';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import type { Match, Organization, Player } from '@/lib/fut-types';
import { getMember } from '@/lib/members';
import { setCurrentOrg } from '@/lib/organizations';

export default function FutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, isOrgAdmin } = useAuth();
  const [org, setOrg] = useState<Organization | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCurrentOrg(slug);
  }, [slug]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'organizations', slug));
        if (!snap.exists()) {
          setOrg(null);
          return;
        }
        const data = { id: snap.id, ...(snap.data() as Omit<Organization, 'id'>) };
        setOrg(data);
        const m = await getMember(slug, user.uid);
        setIsMember(Boolean(m));
        setIsAdmin(m?.role === 'admin' || isOrgAdmin(slug));
        if (m && m.role !== 'admin') {
          const [p, mt] = await Promise.all([
            getDocs(query(collection(db, 'players'), where('orgId', '==', slug))),
            getDocs(query(collection(db, 'matches'), where('orgId', '==', slug))),
          ]);
          setPlayers(p.docs.map((d) => d.data() as Player));
          setMatches(mt.docs.map((d) => d.data() as Match));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user, slug, isOrgAdmin]);

  const stats = useMemo(() => {
    const goals = new Map<string, number>();
    const assists = new Map<string, number>();
    for (const m of matches) {
      for (const e of m.events ?? []) {
        if (e.type === 'goal') {
          goals.set(e.playerId, (goals.get(e.playerId) ?? 0) + 1);
          if (e.assistPlayerId) assists.set(e.assistPlayerId, (assists.get(e.assistPlayerId) ?? 0) + 1);
        }
      }
    }
    const nameOf = (id: string) => players.find((p) => p.id === id)?.nickname || players.find((p) => p.id === id)?.name || '—';
    const top = (map: Map<string, number>) =>
      [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ id, name: nameOf(id), n }));
    return { scorers: top(goals), providers: top(assists) };
  }, [matches, players]);

  return (
    <AuthGuard>
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Goal className="size-5" /></span>
            <span className="text-lg font-black tracking-tight">Na Trave</span>
          </a>
          <OrgSwitcher />
        </header>

        {loading ? (
          <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Carregando futebol…</p>
        ) : !org ? (
          <Card className="mt-10"><CardContent className="p-6 text-sm">Futebol não encontrado.</CardContent></Card>
        ) : !isMember ? (
          <Card className="mt-10">
            <CardHeader><CardTitle>Sem acesso</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Você não está vinculado ao <b className="text-foreground">{org.name}</b>. Peça ao administrador um convite com seu e-mail.</p>
              <Button onClick={() => window.location.assign('/app')}>Meus futebóis</Button>
            </CardContent>
          </Card>
        ) : isAdmin ? (
          <main className="mt-6 space-y-6">
            <FutApp orgId={slug} />
            <MembersPanel orgId={org.id} orgName={org.name} />
          </main>
        ) : (
          <main className="mt-8 space-y-6">
            <div className="rounded-[24px] border border-line-inverse bg-surface-inverse p-6 text-ink-inverse sm:p-8">
              <p className="text-[11px] font-bold uppercase tracking-[.16em] text-primary">/{org.slug}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{org.name}</h1>
              <p className="mt-2 flex items-center gap-2 text-sm text-ink-inverse-soft">
                <Users className="size-4 text-primary" />
                Você é jogador — pode consultar escalação e estatísticas.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Escalação</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {players.length === 0 ? <p className="text-sm text-muted-foreground">Elenco vazio por enquanto.</p> : null}
                  {players.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm">
                      <span className="grid size-8 place-items-center rounded-lg bg-primary text-xs font-black text-primary-foreground">{p.number || '•'}</span>
                      <b className="flex-1 truncate">{p.nickname || p.name}</b>
                      <small className="text-muted-foreground">{p.position}</small>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Estatísticas</CardTitle></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Artilheiros</h3>
                    <ol className="mt-2 space-y-1.5 text-sm">
                      {stats.scorers.length === 0 ? <li className="text-muted-foreground">Sem gols ainda.</li> : null}
                      {stats.scorers.map((s) => (
                        <li key={s.id} className="flex justify-between gap-2"><span className="truncate font-semibold">{s.name}</span><b className="tabular-nums">{s.n}</b></li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Assistências</h3>
                    <ol className="mt-2 space-y-1.5 text-sm">
                      {stats.providers.length === 0 ? <li className="text-muted-foreground">Sem assistências ainda.</li> : null}
                      {stats.providers.map((s) => (
                        <li key={s.id} className="flex justify-between gap-2"><span className="truncate font-semibold">{s.name}</span><b className="tabular-nums">{s.n}</b></li>
                      ))}
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
                <ShieldCheck className="size-4 text-brand-ink" />
                Área de gestão visível só para administradores. Você tem acesso de consulta.
              </CardContent>
            </Card>
          </main>
        )}
      </div>
    </AuthGuard>
  );
}
