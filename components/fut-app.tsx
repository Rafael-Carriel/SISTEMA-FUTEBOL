'use client';

import { useEffect, useMemo, useState } from 'react';
import { arrayUnion, collection, deleteDoc, doc, getDocs, increment, onSnapshot, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { Activity, BadgeDollarSign, CalendarDays, Camera, Check, ChevronRight, CircleDollarSign, Download, Goal, ImageDown, LayoutDashboard, Medal, Menu, Plus, Save, Shield, ShieldCheck, Shirt, Sparkles, Swords, Target, Trophy, UserPlus, Users, WalletCards, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase';
import { demoMatches, demoPayments, demoPlayers } from '@/lib/demo-data';
import type { FieldPositions, Match, MatchEvent, MatchEventType, MatchFormat, Payment, Player, PlayerStats, Position } from '@/lib/fut-types';
import { PitchView } from '@/components/pitch-view';
import { DraggablePitch } from '@/components/draggable-pitch';
import { LiveManager } from '@/components/live-manager';
import { balancedTeamsSmart, getTeamBalanceInfo, uniqueLineupPlayers } from '@/lib/team-balancer';
import { exportLineup } from '@/lib/lineup-export';

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

const FORMAT_OPTIONS: { value: MatchFormat; label: string; players: number }[] = [
  { value: 'F5', label: 'Futsal (5)', players: 5 },
  { value: 'F7', label: 'Fut7 (7)', players: 7 },
  { value: 'F11', label: 'Campo (11)', players: 11 },
];

function initials(player?: Player) { return player ? (player.nickname || player.name).split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase() : '?'; }
function calcOverall(player: Player) { return Math.round((player.pace + player.shooting + player.passing + player.defending + player.physical) / 5); }
function formatDate(value: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`)); }

function dedupePlayerRecords(records: Player[]): Player[] {
  const seenIds = new Set<string>();
  const seenPeople = new Set<string>();
  return records.filter((player) => {
    const identity = `${(player.nickname || player.name).trim().toLocaleLowerCase('pt-BR')}|${player.number}`;
    if (seenIds.has(player.id) || seenPeople.has(identity)) return false;
    seenIds.add(player.id);
    seenPeople.add(identity);
    return true;
  });
}

function normalizeMatchTeams(match: Match): Match {
  const teamA = [...new Set(match.teamA)];
  const used = new Set(teamA);
  const teamB = [...new Set(match.teamB)].filter((id) => !used.has(id));
  return { ...match, teamA, teamB };
}

function calculateStats(players: Player[], matches: Match[]): PlayerStats[] {
  return players.map((player) => {
    let goals = 0, assists = 0, saves = 0, appearances = 0, wins = 0, draws = 0, losses = 0;
    for (const match of matches) {
      const team = match.teamA.includes(player.id) ? 'A' : match.teamB.includes(player.id) ? 'B' : null;
      if (!team) continue;
      appearances++;
      for (const event of match.events || []) {
        if (event.type === 'goal' && !event.isOwnGoal && event.playerId === player.id) goals++;
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
  return <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary font-black text-primary-foreground antialiased ${sizes[size]}`}>{player?.photoUrl ? <img src={player.photoUrl} alt="" className="h-full w-full object-cover" /> : initials(player)}</span>;
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
  const [matchForm, setMatchForm] = useState({ title: 'Fut das quintas', venue: 'Arena Gol de Placa', date: '2026-09-03', time: '21:00', selected: demoPlayers.map((p) => p.id), format: 'F7' as MatchFormat });
  const [eventForm, setEventForm] = useState({ type: 'goal' as MatchEventType, team: 'A' as 'A' | 'B', playerId: demoPlayers[0].id, assistPlayerId: '', minute: '1' });
  const [artType, setArtType] = useState<'artilheiro' | 'assistente' | 'paredao' | 'craque'>('artilheiro');
  const [artPlayerId, setArtPlayerId] = useState(demoPlayers[0].id);
  const [artPhotoUrl, setArtPhotoUrl] = useState('');
  const [rankingTab, setRankingTab] = useState<RankingTab>('goals');
  const [previewTeams, setPreviewTeams] = useState<{ teamA: string[]; teamB: string[] } | null>(null);
  const [dragPositions, setDragPositions] = useState<FieldPositions>({});
  const [showLiveManager, setShowLiveManager] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png');
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [isDrawingTeams, setIsDrawingTeams] = useState(false);

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
          onSnapshot(collection(db, 'players'), (snap) => { setPlayers(dedupePlayerRecords(snap.docs.map((item) => ({ ...item.data(), id: item.id }) as Player)).sort((a, b) => a.nickname.localeCompare(b.nickname))); setConnection('online'); }),
          onSnapshot(collection(db, 'matches'), (snap) => setMatches(snap.docs.map((item) => normalizeMatchTeams(({ ...item.data(), id: item.id }) as Match)).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)))),
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

  const selectedFormat = FORMAT_OPTIONS.find((f) => f.value === matchForm.format) || FORMAT_OPTIONS[1];
  const idealPerTeam = selectedFormat.players;
  const totalSelected = matchForm.selected.length;
  const playersShort = totalSelected < idealPerTeam * 2;

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
    const uniqueIds = uniqueLineupPlayers(matchForm.selected, (id) => playerById(id)).map((player) => player.id);
    setMatchForm((form) => ({ ...form, selected: uniqueIds }));
    setIsDrawingTeams(true);
    setPreviewTeams(null);
    setDragPositions({});
    window.setTimeout(() => {
      setPreviewTeams(balancedTeamsSmart(uniqueIds, (id) => playerById(id)));
      setIsDrawingTeams(false);
    }, 720);
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
    
    if (editingMatchId) {
      // Edit mode - update existing match
      const teams = balancedTeamsSmart(matchForm.selected, (id) => playerById(id));
      const hasPositions = Object.keys(dragPositions).length > 0;
      const update: Partial<Match> = {
        title: matchForm.title || 'Fut da galera',
        venue: matchForm.venue,
        date: matchForm.date,
        time: matchForm.time,
        format: matchForm.format,
        teamA: teams.teamA,
        teamB: teams.teamB,
        fieldPositions: hasPositions ? dragPositions : undefined,
      };
      try { await updateDoc(doc(db, 'matches', editingMatchId), update); } catch { setMatches((all) => all.map((m) => m.id === editingMatchId ? { ...m, ...update } : m)); }
      setDialog(null); setPreviewTeams(null); setDragPositions({}); setEditingMatchId(null); showNotice('Partida atualizada.');
    } else {
      // Create mode - new match
      const id = crypto.randomUUID();
      const teams = balancedTeamsSmart(matchForm.selected, (id) => playerById(id));
      const hasPositions = Object.keys(dragPositions).length > 0;
      const match: Match = {
        id, title: matchForm.title || 'Fut da galera', venue: matchForm.venue, date: matchForm.date, time: matchForm.time,
        status: 'scheduled', teamAName: 'Time Verde', teamBName: 'Time Branco',
        teamA: teams.teamA, teamB: teams.teamB, scoreA: 0, scoreB: 0, events: [],
        createdAt: new Date().toISOString(),
        format: matchForm.format,
        fieldPositions: hasPositions ? dragPositions : undefined,
      };
      try { await setDoc(doc(db, 'matches', id), match); } catch { setMatches((all) => [match, ...all]); }
      setActiveMatchId(id); setDialog(null); setPreviewTeams(null); setDragPositions({}); setView('matches'); showNotice('Partida criada com times equilibrados.');
    }
  }

  function openEditMatch(match: Match) {
    const allPlayerIds = [...new Set([...match.teamA, ...match.teamB])];
    setMatchForm({
      title: match.title,
      venue: match.venue,
      date: match.date,
      time: match.time,
      selected: allPlayerIds,
      format: match.format || 'F7',
    });
    setPreviewTeams({ teamA: match.teamA, teamB: match.teamB });
    setDragPositions(match.fieldPositions || {});
    setEditingMatchId(match.id);
    setDialog('match');
  }

  async function deleteMatch(match: Match) {
    const isLive = match.status === 'live';
    const confirmMessage = isLive
      ? 'Partida ao vivo será perdida permanentemente. Tem certeza?'
      : 'Tem certeza que deseja excluir esta partida?';
    if (!window.confirm(confirmMessage)) return;
    
    try { await deleteDoc(doc(db, 'matches', match.id)); } catch { setMatches((all) => all.filter((m) => m.id !== match.id)); }
    setMatches((all) => all.filter((m) => m.id !== match.id));
    if (activeMatchId === match.id) {
      const remaining = matches.filter((m) => m.id !== match.id);
      setActiveMatchId(remaining[0]?.id || '');
    }
    showNotice('Partida excluída.');
  }

  async function changeMatchStatus(match: Match, status: Match['status']) {
    const update: Partial<Match> = { status };
    if (status === 'live') update.startedAt = new Date().toISOString();
    try { await updateDoc(doc(db, 'matches', match.id), update); } catch { setMatches((all) => all.map((item) => item.id === match.id ? { ...item, ...update } : item)); }
    showNotice(status === 'live' ? 'Partida iniciada. Bom jogo!' : 'Súmula finalizada e rankings atualizados.');
  }

  function openEvent(match: Match, type: MatchEventType) {
    setActiveMatchId(match.id);
    setEventForm({ type, team: 'A', playerId: match.teamA[0] || '', assistPlayerId: '', minute: String((match.events?.length || 0) + 1) });
    setDialog('event');
  }

  async function saveEvent() {
    if (!activeMatch || !eventForm.playerId) return;
    const event: MatchEvent = {
      id: crypto.randomUUID(), type: eventForm.type, playerId: eventForm.playerId,
      assistPlayerId: eventForm.type === 'goal' && eventForm.assistPlayerId ? eventForm.assistPlayerId : undefined,
      team: eventForm.team, minute: Number(eventForm.minute) || 1, createdAt: new Date().toISOString(),
    };
    const isGoal = event.type === 'goal' && !event.isOwnGoal;
    const scoreField = event.team === 'A' ? 'scoreA' : 'scoreB';
    try { await updateDoc(doc(db, 'matches', activeMatch.id), { events: arrayUnion(event), ...(isGoal ? { [scoreField]: increment(1) } : {}) }); }
    catch { setMatches((all) => all.map((match) => match.id === activeMatch.id ? { ...match, events: [...match.events, event], scoreA: match.scoreA + (isGoal && event.team === 'A' ? 1 : 0), scoreB: match.scoreB + (isGoal && event.team === 'B' ? 1 : 0) } : match)); }
    setDialog(null); showNotice(isGoal ? 'Gol registrado!' : event.type === 'save' ? 'Defesa registrada!' : `${event.type} registrado!`);
  }

  /* ─── Live manager handlers ─── */
  function handleLiveAddEvent(evt: Omit<MatchEvent, 'id' | 'createdAt'>) {
    const event: MatchEvent = { ...evt, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    const isGoal = event.type === 'goal';
    const scoreField = event.team === 'A' ? 'scoreA' : 'scoreB';
    try { updateDoc(doc(db, 'matches', activeMatchId), { events: arrayUnion(event), ...(isGoal ? { [scoreField]: increment(1) } : {}) }); } catch { /* offline fallback */ }
    setMatches((all) => all.map((match) => match.id === activeMatchId ? { ...match, events: [...match.events, event], scoreA: match.scoreA + (isGoal && event.team === 'A' ? 1 : 0), scoreB: match.scoreB + (isGoal && event.team === 'B' ? 1 : 0) } : match));
  }

  function handleLiveRemoveEvent(eventId: string) {
    const match = matches.find((m) => m.id === activeMatchId);
    if (!match) return;
    const event = match.events.find((e) => e.id === eventId);
    if (!event) return;
    const isGoal = event.type === 'goal';
    const scoreField = event.team === 'A' ? 'scoreA' : 'scoreB';
    const newEvents = match.events.filter((e) => e.id !== eventId);
    try { updateDoc(doc(db, 'matches', activeMatchId), { events: newEvents, ...(isGoal ? { [scoreField]: increment(-1) } : {}) }); } catch { /* offline fallback */ }
    setMatches((all) => all.map((m) => m.id === activeMatchId ? { ...m, events: newEvents, scoreA: m.scoreA + (isGoal && event.team === 'A' ? -1 : 0), scoreB: m.scoreB + (isGoal && event.team === 'B' ? -1 : 0) } : m));
  }

  function handleLiveFinish() {
    changeMatchStatus(matches.find((m) => m.id === activeMatchId)!, 'finished');
    setShowLiveManager(false);
  }

  /* ─── Export lineup ─── */
  async function handleExportLineup(match: Match) {
    await exportLineup(match, players, { format: exportFormat });
    showNotice('Escalação exportada!');
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

  /* ─── PREMIUM DASHBOARD ─── */
  const dashboard = () => {
    const match = liveMatch || matches[0];
    const topScorers = [...stats].sort((a, b) => b.goals - a.goals).slice(0, 3);
    return (
      <div className="space-y-5">
        {/* Hero Live Match Card */}
        {match && (
          <section
            className="relative overflow-hidden rounded-[28px] border border-white/10 p-6 sm:p-8"
            style={{
              background: match.status === 'live'
                ? 'linear-gradient(135deg, #0b1710 0%, #14271a 50%, #1a3d26 100%)'
                : 'linear-gradient(135deg, #0b1710 0%, #14271a 100%)',
            }}
          >
            {match.status === 'live' && (
              <div className="absolute -right-8 -top-8 size-64 rounded-full bg-primary/10 blur-3xl" />
            )}
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {match.status === 'live' ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                      <span className="size-1.5 animate-pulse rounded-full bg-white" />
                      AO VIVO
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/50">
                      {match.status === 'finished' ? 'Encerrado' : 'Próximo jogo'}
                    </span>
                  )}
                  {match.format && (
                    <span className="rounded-full bg-primary/20 px-2.5 py-1 text-[10px] font-black text-primary">
                      {match.format}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { setActiveMatchId(match.id); setView('matches'); }}
                  className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:bg-white/15 hover:text-white"
                >
                  Abrir súmula →
                </button>
              </div>

              {/* Giant Score */}
              <div className="my-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
                <div className="text-right">
                  <p className="text-xs font-black uppercase tracking-wider text-white/40">{match.teamAName}</p>
                </div>
                <div className="flex items-center gap-3 text-7xl font-black tabular-nums tracking-tighter text-white antialiased sm:text-8xl">
                  <span>{match.scoreA}</span>
                  <span className="text-white/15">—</span>
                  <span>{match.scoreB}</span>
                </div>
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-wider text-white/40">{match.teamBName}</p>
                </div>
              </div>

              {/* Info row */}
              <div className="flex items-center justify-between text-xs text-white/40">
                <span>{formatDate(match.date)} · {match.time}</span>
                <span>{match.venue}</span>
                {match.status === 'live' && (
                  <span className="font-mono text-primary">{match.events?.length || 0} lances</span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Bento Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Artilharia */}
          <section className="panel sm:col-span-1">
            <div className="section-heading">
              <div>
                <p className="eyebrow-muted">Setembro</p>
                <h3>Artilharia</h3>
              </div>
              <Medal className="size-5 text-primary" />
            </div>
            <div className="mt-4 flex gap-3">
              {topScorers.map((item, index) => (
                <button
                  key={item.player.id}
                  onClick={() => { setActivePlayerId(item.player.id); setDialog('playerCard'); }}
                  className="flex flex-1 flex-col items-center gap-2 rounded-2xl bg-muted/50 p-3 transition hover:bg-muted"
                >
                  <span className="text-lg">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                  <PlayerAvatar player={item.player} size="md" />
                  <p className="truncate text-xs font-black">{item.player.nickname}</p>
                  <p className="text-xl font-black tabular-nums text-primary">{item.goals}</p>
                  <p className="stat-label">gols</p>
                </button>
              ))}
              {topScorers.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">Nenhum gol registrado ainda.</p>
              )}
            </div>
          </section>

          {/* Caixa */}
          <section className="panel sm:col-span-1">
            <div className="section-heading">
              <div>
                <p className="eyebrow-muted">Caixa de setembro</p>
                <h3>{money.format(monthlyRevenue)}</h3>
              </div>
              <WalletCards className="size-5 text-primary" />
            </div>
            <div className="mt-5 rounded-2xl bg-muted/50 p-4">
              <div className="mb-3 flex justify-between text-xs font-bold">
                <span>{paidPayments.length} em dia</span>
                <span className="text-muted-foreground">{players.length - paidPayments.length} pendentes</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500"
                  style={{ width: `${players.length ? paidPayments.length / players.length * 100 : 0}%` }}
                />
              </div>
            </div>
            <Button onClick={() => setView('payments')} className="mt-4 h-10 w-full rounded-xl font-semibold" variant="outline">
              Ver mensalidades <ChevronRight className="size-4" />
            </Button>
          </section>

          {/* Quick Rankings */}
          <section className="panel sm:col-span-2 lg:col-span-1">
            <div className="section-heading">
              <div>
                <p className="eyebrow-muted">Rankings rápidos</p>
                <h3>Top jogadores</h3>
              </div>
              <Trophy className="size-5 text-primary" />
            </div>
            <div className="mt-4 space-y-1">
              {[...stats].sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists)).slice(0, 4).map((item, index) => (
                <button
                  key={item.player.id}
                  onClick={() => { setActivePlayerId(item.player.id); setDialog('playerCard'); }}
                  className="rank-row"
                >
                  <span className={`rank-number ${index === 0 ? 'top' : ''}`}>{index + 1}</span>
                  <PlayerAvatar player={item.player} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{item.player.nickname}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.goals} gols · {item.assists} assist.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black tabular-nums">{item.goals + item.assists}</p>
                    <p className="stat-label">partic.</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  };

  /* ─── MATCHES VIEW (with PitchView + Live Manager + Export) ─── */
  const matchesView = () => <div className="space-y-5">{matches.map((match) => {
    const teamAPlayers = match.teamA.map((id) => playerById(id)).filter(Boolean) as Player[];
    const teamBPlayers = match.teamB.map((id) => playerById(id)).filter(Boolean) as Player[];
    const isLive = match.status === 'live';
    const showLive = isLive && showLiveManager && activeMatchId === match.id;

    return (
      <section key={match.id} className={`panel ${isLive ? 'ring-2 ring-primary/50' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`status-dot ${match.status}`} />
              <p className="eyebrow-muted">{isLive ? 'Ao vivo' : match.status === 'finished' ? 'Encerrado' : 'Agendado'}</p>
              {match.format && <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-black">{match.format}</span>}
            </div>
            <h3 className="mt-1 text-lg font-black">{match.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{formatDate(match.date)} · {match.time} · {match.venue}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Edit button - always visible except maybe live */}
            {match.status !== 'live' && (
              <Button variant="outline" size="sm" onClick={() => openEditMatch(match)}>
                <span className="size-4">✏️</span> Editar
              </Button>
            )}
            {/* Delete button - with extra confirmation for live matches */}
            <Button variant="outline" size="sm" onClick={() => deleteMatch(match)} className="text-red-500 hover:bg-red-500/10 hover:text-red-500 border-red-500/30">
              <span className="size-4">🗑️</span> Excluir
            </Button>
            {match.status === 'scheduled' && (
              <Button onClick={() => changeMatchStatus(match, 'live')}><Swords /> Iniciar</Button>
            )}
            {isLive && !showLive && (
              <Button onClick={() => { setActiveMatchId(match.id); setShowLiveManager(true); }} className="bg-emerald-600 hover:bg-emerald-700">
                <Goal /> Gestor ao vivo
              </Button>
            )}
            {isLive && showLive && (
              <Button variant="outline" onClick={() => setShowLiveManager(false)}>Fechar gestor</Button>
            )}
            {/* Export button */}
            {match.status !== 'scheduled' && (
              <div className="flex items-center gap-1">
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'png' | 'jpeg')}
                  className="h-9 rounded-lg border border-input bg-background px-2 text-xs font-bold"
                >
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                </select>
                <Button variant="outline" size="sm" onClick={() => handleExportLineup(match)}>
                  <Download className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Live Manager (inline) */}
        {showLive && (
          <div className="mt-5">
            <LiveManager
              match={match}
              players={players}
              onAddEvent={handleLiveAddEvent}
              onRemoveEvent={handleLiveRemoveEvent}
              onFinish={handleLiveFinish}
            />
          </div>
        )}

        {/* Score (when not in live manager mode) */}
        {!showLive && (
          <>
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
                  format={match.format || 'F7'}
                />
              </div>
            )}
            {isLive && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button onClick={() => openEvent(match, 'goal')} className="h-11"><Goal /> Marcar gol</Button>
                <Button onClick={() => openEvent(match, 'save')} variant="outline" className="h-11"><ShieldCheck /> Marcar defesa</Button>
              </div>
            )}
          </>
        )}

        {/* Events timeline */}
        {match.events.length > 0 && !showLive && (
          <div className="mt-5 border-t pt-4">
            <p className="eyebrow-muted mb-3">Últimos lances</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[...match.events].reverse().slice(0, 6).map((event) => (
                <div key={event.id} className="event-row">
                  <span>{event.type === 'goal' ? (event.isOwnGoal ? '🤦' : '⚽') : event.type === 'save' ? '🧤' : event.type === 'yellow' ? '🟨' : event.type === 'red' ? '🟥' : '🔄'}</span>
                  <b>{playerById(event.playerId)?.nickname}{event.assistPlayerId ? ` · assistência ${playerById(event.assistPlayerId)?.nickname}` : ''}</b>
                  <small>{event.minute}&apos;</small>
                </div>
              ))}
            </div>
          </div>
        )}
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
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${rankingTab === section.key ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
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
    <div className="mx-auto w-full max-w-[620px]"><div className="art-preview"><div className="art-brand"><b>NA TRAVE</b><span>Setembro 2026</span></div><div className="art-avatar">{previewPhotoSrc ? <img src={previewPhotoSrc} alt="" /> : initials(artStats?.player)}</div><div className="art-copy"><p>{artLabel[0]}</p><h3>{artStats?.player.nickname.toUpperCase()}</h3><strong>{artLabel[1]}</strong></div><footer>Fut das quintas</footer></div></div></div>;

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
              <Button onClick={() => { setMatchForm((form) => ({ ...form, selected: players.map((player) => player.id) })); setPreviewTeams(null); setDragPositions({}); setDialog('match'); }}><Plus /><span>Nova partida</span></Button>
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

      {/* Match dialog (with balance preview + format selector + drag positions) */}
      <Dialog open={dialog === 'match'} onOpenChange={(open) => { if (!open) { setDialog(null); setPreviewTeams(null); setDragPositions({}); setEditingMatchId(null); } }}>
        <DialogContent className="flex max-h-[94vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2"><DialogTitle>{editingMatchId ? 'Editar partida' : 'Nova partida'}</DialogTitle><DialogDescription>{editingMatchId ? 'Ajuste os detalhes e a escalação da partida.' : 'Selecione o formato e os confirmados; o sorteio inteligente equilibra por atributos.'}</DialogDescription></DialogHeader>
          <div className="flex-1 overflow-y-auto grid gap-4 sm:grid-cols-2 px-6 pb-6 pt-2">
            <label className="form-label sm:col-span-2">Nome<Input value={matchForm.title} onChange={(e) => setMatchForm({ ...matchForm, title: e.target.value })} className="form-control" /></label>
            <label className="form-label sm:col-span-2">Local<Input value={matchForm.venue} onChange={(e) => setMatchForm({ ...matchForm, venue: e.target.value })} className="form-control" /></label>
            <label className="form-label">Data<Input type="date" value={matchForm.date} onChange={(e) => setMatchForm({ ...matchForm, date: e.target.value })} className="form-control" /></label>
            <label className="form-label">Horário<Input type="time" value={matchForm.time} onChange={(e) => setMatchForm({ ...matchForm, time: e.target.value })} className="form-control" /></label>

            {/* Format selector */}
            <div className="sm:col-span-2">
              <p className="form-label mb-2">Formato</p>
              <div className="flex gap-2">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMatchForm({ ...matchForm, format: opt.value })}
                    className={`flex-1 rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition-all ${
                      matchForm.format === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted/50 text-muted-foreground hover:border-muted-foreground/30'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {idealPerTeam} por time · {totalSelected} confirmados
                {playersShort && (
                  <span className="ml-1 font-bold text-amber-500">
                    · Faltam {idealPerTeam * 2 - totalSelected} jogadores
                  </span>
                )}
              </p>
            </div>

            <div className="sm:col-span-2">
              <p className="form-label mb-2">Escalação · {matchForm.selected.length} confirmados</p>
              <div className="roster max-h-48 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-2">{players.map((player) => { const checked = matchForm.selected.includes(player.id); return <button key={player.id} onClick={() => { setPreviewTeams(null); setMatchForm((form) => ({ ...form, selected: checked ? form.selected.filter((id) => id !== player.id) : [...form.selected, player.id] })); }} className={checked ? 'checked' : ''}><i>{checked && <Check />}</i><PlayerAvatar player={player} size="sm" /><b>{player.nickname}</b><small>{calcOverall(player)}</small></button>; })}</div>
            </div>

            {/* Balance preview with draggable pitch - DENTRO do scroll */}
            <div className="sm:col-span-2">
              {!previewTeams ? (
                <button type="button" disabled={isDrawingTeams} onClick={previewDraft} className={`draft-trigger ${isDrawingTeams ? 'drawing' : ''}`}>
                  <span className="draft-trigger-icon"><Swords /></span>
                  <span><b>{isDrawingTeams ? 'Sorteando os times…' : 'Sortear times agora'}</b><small>{isDrawingTeams ? 'Analisando posições e atributos' : 'Equilíbrio automático por posição e overall'}</small></span>
                  <ChevronRight />
                </button>
              ) : (
                <div className="draft-result rounded-[24px] border border-border bg-gradient-to-b from-card to-muted/40 p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-primary">Escalação pronta</p><h3 className="mt-0.5 text-base font-black">Quadro tático</h3></div>
                    <div className="flex items-center gap-2">
                      {previewBalance && <span className="balance-chip"><Check /> {previewBalance.percentage}% equilibrado</span>}
                      <button onClick={previewDraft} className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold transition hover:border-primary hover:text-primary"><Sparkles className="mr-1 inline size-3.5" /> Sortear novamente</button>
                      <button onClick={() => { setPreviewTeams(null); setDragPositions({}); }} className="grid size-8 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Limpar sorteio"><X className="size-4" /></button>
                    </div>
                  </div>
                  <DraggablePitch
                    teamA={previewTeamAPlayers}
                    teamB={previewTeamBPlayers}
                    teamAName="Time Verde"
                    teamBName="Time Branco"
                    compact
                    format={matchForm.format}
                    editable
                    fieldPositions={dragPositions}
                    onPositionsChange={setDragPositions}
                  />
                  <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-muted/70 px-3 py-2 text-[10px] font-bold text-muted-foreground"><Menu className="size-3" /> Segure e arraste um jogador para ajustar a posição</div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
            <Button variant="outline" onClick={() => { setDialog(null); setPreviewTeams(null); setDragPositions({}); setEditingMatchId(null); }}>Cancelar</Button>
            <Button onClick={saveMatch}><Swords /> {editingMatchId ? 'Salvar alterações' : 'Montar times'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event dialog */}
      <Dialog open={dialog === 'event'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{eventForm.type === 'goal' ? 'Registrar gol' : eventForm.type === 'save' ? 'Registrar defesa' : `Registrar ${eventForm.type}`}</DialogTitle><DialogDescription>O lance atualiza a súmula e os rankings.</DialogDescription></DialogHeader>
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
