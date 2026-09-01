'use client';

import { useEffect, useMemo, useState } from 'react';
import { arrayUnion, collection, doc, getDocs, increment, onSnapshot, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { Activity, BadgeDollarSign, CalendarDays, Camera, Check, ChevronRight, CircleDollarSign, Goal, ImageDown, LayoutDashboard, Medal, Menu, Plus, Save, Shield, ShieldCheck, Shirt, Sparkles, Swords, Target, Trophy, UserPlus, Users, WalletCards, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase';
import { demoMatches, demoPayments, demoPlayers } from '@/lib/demo-data';
import type { Match, MatchEvent, Payment, Player, PlayerStats, Position } from '@/lib/fut-types';
import { PitchView } from '@/components/pitch-view';
import { balancedTeamsSmart, getTeamBalanceInfo } from '@/lib/team-balancer';

/* ─── constants & helpers ─── */
type View = 'dashboard' | 'matches' | 'players' | 'rankings' | 'payments' | 'arts';
type DialogName = 'player' | 'match' | 'event' | 'playerCard' | null;
type RankingTab = 'goals' | 'assists' | 'saves' | 'wins';
const monthKey = '2026-09';
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const navItems: { id: View; label: string; short: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Visão geral', short: 'Início', icon: LayoutDashboard },
  { id: 'matches', label: 'Partidas', short: 'Jogos', icon: CalendarDays },
  { id: 'players', label: 'Jogadores', short: 'Elenco', icon: Users },
  { id: 'rankings', label: 'Rankings', short: 'Ranking', icon: Trophy },
  { id: 'payments', label: 'Mensalidades', short: 'Mensal', icon: CircleDollarSign },
  { id: 'arts', label: 'Artes', short: 'Artes', icon: Sparkles },
];
const viewTitles: Record<View, [string, string, string]> = {
  dashboard: ['Hoje tem fut', 'Noite de jogo', 'Tudo que está rolando no fut, em um só lugar.'],
  matches: ['Agenda e súmulas', 'Partidas', 'Monte os times, acompanhe o placar e registre cada lance.'],
  players: ['Nosso elenco', 'Jogadores', 'Cartinhas, posições e evolução de todo mundo.'],
  rankings: ['Quem está voando', 'Rankings', 'Artilharia, assistências, defesas e resultados.'],
  payments: ['Caixa do fut', 'Mensalidades', 'Veja rapidamente quem está em dia e quem ficou pendente.'],
  arts: ['Pronto para o grupo', 'Gerador de artes', 'Crie o destaque do mês e baixe a imagem pronta.'],
};

function initials(player?: Player) { return player ? (player.nickname || player.name).split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase() : '?'; }
function calcOverall(player: Player) { return Math.round((player.pace + player.shooting + player.passing + player.defending + player.physical) / 5); }
function formatDate(value: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`)); }

function calculateStats(players: Player[], matches: Match[]): PlayerStats[] {
  return players.map((player) => {
    let goals = 0, assists = 0, saves = 0, appearances = 0, wins = 0, draws = 0, losses = 0;
    for (const match of matches) {
      const team = match.teamA.includes(player.id) ? 'A' : match.teamB.includes(player.id) ? 'B' : null;
      if (!team) continue;
      appearances++;
      for (const event of match.events || []) {
        if (event.type === 'goal' && event.playerId === player.id) goals++;
        if (event.type === 'goal' && event.assistPlayerId === player.id) assists++;
        if (event.type === 'save' && event.playerId === player.id) saves++;
      }
      if (match.status !== 'finished') continue;
      if (match.scoreA === match.scoreB) draws++;
      else if ((team === 'A' && match.scoreA > match.scoreB) || (team === 'B' && match.scoreB > match.scoreA)) wins++;
      else losses++;
    }
    return { player, goals, assists, saves, appearances, wins, draws, losses, overall: calcOverall(player) };
  });
}

/* ─── shared UI components ─── */
function PlayerAvatar({ player, size = 'md' }: { player?: Player; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizes = { sm: 'size-8 text-[9px]', md: 'size-11 text-xs', lg: 'size-14 text-sm', xl: 'size-24 text-2xl' };
  return <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary font-black text-primary-foreground ${sizes[size]}`}>{player?.photoUrl ? <img src={player.photoUrl} alt="" className="h-full w-full object-cover" /> : initials(player)}</span>;
}
function StatPill({ value, label }: { value: number; label: string }) { return <div className="rounded-2xl bg-muted p-3"><p className="text-xl font-black tabular-nums">{value}</p><p className="stat-label">{label}</p></div>; }
function Metric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) { return <div className="metric-card"><Icon /><div><p>{label}</p><strong>{value}</strong></div></div>; }

/* ═══════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════ */
export function FutApp() {
  const [view, setView] = useState<View>('dashboard');
  const [players, setPlayers] = useState<Player[]>(demoPlayers);
  const [matches, setMatches] = useState<Match[]>(demoMatches);
  const [payments, setPayments] = useState<Payment[]>(demoPayments);
  const [connection, setConnection] = useState<'connecting' | 'online' | 'demo'>('connecting');
  const [dialog, setDialog] = useState<DialogName>(null);
  const [activeMatchId, setActiveMatchId] = useState(demoMatches[0].id);
  const [activePlayerId, setActivePlayerId] = useState(demoPlayers[0].id);
  const [notice, setNotice] = useState('');
  const [playerForm, setPlayerForm] = useState({ name: '', nickname: '', number: '10', position: 'ATA' as Position, photoUrl: '' });
  const [matchForm, setMatchForm] = useState({ title: 'Fut das quintas', venue: 'Arena Gol de Placa', date: '2026-09-03', time: '21:00', selected: demoPlayers.map((p) => p.id) });
  const [eventForm, setEventForm] = useState({ type: 'goal' as 'goal' | 'save', team: 'A' as 'A' | 'B', playerId: demoPlayers[0].id, assistPlayerId: '', minute: '1' });
  const [artType, setArtType] = useState<'artilheiro' | 'assistente' | 'paredao' | 'craque'>('artilheiro');
  const [artPlayerId, setArtPlayerId] = useState(demoPlayers[0].id);
  const [artPhotoUrl, setArtPhotoUrl] = useState('');
  const [rankingTab, setRankingTab] = useState<RankingTab>('goals');
  const [previewTeams, setPreviewTeams] = useState<{ teamA: string[]; teamB: string[] } | null>(null);

  /* ─── Firebase realtime ─── */
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];
    let cancelled = false;
    async function connect() {
      try {
        const snapshot = await getDocs(collection(db, 'players'));
        if (snapshot.empty) {
          const batch = writeBatch(db);
          demoPlayers.forEach((item) => batch.set(doc(db, 'players', item.id), item));
          demoMatches.forEach((item) => batch.set(doc(db, 'matches', item.id), item));
          demoPayments.forEach((item) => batch.set(doc(db, 'payments', item.id), item));
          await batch.commit();
        }
        if (cancelled) return;
        unsubscribers.push(
          onSnapshot(collection(db, 'players'), (snap) => { setPlayers(snap.docs.map((item) => ({ ...item.data(), id: item.id }) as Player).sort((a, b) => a.nickname.localeCompare(b.nickname))); setConnection('online'); }),
          onSnapshot(collection(db, 'matches'), (snap) => setMatches(snap.docs.map((item) => ({ ...item.data(), id: item.id }) as Match).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)))),
          onSnapshot(collection(db, 'payments'), (snap) => setPayments(snap.docs.map((item) => ({ ...item.data(), id: item.id }) as Payment))),
        );
      } catch { if (!cancelled) setConnection('demo'); }
    }
    connect();
    return () => { cancelled = true; unsubscribers.forEach((unsubscribe) => unsubscribe()); };
  }, []);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 2800); return () => window.clearTimeout(timer); }, [notice]);

  /* ─── derived state ─── */
  const stats = useMemo(() => calculateStats(players, matches), [players, matches]);
  const activeMatch = matches.find((match) => match.id === activeMatchId) || matches[0];
  const activePlayerStats = stats.find((item) => item.player.id === activePlayerId) || stats[0];
  const liveMatch = matches.find((match) => match.status === 'live');
  const paidPayments = payments.filter((payment) => payment.month === monthKey && payment.paid);
  const monthlyRevenue = paidPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const leaderboard = [...stats].sort((a, b) => b.goals - a.goals || b.assists - a.assists);
  const playerById = (id?: string) => players.find((player) => player.id === id);
  const showNotice = (message: string) => setNotice(message);

  /* ─── match preview teams (for dialog) ─── */
  const previewTeamAPlayers = useMemo(() => {
    const ids = previewTeams?.teamA ?? [];
    return ids.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  }, [previewTeams, players]);
  const previewTeamBPlayers = useMemo(() => {
    const ids = previewTeams?.teamB ?? [];
    return ids.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  }, [previewTeams, players]);
  const previewBalance = useMemo(() => {
    if (!previewTeamAPlayers.length || !previewTeamBPlayers.length) return null;
    return getTeamBalanceInfo(previewTeamAPlayers, previewTeamBPlayers);
  }, [previewTeamAPlayers, previewTeamBPlayers]);

  function previewDraft() {
    if (matchForm.selected.length < 2) { showNotice('Selecione pelo menos 2 jogadores.'); return; }
    setPreviewTeams(balancedTeamsSmart(matchForm.selected, (id) => playerById(id)));
  }

  /* ─── CRUD operations ─── */
  async function savePlayer() {
    if (!playerForm.name.trim()) return showNotice('Digite o nome do jogador.');
    const id = crypto.randomUUID(), nickname = playerForm.nickname.trim() || playerForm.name.trim().split(' ')[0];
    const player: Player = { id, name: playerForm.name.trim(), nickname, number: Number(playerForm.number) || 0, position: playerForm.position, photoUrl: playerForm.photoUrl || undefined, pace: 70, shooting: playerForm.position === 'ATA' ? 75 : 65, passing: playerForm.position === 'MEI' ? 75 : 68, defending: ['GOL', 'ZAG'].includes(playerForm.position) ? 78 : 58, physical: 70, createdAt: new Date().toISOString() };
    try { await setDoc(doc(db, 'players', id), player); await setDoc(doc(db, 'payments', `${monthKey}_${id}`), { id: `${monthKey}_${id}`, playerId: id, month: monthKey, amount: 40, paid: false }); } catch { setPlayers((all) => [...all, player]); }
    setDialog(null); setPlayerForm({ name: '', nickname: '', number: '10', position: 'ATA', photoUrl: '' }); showNotice(`${nickname} entrou para o elenco.`);
  }

  async function saveMatch() {
    if (matchForm.selected.length < 2) return showNotice('Selecione pelo menos dois jogadores.');
    const id = crypto.randomUUID();
    const teams = balancedTeamsSmart(matchForm.selected, (id) => playerById(id));
    const match: Match = { id, title: matchForm.title || 'Fut da galera', venue: matchForm.venue, date: matchForm.date, time: matchForm.time, status: 'scheduled', teamAName: 'Time Verde', teamBName: 'Time Branco', teamA: teams.teamA, teamB: teams.teamB, scoreA: 0, scoreB: 0, events: [], createdAt: new Date().toISOString() };
    try { await setDoc(doc(db, 'matches', id), match); } catch { setMatches((all) => [match, ...all]); }
    setActiveMatchId(id); setDialog(null); setPreviewTeams(null); setView('matches'); showNotice('Partida criada com times equilibrados.');
  }

  async function changeMatchStatus(match: Match, status: Match['status']) {
    try { await updateDoc(doc(db, 'matches', match.id), { status }); } catch { setMatches((all) => all.map((item) => item.id === match.id ? { ...item, status } : item)); }
    showNotice(status === 'live' ? 'Partida iniciada. Bom jogo!' : 'Súmula finalizada e rankings atualizados.');
  }

  function openEvent(match: Match, type: 'goal' | 'save') { setActiveMatchId(match.id); setEventForm({ type, team: 'A', playerId: match.teamA[0] || '', assistPlayerId: '', minute: String((match.events?.length || 0) + 1) }); setDialog('event'); }

  async function saveEvent() {
    if (!activeMatch || !eventForm.playerId) return;
    const event: MatchEvent = { id: crypto.randomUUID(), type: eventForm.type, playerId: eventForm.playerId, assistPlayerId: eventForm.type === 'goal' && eventForm.assistPlayerId ? eventForm.assistPlayerId : undefined, team: eventForm.team, minute: Number(eventForm.minute) || 1, createdAt: new Date().toISOString() };
    const scoreField = event.team === 'A' ? 'scoreA' : 'scoreB';
    try { await updateDoc(doc(db, 'matches', activeMatch.id), { events: arrayUnion(event), ...(event.type === 'goal' ? { [scoreField]: increment(1) } : {}) }); }
    catch { setMatches((all) => all.map((match) => match.id === activeMatch.id ? { ...match, events: [...match.events, event], scoreA: match.scoreA + (event.type === 'goal' && event.team === 'A' ? 1 : 0), scoreB: match.scoreB + (event.type === 'goal' && event.team === 'B' ? 1 : 0) } : match)); }
    setDialog(null); showNotice(event.type === 'goal' ? 'Gol registrado!' : 'Defesa registrada!');
  }

  async function togglePayment(player: Player) {
    const id = `${monthKey}_${player.id}`, current = payments.find((item) => item.id === id);
    const next: Payment = { id, playerId: player.id, month: monthKey, amount: current?.amount || 40, paid: !current?.paid, paidAt: !current?.paid ? new Date().toISOString() : undefined };
    try { await setDoc(doc(db, 'payments', id), next); } catch { /* demonstração */ }
    setPayments((all) => [...all.filter((item) => item.id !== id), next]); showNotice(next.paid ? `${player.nickname} está em dia.` : `${player.nickname} ficou pendente.`);
  }

  async function updateRating(player: Player, field: 'pace' | 'shooting' | 'passing' | 'defending' | 'physical', value: number) {
    const updated = { ...player, [field]: value }; setPlayers((all) => all.map((item) => item.id === player.id ? updated : item));
    try { await updateDoc(doc(db, 'players', player.id), { [field]: value }); } catch { /* demonstração */ }
  }

  /* ─── photo handling ─── */
  function handlePhoto(file?: File) {
    if (!file) return;
    if (file.size > 600_000) return showNotice('Use uma foto menor que 600 KB.');
    if (!file.type.startsWith('image/')) return showNotice('Envie um arquivo de imagem.');
    const reader = new FileReader();
    reader.onload = () => setPlayerForm((form) => ({ ...form, photoUrl: String(reader.result || '') }));
    reader.readAsDataURL(file);
  }

  function handleArtPhoto(file?: File) {
    if (!file) return;
    if (file.size > 600_000) return showNotice('Use uma foto menor que 600 KB.');
    if (!file.type.startsWith('image/')) return showNotice('Envie um arquivo de imagem.');
    const reader = new FileReader();
    reader.onload = () => setArtPhotoUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  /* ─── art export with cover crop ─── */
  async function exportArt() {
    const selected = stats.find((item) => item.player.id === artPlayerId) || stats[0];
    if (!selected) return;

    const labels = {
      artilheiro: ['ARTILHEIRO DO MÊS', `${selected.goals} GOLS`],
      assistente: ['GARÇOM DO MÊS', `${selected.assists} ASSISTÊNCIAS`],
      paredao: ['PAREDÃO DO MÊS', `${selected.saves} DEFESAS`],
      craque: ['CRAQUE DO MÊS', `OVERALL ${selected.overall}`],
    } as const;
    const [headline, result] = labels[artType];
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
    gradient.addColorStop(0, '#07100b');
    gradient.addColorStop(1, '#14271a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1350);

    // Green triangle accent
    ctx.fillStyle = '#baff55';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(440, 0);
    ctx.lineTo(0, 410);
    ctx.closePath();
    ctx.fill();

    // Text
    ctx.fillStyle = '#baff55';
    ctx.font = '900 40px Arial';
    ctx.fillText('NA TRAVE', 70, 82);

    ctx.fillStyle = '#fff';
    ctx.font = '900 70px Arial';
    ctx.fillText(headline, 70, 610);

    ctx.fillStyle = '#baff55';
    ctx.font = '900 118px Arial';
    ctx.fillText(selected.player.nickname.toUpperCase(), 70, 755);

    ctx.fillStyle = '#fff';
    ctx.font = '900 70px Arial';
    ctx.fillText(result, 70, 860);

    ctx.fillStyle = 'rgba(255,255,255,.65)';
    ctx.font = '700 30px Arial';
    ctx.fillText('FUT DAS QUINTAS  ·  SETEMBRO 2026', 70, 1260);

    // Border
    ctx.strokeStyle = '#baff55';
    ctx.lineWidth = 8;
    ctx.strokeRect(32, 32, 1016, 1286);

    // Photo circle background
    ctx.fillStyle = '#243829';
    ctx.beginPath();
    ctx.arc(810, 310, 205, 0, Math.PI * 2);
    ctx.fill();

    // Use artPhotoUrl (device) or player's saved photo
    const photoSrc = artPhotoUrl || selected.player.photoUrl;
    const fallbackInitials = () => {
      ctx.fillStyle = '#baff55';
      ctx.font = '900 118px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials(selected.player), 810, 310);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    };

    if (photoSrc) {
      await new Promise<void>((resolve) => {
        const image = new Image();
        image.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(810, 310, 190, 0, Math.PI * 2);
          ctx.clip();
          // Cover crop: center the image in the circle
          const size = 380;
          const imgAspect = image.width / image.height;
          let sx = 0, sy = 0, sw = image.width, sh = image.height;
          if (imgAspect > 1) { sx = (image.width - image.height) / 2; sw = image.height; }
          else { sy = (image.height - image.width) / 2; sh = image.width; }
          ctx.drawImage(image, sx, sy, sw, sh, 620, 120, size, size);
          ctx.restore();
          resolve();
        };
        image.onerror = () => { fallbackInitials(); resolve(); };
        image.src = photoSrc;
      });
    } else {
      fallbackInitials();
    }

    const link = document.createElement('a');
    link.download = `${headline.toLowerCase().replaceAll(' ', '-')}-${selected.player.nickname.toLowerCase()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showNotice('Arte baixada e pronta para o grupo.');
  }

  /* ═══════════════════════════════════════════
     VIEWS
     ═══════════════════════════════════════════ */

  const dashboard = () => {
    const match = liveMatch || matches[0];
    return <>{match && <ScoreCard match={match} players={players} onOpen={() => { setActiveMatchId(match.id); setView('matches'); }} />}<div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.8fr]"><section className="panel"><div className="section-heading"><div><p className="eyebrow-muted">Setembro</p><h3>Artilharia do mês</h3></div><Medal className="size-5 text-primary" /></div><div className="mt-4 space-y-1">{leaderboard.slice(0, 4).map((item, index) => <button key={item.player.id} onClick={() => { setActivePlayerId(item.player.id); setDialog('playerCard'); }} className="rank-row"><span className="w-5 text-center text-xs font-black text-muted-foreground">{index + 1}</span><PlayerAvatar player={item.player} /><div className="min-w-0 flex-1"><p className="truncate font-extrabold">{item.player.nickname}</p><p className="text-xs text-muted-foreground">{item.appearances} jogos · {item.assists} assist.</p></div><div className="text-right"><p className="text-xl font-black">{item.goals}</p><p className="stat-label">gols</p></div></button>)}</div></section><section className="panel"><div className="section-heading"><div><p className="eyebrow-muted">Caixa de setembro</p><h3>{money.format(monthlyRevenue)}</h3></div><WalletCards className="size-5 text-primary" /></div><div className="mt-5 rounded-2xl bg-muted p-4"><div className="mb-3 flex justify-between text-xs font-bold"><span>{paidPayments.length} em dia</span><span className="text-muted-foreground">{players.length - paidPayments.length} pendentes</span></div><div className="h-2 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary" style={{ width: `${players.length ? paidPayments.length / players.length * 100 : 0}%` }} /></div></div><Button onClick={() => setView('payments')} className="mt-4 h-10 w-full rounded-xl font-extrabold" variant="outline">Ver mensalidades <ChevronRight className="size-4" /></Button></section></div></>;
  };

  /* ─── MATCHES VIEW (with PitchView) ─── */
  const matchesView = () => <div className="space-y-5">{matches.map((match) => {
    const teamAPlayers = match.teamA.map((id) => playerById(id)).filter(Boolean) as Player[];
    const teamBPlayers = match.teamB.map((id) => playerById(id)).filter(Boolean) as Player[];
    return (
      <section key={match.id} className={`panel ${match.status === 'live' ? 'ring-2 ring-primary/50' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><span className={`status-dot ${match.status}`} /><p className="eyebrow-muted">{match.status === 'live' ? 'Ao vivo' : match.status === 'finished' ? 'Encerrado' : 'Agendado'}</p></div>
            <h3 className="mt-1 text-lg font-black">{match.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{formatDate(match.date)} · {match.time} · {match.venue}</p>
          </div>
          {match.status === 'scheduled' ? <Button onClick={() => changeMatchStatus(match, 'live')}><Swords /> Iniciar</Button> : match.status === 'live' ? <Button variant="outline" onClick={() => changeMatchStatus(match, 'finished')}><Check /> Encerrar</Button> : null}
        </div>
        <div className="match-score">
          <TeamSummary name={match.teamAName} ids={match.teamA} players={players} align="right" />
          <strong>{match.scoreA}<i>—</i>{match.scoreB}</strong>
          <TeamSummary name={match.teamBName} ids={match.teamB} players={players} align="left" />
        </div>
        {/* Pitch visualization */}
        {teamAPlayers.length > 0 && teamBPlayers.length > 0 && (
          <div className="mt-4">
            <PitchView
              teamA={teamAPlayers}
              teamB={teamBPlayers}
              teamAName={match.teamAName}
              teamBName={match.teamBName}
              compact={match.status !== 'finished'}
            />
          </div>
        )}
        {match.status === 'live' && <div className="mt-4 grid gap-2 sm:grid-cols-2"><Button onClick={() => openEvent(match, 'goal')} className="h-11"><Goal /> Marcar gol</Button><Button onClick={() => openEvent(match, 'save')} variant="outline" className="h-11"><ShieldCheck /> Marcar defesa</Button></div>}
        {match.events.length > 0 && <div className="mt-5 border-t pt-4"><p className="eyebrow-muted mb-3">Últimos lances</p><div className="grid gap-2 sm:grid-cols-2">{[...match.events].reverse().slice(0, 6).map((event) => <div key={event.id} className="event-row"><span>{event.type === 'goal' ? '⚽' : '🧤'}</span><b>{playerById(event.playerId)?.nickname}{event.assistPlayerId ? ` · assistência ${playerById(event.assistPlayerId)?.nickname}` : ''}</b><small>{event.minute}&apos;</small></div>)}</div></div>}
      </section>
    );
  })}</div>;

  /* ─── PLAYERS VIEW ─── */
  const playersView = () => <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[...stats].sort((a, b) => b.overall - a.overall).map((item) => <button key={item.player.id} onClick={() => { setActivePlayerId(item.player.id); setDialog('playerCard'); }} className="player-card"><div className="player-card-head"><PlayerAvatar player={item.player} size="lg" /><div className="min-w-0 flex-1"><p>{item.player.position} · camisa {item.player.number}</p><h3>{item.player.nickname}</h3><small>{item.player.name}</small></div><div className="overall">{item.overall}<small>OVR</small></div></div><div className="grid grid-cols-4 gap-2 p-4"><StatPill value={item.goals} label="Gols" /><StatPill value={item.assists} label="Assist." /><StatPill value={item.wins} label="Vitórias" /><StatPill value={item.appearances} label="Jogos" /></div></button>)}</div>;

  /* ─── RANKINGS VIEW (SofaScore style) ─── */
  const rankingSections: { title: string; key: RankingTab; suffix: string; icon: typeof Target; extra?: string }[] = [
    { title: 'Artilheiros', key: 'goals', suffix: 'gols', icon: Target },
    { title: 'Assistências', key: 'assists', suffix: 'assist.', icon: Activity },
    { title: 'Paredões', key: 'saves', suffix: 'defesas', icon: ShieldCheck },
    { title: 'Mais vitórias', key: 'wins', suffix: 'vitórias', icon: Trophy },
  ];
  const rankingsView = () => {
    const sorted = [...stats].sort((a, b) => b[rankingTab] - a[rankingTab]);
    const top3 = sorted.slice(0, 3);
    const rest = sorted.slice(3, 8);
    const leaderVal = sorted[0]?.[rankingTab] || 1;
    const activeSection = rankingSections.find((s) => s.key === rankingTab)!;

    return (
      <div className="space-y-5">
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {rankingSections.map((section) => (
            <button
              key={section.key}
              onClick={() => setRankingTab(section.key)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-extrabold transition-all ${rankingTab === section.key ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              <section.icon className="size-4" />
              {section.title}
            </button>
          ))}
        </div>

        {/* Podium Top 3 */}
        {top3.length >= 3 && (
          <div className="panel overflow-hidden p-0">
            <div className="bg-gradient-to-br from-[#0b1710] to-[#14271a] p-6">
              <div className="flex items-end justify-center gap-4">
                {/* 2nd place */}
                <PodiumCard stat={top3[1]} rank={2} medal="🥈" height="h-28" onClick={(id) => { setActivePlayerId(id); setDialog('playerCard'); }} />
                {/* 1st place */}
                <PodiumCard stat={top3[0]} rank={1} medal="🥇" height="h-36" onClick={(id) => { setActivePlayerId(id); setDialog('playerCard'); }} />
                {/* 3rd place */}
                <PodiumCard stat={top3[2]} rank={3} medal="🥉" height="h-24" onClick={(id) => { setActivePlayerId(id); setDialog('playerCard'); }} />
              </div>
            </div>
            <div className="p-4">
              <div className="section-heading mb-3">
                <h3 className="text-sm">Demais posições</h3>
                <activeSection.icon className="size-4 text-primary" />
              </div>
              <div className="space-y-1">
                {rest.map((item, i) => (
                  <button key={item.player.id} onClick={() => { setActivePlayerId(item.player.id); setDialog('playerCard'); }} className="rank-row group">
                    <span className="rank-number">{i + 4}</span>
                    <PlayerAvatar player={item.player} size="sm" />
                    <div className="min-w-0 flex-1">
                      <b className="truncate">{item.player.nickname}</b>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${leaderVal > 0 ? (item[rankingTab] / leaderVal) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <strong>{item[rankingTab]} <small>{activeSection.suffix}</small></strong>
                  </button>
                ))}
                {rest.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Apenas um jogador nos rankings.</p>}
              </div>
            </div>
          </div>
        )}

        {/* Fallback for < 3 players */}
        {top3.length < 3 && (
          <section className="panel">
            <div className="section-heading"><h3>{activeSection.title}</h3><activeSection.icon className="size-5 text-primary" /></div>
            <div className="mt-4 space-y-1">
              {sorted.map((item, index) => (
                <button key={item.player.id} onClick={() => { setActivePlayerId(item.player.id); setDialog('playerCard'); }} className="rank-row">
                  <span className={`rank-number ${index === 0 ? 'top' : ''}`}>{index + 1}</span>
                  <PlayerAvatar player={item.player} size="sm" />
                  <b className="min-w-0 flex-1 truncate">{item.player.nickname}</b>
                  <strong>{item[rankingTab]} <small>{activeSection.suffix}</small></strong>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Participações extra card */}
        <section className="panel">
          <div className="section-heading">
            <div>
              <h3>Participações</h3>
              <p className="text-xs text-muted-foreground">Gols + Assistências</p>
            </div>
            <Trophy className="size-5 text-primary" />
          </div>
          <div className="mt-4 space-y-1">
            {[...stats].sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists)).slice(0, 5).map((item, index) => (
              <button key={item.player.id} onClick={() => { setActivePlayerId(item.player.id); setDialog('playerCard'); }} className="rank-row">
                <span className={`rank-number ${index === 0 ? 'top' : ''}`}>{index + 1}</span>
                <PlayerAvatar player={item.player} size="sm" />
                <b className="min-w-0 flex-1 truncate">{item.player.nickname}</b>
                <strong>{item.goals + item.assists} <small>partic.</small></strong>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  };

  /* ─── PAYMENTS VIEW ─── */
  const paymentsView = () => <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-3"><Metric icon={BadgeDollarSign} label="Recebido" value={money.format(monthlyRevenue)} /><Metric icon={WalletCards} label="Previsto" value={money.format(players.length * 40)} /><Metric icon={Users} label="Em dia" value={`${paidPayments.length}/${players.length}`} /></div><section className="panel overflow-hidden p-0"><div className="flex items-center justify-between border-b p-5"><div><p className="eyebrow-muted">Setembro 2026</p><h3 className="mt-1 text-lg font-black">Controle de pagamentos</h3></div><span className="rounded-full bg-muted px-3 py-1.5 text-xs font-bold">R$ 40 / jogador</span></div><div className="divide-y">{players.map((player) => { const payment = payments.find((item) => item.id === `${monthKey}_${player.id}`); return <div key={player.id} className="flex items-center gap-3 px-5 py-3"><PlayerAvatar player={player} /><div className="min-w-0 flex-1"><b>{player.nickname}</b><p className="text-xs text-muted-foreground">{payment?.paid ? 'Pagamento confirmado' : 'Pagamento pendente'}</p></div><button onClick={() => togglePayment(player)} className={`payment ${payment?.paid ? 'paid' : 'pending'}`}>{payment?.paid ? <Check /> : <X />}{payment?.paid ? 'Em dia' : 'Pendente'}</button></div>; })}</div></section></div>;

  /* ─── ARTS VIEW (with device photo picker) ─── */
  const artStats = stats.find((item) => item.player.id === artPlayerId) || stats[0];
  const artLabel = artType === 'artilheiro' ? ['ARTILHEIRO DO MÊS', `${artStats?.goals || 0} GOLS`] : artType === 'assistente' ? ['GARÇOM DO MÊS', `${artStats?.assists || 0} ASSISTÊNCIAS`] : artType === 'paredao' ? ['PAREDÃO DO MÊS', `${artStats?.saves || 0} DEFESAS`] : ['CRAQUE DO MÊS', `OVERALL ${artStats?.overall || 0}`];
  const previewPhotoSrc = artPhotoUrl || artStats?.player.photoUrl;

  const artsView = () => <div className="grid gap-5 xl:grid-cols-[.78fr_1.22fr]"><section className="panel h-fit"><h3 className="text-lg font-black">Personalize a arte</h3><p className="mt-1 text-sm text-muted-foreground">Escolha o destaque e baixe em PNG.</p><label className="form-label mt-5">Tipo<select value={artType} onChange={(e) => setArtType(e.target.value as typeof artType)} className="form-control"><option value="artilheiro">Artilheiro do mês</option><option value="assistente">Maior assistente</option><option value="paredao">Paredão do mês</option><option value="craque">Craque do mês</option></select></label><label className="form-label mt-4">Jogador<select value={artPlayerId} onChange={(e) => { setArtPlayerId(e.target.value); setArtPhotoUrl(''); }} className="form-control">{players.map((player) => <option key={player.id} value={player.id}>{player.nickname}</option>)}</select></label>
    <div className="mt-4"><p className="form-label mb-2">Foto do dispositivo</p>{previewPhotoSrc ? <div className="flex items-center gap-3"><div className="size-14 overflow-hidden rounded-xl border-2 border-primary"><img src={previewPhotoSrc} alt="" className="h-full w-full object-cover" /></div><div className="flex-1"><p className="text-xs font-bold text-muted-foreground">Foto carregada</p><button onClick={() => setArtPhotoUrl('')} className="mt-1 text-xs font-bold text-red-500 hover:underline">Remover</button></div></div> : <label className="form-control flex items-center gap-2 cursor-pointer"><Camera className="size-4" />Escolher foto do dispositivo<input type="file" accept="image/*" className="hidden" onChange={(e) => handleArtPhoto(e.target.files?.[0])} /></label>}</div>
    <Button onClick={exportArt} className="mt-5 h-11 w-full"><ImageDown /> Baixar arte pronta</Button></section>
    <div className="mx-auto w-full max-w-[620px]"><div className="art-preview"><div className="art-brand"><b>NA TRAVE</b><span>Setembro 2026</span></div><div className="art-avatar">{previewPhotoSrc ? <img src={previewPhotoSrc} alt="" /> : initials(artStats?.player)}</div><div className="art-copy"><p>{artLabel[0]}</p><h3>{artStats?.player.nickname.toUpperCase()}</h3><strong>{artLabel[1]}</strong></div><footer>Fut das quintas · Irati</footer></div></div></div>;

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */
  const title = viewTitles[view];
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {/* Sidebar */}
        <aside className="sidebar">
          <button onClick={() => setView('dashboard')} className="brand"><span><Shield /></span><div><small>Fut das quintas</small><b>NA TRAVE</b></div></button>
          <nav>{navItems.map((item) => <button key={item.id} onClick={() => setView(item.id)} className={view === item.id ? 'active' : ''}><item.icon />{item.label}</button>)}</nav>
          <div className="cash-card">
            <p><i className={connection} />{connection === 'online' ? 'Firebase conectado' : connection === 'connecting' ? 'Conectando' : 'Modo demonstração'}</p>
            <strong>{money.format(monthlyRevenue)}</strong>
            <small>{paidPayments.length} de {players.length} mensalistas em dia</small>
            <div><i style={{ width: `${players.length ? paidPayments.length / players.length * 100 : 0}%` }} /></div>
          </div>
        </aside>

        {/* Main */}
        <section className="min-w-0 flex-1 pb-24 lg:pb-0">
          <header className="topbar">
            <div>
              <button aria-label="Menu"><Menu /></button>
              <span><small>Terça-feira, 1 de setembro</small><b>{navItems.find((item) => item.id === view)?.label}</b></span>
            </div>
            <div>
              {view === 'players' && <Button variant="outline" onClick={() => setDialog('player')}><UserPlus /><span>Novo jogador</span></Button>}
              <Button onClick={() => { setMatchForm((form) => ({ ...form, selected: players.map((player) => player.id) })); setPreviewTeams(null); setDialog('match'); }}><Plus /><span>Nova partida</span></Button>
            </div>
          </header>

          <div className="mx-auto max-w-[1180px] p-4 md:p-8">
            <div className="page-heading"><small>{title[0]}</small><h1>{title[1]}</h1><p>{title[2]}</p></div>
            {view === 'dashboard' && dashboard()}
            {view === 'matches' && matchesView()}
            {view === 'players' && playersView()}
            {view === 'rankings' && rankingsView()}
            {view === 'payments' && paymentsView()}
            {view === 'arts' && artsView()}
          </div>
        </section>
      </div>

      {/* Mobile nav */}
      <nav className="mobile-nav">{navItems.map((item) => <button key={item.id} onClick={() => setView(item.id)} className={view === item.id ? 'active' : ''}><item.icon />{item.short}</button>)}</nav>

      {/* Notice toast */}
      {notice && <div className="notice"><Sparkles />{notice}</div>}

      {/* ─── DIALOGS ─── */}

      {/* Player dialog */}
      <Dialog open={dialog === 'player'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Novo jogador</DialogTitle><DialogDescription>A cartinha será criada automaticamente.</DialogDescription></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="form-label sm:col-span-2">Nome completo<Input value={playerForm.name} onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })} className="form-control" placeholder="Matheus Oliveira" /></label>
            <label className="form-label">Apelido<Input value={playerForm.nickname} onChange={(e) => setPlayerForm({ ...playerForm, nickname: e.target.value })} className="form-control" /></label>
            <label className="form-label">Número<Input type="number" value={playerForm.number} onChange={(e) => setPlayerForm({ ...playerForm, number: e.target.value })} className="form-control" /></label>
            <label className="form-label">Posição<select value={playerForm.position} onChange={(e) => setPlayerForm({ ...playerForm, position: e.target.value as Position })} className="form-control"><option>GOL</option><option>ZAG</option><option>MEI</option><option>ATA</option></select></label>
            <label className="form-label">Foto opcional
              {playerForm.photoUrl ? (
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="size-14 overflow-hidden rounded-xl border-2 border-primary"><img src={playerForm.photoUrl} alt="" className="h-full w-full object-cover" /></div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-muted-foreground">Foto escolhida</p>
                    <button type="button" onClick={() => setPlayerForm((f) => ({ ...f, photoUrl: '' }))} className="mt-1 text-xs font-bold text-red-500 hover:underline">Remover</button>
                  </div>
                </div>
              ) : (
                <span className="form-control flex items-center gap-2"><Camera />Escolher foto<input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0])} /></span>
              )}
            </label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button><Button onClick={savePlayer}><Save /> Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Match dialog (with balance preview) */}
      <Dialog open={dialog === 'match'} onOpenChange={(open) => { if (!open) { setDialog(null); setPreviewTeams(null); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Nova partida</DialogTitle><DialogDescription>Selecione os confirmados; o sorteio inteligente equilibra por atributos.</DialogDescription></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="form-label sm:col-span-2">Nome<Input value={matchForm.title} onChange={(e) => setMatchForm({ ...matchForm, title: e.target.value })} className="form-control" /></label>
            <label className="form-label sm:col-span-2">Local<Input value={matchForm.venue} onChange={(e) => setMatchForm({ ...matchForm, venue: e.target.value })} className="form-control" /></label>
            <label className="form-label">Data<Input type="date" value={matchForm.date} onChange={(e) => setMatchForm({ ...matchForm, date: e.target.value })} className="form-control" /></label>
            <label className="form-label">Horário<Input type="time" value={matchForm.time} onChange={(e) => setMatchForm({ ...matchForm, time: e.target.value })} className="form-control" /></label>
            <div className="sm:col-span-2">
              <p className="form-label mb-2">Escalação · {matchForm.selected.length} confirmados</p>
              <div className="roster">{players.map((player) => { const checked = matchForm.selected.includes(player.id); return <button key={player.id} onClick={() => { setPreviewTeams(null); setMatchForm((form) => ({ ...form, selected: checked ? form.selected.filter((id) => id !== player.id) : [...form.selected, player.id] })); }} className={checked ? 'checked' : ''}><i>{checked && <Check />}</i><PlayerAvatar player={player} size="sm" /><b>{player.nickname}</b><small>{calcOverall(player)}</small></button>; })}</div>
            </div>
          </div>

          {/* Balance preview */}
          <div className="sm:col-span-2">
            {!previewTeams ? (
              <Button variant="outline" onClick={previewDraft} className="w-full h-11 mt-2"><Swords /> Visualizar sortecio</Button>
            ) : (
              <div className="mt-3 rounded-2xl border border-border bg-muted/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Preview do sorteio</p>
                  <button onClick={() => setPreviewTeams(null)} className="text-xs font-bold text-muted-foreground hover:text-foreground"><X className="inline size-3" /> Limpar</button>
                </div>
                <PitchView
                  teamA={previewTeamAPlayers}
                  teamB={previewTeamBPlayers}
                  teamAName="Time Verde"
                  teamBName="Time Branco"
                  compact
                />
                {previewBalance && (
                  <div className="mt-3 text-center">
                    <div className="mx-auto mb-1 h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-border">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${previewBalance.percentage}%` }} />
                    </div>
                    <p className={`text-xs font-extrabold ${previewBalance.color}`}>{previewBalance.percentage}% — {previewBalance.label}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialog(null); setPreviewTeams(null); }}>Cancelar</Button>
            <Button onClick={saveMatch}><Swords /> Montar times</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event dialog */}
      <Dialog open={dialog === 'event'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{eventForm.type === 'goal' ? 'Registrar gol' : 'Registrar defesa'}</DialogTitle><DialogDescription>O lance atualiza a súmula e os rankings.</DialogDescription></DialogHeader>
          {activeMatch && <div className="space-y-4">
            <label className="form-label">Time<select value={eventForm.team} onChange={(e) => { const team = e.target.value as 'A' | 'B'; setEventForm({ ...eventForm, team, playerId: (team === 'A' ? activeMatch.teamA : activeMatch.teamB)[0] || '', assistPlayerId: '' }); }} className="form-control"><option value="A">{activeMatch.teamAName}</option><option value="B">{activeMatch.teamBName}</option></select></label>
            <label className="form-label">Jogador<select value={eventForm.playerId} onChange={(e) => setEventForm({ ...eventForm, playerId: e.target.value })} className="form-control">{(eventForm.team === 'A' ? activeMatch.teamA : activeMatch.teamB).map((id) => <option key={id} value={id}>{playerById(id)?.nickname}</option>)}</select></label>
            {eventForm.type === 'goal' && <label className="form-label">Assistência<select value={eventForm.assistPlayerId} onChange={(e) => setEventForm({ ...eventForm, assistPlayerId: e.target.value })} className="form-control"><option value="">Sem assistência</option>{(eventForm.team === 'A' ? activeMatch.teamA : activeMatch.teamB).filter((id) => id !== eventForm.playerId).map((id) => <option key={id} value={id}>{playerById(id)?.nickname}</option>)}</select></label>}
            <label className="form-label">Minuto<Input type="number" value={eventForm.minute} onChange={(e) => setEventForm({ ...eventForm, minute: e.target.value })} className="form-control" /></label>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button><Button onClick={saveEvent}>Registrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Player card dialog */}
      <Dialog open={dialog === 'playerCard'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">{activePlayerStats && <>
          <DialogHeader><DialogTitle>Cartinha do jogador</DialogTitle><DialogDescription>Ajuste os atributos para montar o overall.</DialogDescription></DialogHeader>
          <div className="big-player-card"><PlayerAvatar player={activePlayerStats.player} size="xl" /><div><small>{activePlayerStats.player.position} · camisa {activePlayerStats.player.number}</small><h3>{activePlayerStats.player.nickname}</h3><p>{activePlayerStats.player.name}</p></div><strong>{activePlayerStats.overall}<small>OVERALL</small></strong></div>
          <div className="space-y-3">{([['pace', 'Velocidade'], ['shooting', 'Finalização'], ['passing', 'Passe'], ['defending', 'Defesa'], ['physical', 'Físico']] as const).map(([field, label]) => <label key={field} className="rating"><span>{label}</span><input type="range" min="1" max="99" value={activePlayerStats.player[field]} onChange={(e) => updateRating(activePlayerStats.player, field, Number(e.target.value))} /><b>{activePlayerStats.player[field]}</b></label>)}</div>
          <DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Fechar</Button><Button onClick={() => { setArtPlayerId(activePlayerStats.player.id); setArtPhotoUrl(''); setDialog(null); setView('arts'); }}><Sparkles /> Criar arte</Button></DialogFooter>
        </>}</DialogContent>
      </Dialog>
    </main>
  );
}

/* ═══════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════ */

function TeamSummary({ name, ids, players, align }: { name: string; ids: string[]; players: Player[]; align: 'left' | 'right' }) {
  const list = ids.map((id) => players.find((player) => player.id === id)).filter(Boolean) as Player[];
  return <div className={`min-w-0 ${align === 'right' ? 'text-right' : ''}`}><p className="truncate text-sm font-black uppercase sm:text-base">{name}</p><small className="hidden truncate text-white/40 sm:block">{list.map((player) => player.nickname).join(' · ')}</small></div>;
}

function ScoreCard({ match, players, onOpen }: { match: Match; players: Player[]; onOpen: () => void }) {
  return <section className="score-card"><div className="score-top"><span>{match.status === 'live' ? 'Ao vivo' : 'Próximo jogo'}</span><small>{match.status === 'live' ? `${match.events.length + 32} min` : `${formatDate(match.date)} · ${match.time}`}</small><i>{match.venue}</i></div><div className="score-main"><div><TeamSummary name={match.teamAName} ids={match.teamA} players={players} align="right" /><span className="green"><Shirt /></span></div><strong>{match.scoreA}<i>—</i>{match.scoreB}</strong><div><span><Shirt /></span><TeamSummary name={match.teamBName} ids={match.teamB} players={players} align="left" /></div></div><div className="score-bottom"><div>{[...match.teamA, ...match.teamB].slice(0, 5).map((id) => <PlayerAvatar key={id} player={players.find((player) => player.id === id)} size="sm" />)}</div><Button onClick={onOpen}>Abrir súmula <ChevronRight /></Button></div></section>;
}

function PodiumCard({ stat, rank, medal, height, onClick }: { stat: PlayerStats; rank: number; medal: string; height: string; onClick: (id: string) => void }) {
  return (
    <button onClick={() => onClick(stat.player.id)} className={`flex flex-col items-center gap-2 ${rank === 1 ? 'order-2' : rank === 2 ? 'order-1' : 'order-3'}`}>
      <div className="relative">
        <PlayerAvatar player={stat.player} size="lg" />
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-2xl">{medal}</span>
      </div>
      <p className="max-w-[90px] truncate text-xs font-black text-white">{stat.player.nickname}</p>
      <p className="text-2xl font-black tabular-nums text-primary">{stat.overall}</p>
      <div className={`w-16 rounded-t-lg bg-white/10 ${height}`} />
    </button>
  );
}
