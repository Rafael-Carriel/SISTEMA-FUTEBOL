'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock, Square, Undo, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Match, MatchEvent, MatchEventType, Player } from '@/lib/fut-types';

/* ─── helpers ─── */
function initials(player?: Player): string {
  return player
    ? (player.nickname || player.name)
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : '?';
}

/* ─── LiveTimer ─── */
function LiveTimer({ startedAt }: { startedAt?: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) { setElapsed(0); return; }
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const sec = String(elapsed % 60).padStart(2, '0');

  return (
    <span className="font-mono text-5xl font-black tabular-nums tracking-tighter text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.4)] sm:text-6xl">
      {min}:{sec}
    </span>
  );
}

/* ─── event type config ─── */
const EVENT_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  goal: { icon: '⚽', label: 'Gol', color: 'bg-emerald-500/20 text-emerald-400' },
  save: { icon: '🧤', label: 'Defesa', color: 'bg-sky-500/20 text-sky-400' },
  frango: { icon: '🤦', label: 'Frango', color: 'bg-orange-500/20 text-orange-400' },
  yellow: { icon: '🟨', label: 'Amarelo', color: 'bg-yellow-500/20 text-yellow-400' },
  red: { icon: '🟥', label: 'Vermelho', color: 'bg-red-500/20 text-red-400' },
  substitution: { icon: '↔️', label: 'Sub.', color: 'bg-purple-500/20 text-purple-400' },
};

/* ─── Timeline Event Item ─── */
function TimelineEvent({
  event,
  player,
  assistPlayer,
  playerOut,
  onRemove,
}: {
  event: MatchEvent;
  player?: Player;
  assistPlayer?: Player;
  playerOut?: Player;
  onRemove?: () => void;
}) {
  const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.goal;
  return (
    <div className="group flex items-start gap-3">
      <div className="flex flex-col items-center">
        <span className="grid size-8 place-items-center rounded-full bg-white/10 text-sm">
          {config.icon}
        </span>
        <div className="mt-1 h-8 w-px bg-white/10" />
      </div>
      <div className="min-w-0 flex-1 pb-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${config.color}`}>
            {config.label}
          </span>
          <span className="text-xs text-white/40">{event.minute}&apos;</span>
          {onRemove && (
            <button
              onClick={onRemove}
              className="ml-auto rounded p-0.5 text-white/20 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
              title="Remover"
            >
              <XCircle className="size-3.5" />
            </button>
          )}
        </div>
        <p className="mt-1 text-sm font-bold text-white">
          {player?.nickname || '???'}
          {event.type === 'goal' && assistPlayer && (
            <span className="ml-1 text-xs font-normal text-white/40">
              assist. {assistPlayer.nickname}
            </span>
          )}
          {event.type === 'goal' && event.isOwnGoal && (
            <span className="ml-1 text-xs font-normal text-orange-400">(gol contra)</span>
          )}
          {event.type === 'substitution' && playerOut && (
            <span className="ml-1 text-xs font-normal text-white/40">
              ↔ {playerOut.nickname}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

/* ─── Quick Action Button ─── */
function ActionButton({
  icon,
  label,
  onClick,
  variant = 'default',
}: {
  icon: string;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
}) {
  const base = 'flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-extrabold transition-all active:scale-95';
  const styles =
    variant === 'danger'
      ? 'border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20'
      : 'border-white/10 bg-white/5 text-white hover:bg-white/10';
  return (
    <button onClick={onClick} className={`${base} ${styles}`}>
      <span className="text-xl">{icon}</span>
      {label}
    </button>
  );
}

/* ─── main component ─── */
interface LiveManagerProps {
  match: Match;
  players: Player[];
  onAddEvent: (event: Omit<MatchEvent, 'id' | 'createdAt'>) => void;
  onRemoveEvent: (eventId: string) => void;
  onFinish: () => void;
  onPause?: () => void;
}

export function LiveManager({ match, players, onAddEvent, onRemoveEvent, onFinish, onPause }: LiveManagerProps) {
  const [editingMinute, setEditingMinute] = useState(false);
  const [minuteValue, setMinuteValue] = useState(String((match.events?.length || 0) + 1));
  const [selectedTeam, setSelectedTeam] = useState<'A' | 'B'>('A');
  const [showAssist, setShowAssist] = useState(false);
  const [goalPlayerId, setGoalPlayerId] = useState('');
  const [assistPlayerId, setAssistPlayerId] = useState('');

  const teamAPlayers = useMemo(
    () => match.teamA.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[],
    [match.teamA, players],
  );
  const teamBPlayers = useMemo(
    () => match.teamB.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[],
    [match.teamB, players],
  );

  const currentTeamPlayers = selectedTeam === 'A' ? teamAPlayers : teamBPlayers;
  const minute = Number(minuteValue) || 1;

  function handleAction(type: MatchEventType) {
    if (type === 'goal') {
      setGoalPlayerId(currentTeamPlayers[0]?.id || '');
      setAssistPlayerId('');
      setShowAssist(true);
      return;
    }
    onAddEvent({
      type,
      playerId: currentTeamPlayers[0]?.id || '',
      team: selectedTeam,
      minute,
    });
    setMinuteValue(String(minute + 1));
  }

  function confirmGoal() {
    onAddEvent({
      type: 'goal',
      playerId: goalPlayerId,
      assistPlayerId: assistPlayerId || undefined,
      team: selectedTeam,
      minute,
    });
    setShowAssist(false);
    setMinuteValue(String(minute + 1));
  }

  function handleFrango() {
    onAddEvent({
      type: 'goal',
      playerId: currentTeamPlayers[0]?.id || '',
      team: selectedTeam,
      minute,
      isOwnGoal: true,
    });
    setMinuteValue(String(minute + 1));
  }

  return (
    <div className="space-y-5">
      {/* Live Header with timer & score */}
      <div className="rounded-[24px] border border-white/10 bg-[#0b1710] p-5 text-white shadow-[0_24px_70px_rgba(10,25,14,.16)] sm:p-7">
        {/* Live pulse + timer */}
        <div className="mb-4 flex items-center justify-center gap-3">
          <span className="flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
            <span className="size-1.5 animate-pulse rounded-full bg-white" />
            AO VIVO
          </span>
          <LiveTimer startedAt={match.startedAt} />
        </div>

        {/* Scoreboard */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
          <div>
            <p className="text-sm font-black uppercase text-white/60">{match.teamAName}</p>
          </div>
          <div className="flex items-center gap-3 text-6xl font-black tabular-nums tracking-tighter sm:text-7xl">
            <span className="text-white">{match.scoreA}</span>
            <span className="text-white/20">—</span>
            <span className="text-white">{match.scoreB}</span>
          </div>
          <div>
            <p className="text-sm font-black uppercase text-white/60">{match.teamBName}</p>
          </div>
        </div>

        {/* Team selector */}
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => setSelectedTeam('A')}
            className={`flex-1 rounded-xl py-2.5 text-sm font-extrabold transition-all ${
              selectedTeam === 'A'
                ? 'bg-[#16a34a] text-white shadow-md'
                : 'bg-white/5 text-white/40 hover:bg-white/10'
            }`}
          >
            {match.teamAName}
          </button>
          <button
            onClick={() => setSelectedTeam('B')}
            className={`flex-1 rounded-xl py-2.5 text-sm font-extrabold transition-all ${
              selectedTeam === 'B'
                ? 'bg-[#3b82f6] text-white shadow-md'
                : 'bg-white/5 text-white/40 hover:bg-white/10'
            }`}
          >
            {match.teamBName}
          </button>
        </div>

        {/* Minute editor */}
        <div className="mt-3 flex items-center justify-center gap-2">
          <Clock className="size-3.5 text-white/30" />
          <span className="text-xs text-white/40">Minuto:</span>
          <input
            type="number"
            value={minuteValue}
            onChange={(e) => setMinuteValue(e.target.value)}
            className="h-7 w-14 rounded-lg border border-white/10 bg-white/5 px-2 text-center text-sm font-bold text-white outline-none focus:border-emerald-500/50"
          />
          <span className="text-xs text-white/40">&apos;</span>
        </div>
      </div>

      {/* Goal confirmation modal */}
      {showAssist && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-emerald-400">Confirmar gol</p>
          <label className="form-label text-white">
            Jogador
            <select
              value={goalPlayerId}
              onChange={(e) => setGoalPlayerId(e.target.value)}
              className="form-control mt-1 border-white/10 bg-white/5 text-white"
            >
              {currentTeamPlayers.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0b1710]">
                  {p.nickname}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-2 form-label text-white">
            Assistência (opcional)
            <select
              value={assistPlayerId}
              onChange={(e) => setAssistPlayerId(e.target.value)}
              className="form-control mt-1 border-white/10 bg-white/5 text-white"
            >
              <option value="" className="bg-[#0b1710]">Sem assistência</option>
              {currentTeamPlayers
                .filter((p) => p.id !== goalPlayerId)
                .map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#0b1710]">
                    {p.nickname}
                  </option>
                ))}
            </select>
          </label>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={() => setShowAssist(false)} className="flex-1 border-white/10 text-white">
              Cancelar
            </Button>
            <Button onClick={confirmGoal} className="flex-1 bg-emerald-500 hover:bg-emerald-600">
              Confirmar gol
            </Button>
          </div>
        </div>
      )}

      {/* Quick actions grid */}
      <div className="grid grid-cols-3 gap-2">
        <ActionButton icon="⚽" label="Gol" onClick={() => handleAction('goal')} />
        <ActionButton icon="🧤" label="Defesa" onClick={() => handleAction('save')} />
        <ActionButton icon="🤦" label="Frango" onClick={handleFrango} />
        <ActionButton icon="🟨" label="Amarelo" onClick={() => handleAction('yellow')} />
        <ActionButton icon="🟥" label="Vermelho" onClick={() => handleAction('red')} variant="danger" />
        <ActionButton icon="↔️" label="Substituição" onClick={() => handleAction('substitution')} />
      </div>

      {/* Timeline */}
      {match.events.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-white/40">Timeline</p>
          <div className="space-y-0">
            {[...match.events]
              .sort((a, b) => a.minute - b.minute)
              .map((event) => (
                <TimelineEvent
                  key={event.id}
                  event={event}
                  player={players.find((p) => p.id === event.playerId)}
                  assistPlayer={event.assistPlayerId ? players.find((p) => p.id === event.assistPlayerId) : undefined}
                  playerOut={event.playerOutId ? players.find((p) => p.id === event.playerOutId) : undefined}
                  onRemove={() => onRemoveEvent(event.id)}
                />
              ))}
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex gap-2">
        {match.events.length > 0 && (
          <Button
            variant="outline"
            onClick={() => {
              const last = match.events[match.events.length - 1];
              if (last) onRemoveEvent(last.id);
            }}
            className="flex-1 border-white/10 text-white/60"
          >
            <Undo className="size-4" /> Desfazer
          </Button>
        )}
        <Button
          variant="outline"
          onClick={onFinish}
          className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
        >
          <Square className="size-4" /> Encerrar partida
        </Button>
      </div>
    </div>
  );
}
