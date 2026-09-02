'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Clock, Goal, ShieldCheck, Square, Undo, XCircle, Volume2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Match, MatchEvent, MatchEventType, Player } from '@/lib/fut-types';

/* ─── Whistle (Web Audio) ─── */
function playWhistle() {
  try {
    const ctx = new AudioContext();
    // First beep
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.frequency.value = 1800;
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(0.6, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.4);
    // Second beep (short pause)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 2200;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0.6, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.55);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.55);
  } catch { /* audio not available */ }
}

/* ─── LiveTimer ─── */
function LiveTimer({
  elapsed,
  running,
  onToggle,
  onReset,
}: {
  elapsed: number;
  running: boolean;
  onToggle: () => void;
  onReset: () => void;
}) {
  const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const sec = String(elapsed % 60).padStart(2, '0');

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <span className="text-5xl font-black tabular-nums tracking-tighter text-primary drop-shadow-[0_0_14px_var(--glow)] sm:text-6xl">
          {min}:{sec}
        </span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onToggle}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase text-ink-inverse hover:bg-white/20 transition-all"
        >
          {running ? '⏸ Pausar' : '▶ Iniciar'}
        </button>
        <button
          onClick={onReset}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase text-ink-inverse hover:bg-white/20 transition-all"
        >
          ⏹ Zerar
        </button>
      </div>
    </div>
  );
}

/* ─── event type config ─── */
const EVENT_CONFIG: Record<string, { icon: LucideIcon; label: string; chip: string; tone: string; fill?: string }> = {
  goal: { icon: Goal, label: 'Gol', chip: 'bg-emerald-500/20 text-emerald-400', tone: 'text-emerald-400' },
  save: { icon: ShieldCheck, label: 'Defesa', chip: 'bg-sky-500/20 text-sky-400', tone: 'text-sky-400' },
  ownGoal: { icon: Goal, label: 'Gol contra', chip: 'bg-orange-500/20 text-orange-400', tone: 'text-orange-400' },
  substitution: { icon: ArrowLeftRight, label: 'Sub.', chip: 'bg-purple-500/20 text-purple-400', tone: 'text-purple-400' },
};

/** Own goals are stored as `goal` events with isOwnGoal, but display as "Gol contra". */
function configFor(event: MatchEvent) {
  if (event.type === 'goal' && event.isOwnGoal) return EVENT_CONFIG.ownGoal;
  return EVENT_CONFIG[event.type] || EVENT_CONFIG.goal;
}

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
  const config = configFor(event);
  const Icon = config.icon;
  return (
    <div className="group flex items-start gap-3">
      <div className="flex flex-col items-center">
        <span className="grid size-8 place-items-center rounded-full bg-white/10">
          <Icon className={`size-4 ${config.tone} ${config.fill || ''}`} />
        </span>
        <div className="mt-1 h-8 w-px bg-white/10" />
      </div>
      <div className="min-w-0 flex-1 pb-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${config.chip}`}>
            {config.label}
          </span>
          <span className="text-xs text-ink-inverse-faint">{event.minute}&apos;</span>
          {onRemove && (
            <button
              onClick={onRemove}
              className="ml-auto rounded p-0.5 text-ink-inverse-faint opacity-0 transition hover:text-red-400 group-hover:opacity-100"
              title="Remover"
            >
              <XCircle className="size-3.5" />
            </button>
          )}
        </div>
        <p className="mt-1 text-sm font-bold text-ink-inverse">
          {player?.nickname || '???'}
          {event.type === 'goal' && event.isOwnGoal && (
            <span className="ml-1 text-xs font-normal text-orange-400">(gol contra)</span>
          )}
          {event.type === 'goal' && assistPlayer && (
            <span className="ml-1 text-xs font-normal text-ink-inverse-faint">
              assist. {assistPlayer.nickname}
            </span>
          )}
          {event.type === 'substitution' && playerOut && (
            <span className="ml-1 inline-flex items-center gap-1 text-xs font-normal text-ink-inverse-faint">
              <ArrowLeftRight className="size-3" /> {playerOut.nickname}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

/* ─── Quick Action Button ─── */
function ActionButton({
  icon: Icon,
  iconClass,
  label,
  onClick,
  active = false,
}: {
  icon: LucideIcon;
  iconClass?: string;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  const base = 'flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 min-h-[80px] text-xs font-extrabold transition-all active:scale-95';
  const styles = active
    ? 'border-primary bg-primary/10 text-ink-inverse ring-2 ring-primary/30'
    : 'border-line-inverse bg-white/5 text-ink-inverse hover:bg-white/10';
  return (
    <button onClick={onClick} className={`${base} ${styles}`}>
      <Icon className={`size-5 ${iconClass || ''}`} />
      {label}
    </button>
  );
}

/* ─── Action type labels ─── */
const ACTION_LABELS: Record<string, string> = {
  goal: 'Registrar gol',
  save: 'Registrar defesa',
  ownGoal: 'Registrar gol contra',
  substitution: 'Registrar substituição',
};

/* ─── main component ─── */
interface LiveManagerProps {
  match: Match;
  players: Player[];
  onAddEvent: (event: Omit<MatchEvent, 'id' | 'createdAt'>) => void;
  onRemoveEvent: (eventId: string) => void;
  onFinish: () => void;
  onPause?: () => void;
  onSetGoalkeeper?: (team: 'A' | 'B', playerId: string) => void;
}

export function LiveManager({ match, players, onAddEvent, onRemoveEvent, onFinish, onPause, onSetGoalkeeper }: LiveManagerProps) {
  /* ─── timer state ─── */
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ─── action confirmation state ─── */
  const [pendingAction, setPendingAction] = useState<MatchEventType | 'ownGoal' | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [assistPlayerId, setAssistPlayerId] = useState('');
  const [playerOutId, setPlayerOutId] = useState('');

  /* ─── team selection ─── */
  const [selectedTeam, setSelectedTeam] = useState<'A' | 'B'>('A');

  /* ─── whistle interval ─── */
  const [whistleMinutes, setWhistleMinutes] = useState(5);
  const [whistleEnabled, setWhistleEnabled] = useState(false);
  const lastWhistleRef = useRef(0);

  /* ─── derived ─── */
  const teamAPlayers = useMemo(
    () => match.teamA.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[],
    [match.teamA, players],
  );
  const teamBPlayers = useMemo(
    () => match.teamB.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[],
    [match.teamB, players],
  );
  const currentTeamPlayers = selectedTeam === 'A' ? teamAPlayers : teamBPlayers;
  const minute = Math.floor(elapsed / 60) + 1;

  /* ─── timer logic ─── */
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  /* ─── whistle logic ─── */
  useEffect(() => {
    if (!whistleEnabled || !timerRunning) return;
    const intervalSec = whistleMinutes * 60;
    if (intervalSec <= 0) return;
    const currentMinute = Math.floor(elapsed / 60);
    if (currentMinute > 0 && currentMinute % whistleMinutes === 0 && elapsed > 0 && currentMinute !== lastWhistleRef.current) {
      lastWhistleRef.current = currentMinute;
      playWhistle();
    }
  }, [elapsed, timerRunning, whistleEnabled, whistleMinutes]);

  /* ─── reset lastWhistle when timer resets ─── */
  useEffect(() => {
    if (elapsed === 0) lastWhistleRef.current = 0;
  }, [elapsed]);

  /* ─── action handlers ─── */
  function handleAction(type: MatchEventType | 'ownGoal') {
    setPendingAction(type);
    const goalkeeperId = selectedTeam === 'A' ? match.goalkeeperAId : match.goalkeeperBId;
    setSelectedPlayerId((type === 'save' ? goalkeeperId : undefined) || currentTeamPlayers[0]?.id || '');
    setAssistPlayerId('');
    setPlayerOutId('');
  }

  function cancelPending() {
    setPendingAction(null);
  }

  function confirmPending() {
    if (!pendingAction) return;
    const isOwnGoal = pendingAction === 'ownGoal';
    const actualType: MatchEventType = isOwnGoal ? 'goal' : pendingAction;

    if (pendingAction === 'substitution') {
      onAddEvent({
        type: actualType,
        playerId: selectedPlayerId,
        playerOutId: playerOutId || undefined,
        team: selectedTeam,
        minute,
      });
    } else if (pendingAction === 'goal') {
      onAddEvent({
        type: 'goal',
        playerId: selectedPlayerId,
        assistPlayerId: assistPlayerId || undefined,
        team: selectedTeam,
        minute,
      });
    } else {
      onAddEvent({
        type: actualType,
        playerId: selectedPlayerId,
        team: selectedTeam,
        minute,
        isOwnGoal: isOwnGoal || undefined,
      });
    }

    setPendingAction(null);
  }

  /* ─── timer controls ─── */
  function resetTimer() {
    setElapsed(0);
    setTimerRunning(false);
    lastWhistleRef.current = 0;
  }

  function toggleTimer() {
    setTimerRunning((r) => !r);
  }

  function adjustTimer(deltaSeconds: number) {
    setElapsed((e) => Math.max(0, e + deltaSeconds));
  }

  /* ─── whistle controls ─── */
  function testWhistle() {
    playWhistle();
  }

  return (
    <div className="space-y-4 rounded-[24px] border border-line-inverse bg-surface-inverse p-4 text-ink-inverse shadow-[0_24px_70px_rgba(10,25,14,.16)] sm:p-5">
      {/* Live Header with timer & score */}
      <div className="rounded-[20px] border border-line-inverse bg-white/[.04] p-5 sm:p-6">
        {/* Live pulse + timer */}
        <div className="mb-4 flex flex-col items-center gap-3">
          <span className="flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
            <span className="size-1.5 animate-pulse rounded-full bg-white" />
            AO VIVO
          </span>
          <LiveTimer elapsed={elapsed} running={timerRunning} onToggle={toggleTimer} onReset={resetTimer} />
        </div>

        {/* Timer adjust buttons */}
        <div className="mt-3 flex items-center justify-center gap-2">
          <Clock className="size-3.5 text-ink-inverse-faint" />
          <span className="text-xs text-ink-inverse-faint">Ajustar:</span>
          {[-60, -10, -1, 1, 10, 60].map((delta) => (
            <button
              key={delta}
              onClick={() => adjustTimer(delta)}
              className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-bold text-ink-inverse-faint hover:bg-white/15 transition-all"
            >
              {delta > 0 ? '+' : ''}{delta === 60 ? '1min' : delta === -60 ? '-1min' : `${delta}s`}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <div className="grid grid-cols-3 items-start gap-3">
            <div className="text-center">
              <p className="mb-2 text-xs font-black uppercase tracking-wider text-ink-inverse-soft">{match.teamAName}</p>
              <div className="space-y-0.5">
                {teamAPlayers.map((p) => {
                  const isGK = p.id === match.goalkeeperAId;
                  return (
                    <button type="button" key={p.id} onClick={() => onSetGoalkeeper?.('A', p.id)} className={`block w-full text-center text-xs transition hover:text-ink-inverse ${isGK ? 'font-black text-emerald-400' : 'font-medium text-ink-inverse-faint'}`}>
                      {p.nickname}{isGK ? ' (GOL)' : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col items-center gap-1 pt-6">
              <div className="flex items-baseline gap-2 text-5xl font-black tabular-nums tracking-tighter sm:text-6xl">
                <span>{match.scoreA}</span>
                <span className="text-lg text-ink-inverse-faint/40">—</span>
                <span>{match.scoreB}</span>
              </div>
              <span className="text-[10px] text-ink-inverse-faint">Minuto: <strong className="text-ink-inverse">{minute}&apos;</strong></span>
            </div>

            <div className="text-center">
              <p className="mb-2 text-xs font-black uppercase tracking-wider text-ink-inverse-soft">{match.teamBName}</p>
              <div className="space-y-0.5">
                {teamBPlayers.map((p) => {
                  const isGK = p.id === match.goalkeeperBId;
                  return (
                    <button type="button" key={p.id} onClick={() => onSetGoalkeeper?.('B', p.id)} className={`block w-full text-center text-xs transition hover:text-ink-inverse ${isGK ? 'font-black text-emerald-400' : 'font-medium text-ink-inverse-faint'}`}>
                      {isGK ? '(GOL) ' : ''}{p.nickname}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Team selector */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setSelectedTeam('A')}
              className={`flex-1 rounded-xl py-2.5 text-sm font-extrabold transition-all ${
                selectedTeam === 'A'
                  ? 'bg-[#16a34a] text-white shadow-md'
                  : 'bg-white/5 text-ink-inverse-faint hover:bg-white/10'
              }`}
            >
              {match.teamAName}
            </button>
            <button
              onClick={() => setSelectedTeam('B')}
              className={`flex-1 rounded-xl py-2.5 text-sm font-extrabold transition-all ${
                selectedTeam === 'B'
                  ? 'bg-[#3b82f6] text-white shadow-md'
                  : 'bg-white/5 text-ink-inverse-faint hover:bg-white/10'
              }`}
            >
              {match.teamBName}
            </button>
          </div>
        </div>
      </div>

      {/* Action confirmation panel */}
      {pendingAction && (
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-primary">{ACTION_LABELS[pendingAction] || 'Confirmar ação'}</p>

          {/* Player selector */}
          <label className="form-label text-ink-inverse">
            Jogador
            <select
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="form-control mt-1 border-line-inverse bg-white/5 text-ink-inverse"
            >
              {currentTeamPlayers.map((p) => (
                <option key={p.id} value={p.id} className="bg-card text-foreground">
                  {p.nickname}
                </option>
              ))}
            </select>
          </label>

          {/* Assist selector (goal only) */}
          {pendingAction === 'goal' && (
            <label className="form-label mt-2 text-ink-inverse">
              Assistência (opcional)
              <select
                value={assistPlayerId}
                onChange={(e) => setAssistPlayerId(e.target.value)}
                className="form-control mt-1 border-line-inverse bg-white/5 text-ink-inverse"
              >
                <option value="" className="bg-card text-foreground">Sem assistência</option>
                {currentTeamPlayers
                  .filter((p) => p.id !== selectedPlayerId)
                  .map((p) => (
                    <option key={p.id} value={p.id} className="bg-card text-foreground">
                      {p.nickname}
                    </option>
                  ))}
              </select>
            </label>
          )}

          {/* Player out selector (substitution only) */}
          {pendingAction === 'substitution' && (
            <label className="form-label mt-2 text-ink-inverse">
              Sai do jogo
              <select
                value={playerOutId}
                onChange={(e) => setPlayerOutId(e.target.value)}
                className="form-control mt-1 border-line-inverse bg-white/5 text-ink-inverse"
              >
                <option value="" className="bg-card text-foreground">Selecionar...</option>
                {currentTeamPlayers
                  .filter((p) => p.id !== selectedPlayerId)
                  .map((p) => (
                    <option key={p.id} value={p.id} className="bg-card text-foreground">
                      {p.nickname}
                    </option>
                  ))}
              </select>
            </label>
          )}

          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={cancelPending} className="flex-1 border-line-inverse bg-transparent text-ink-inverse hover:bg-white/10 hover:text-ink-inverse">
              Cancelar
            </Button>
            <Button onClick={confirmPending} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
              Confirmar
            </Button>
          </div>
        </div>
      )}

      {/* Quick actions grid */}
      <div className="grid grid-cols-3 gap-3">
        <ActionButton
          icon={Goal}
          iconClass="text-emerald-400"
          label="Gol"
          onClick={() => handleAction('goal')}
          active={pendingAction === 'goal'}
        />
        <ActionButton
          icon={ShieldCheck}
          iconClass="text-sky-400"
          label="Defesa"
          onClick={() => handleAction('save')}
          active={pendingAction === 'save'}
        />
        <ActionButton
          icon={Goal}
          iconClass="text-orange-400"
          label="Gol Contra"
          onClick={() => handleAction('ownGoal')}
          active={pendingAction === 'ownGoal'}
        />
        <ActionButton
          icon={ArrowLeftRight}
          iconClass="text-purple-400"
          label="Substituição"
          onClick={() => handleAction('substitution')}
          active={pendingAction === 'substitution'}
        />
      </div>

      {/* Whistle config */}
      <div className="rounded-2xl border border-line-inverse bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="size-4 text-ink-inverse-faint" />
            <span className="text-xs font-extrabold uppercase text-ink-inverse-faint">Apito para trocas</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWhistleEnabled((e) => !e)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                whistleEnabled ? 'bg-primary' : 'bg-white/10'
              }`}
            >
              <span
                className={`inline-block size-4 rounded-full bg-white transition-transform ${
                  whistleEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
        {whistleEnabled && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-ink-inverse-faint">A cada</span>
            <select
              value={whistleMinutes}
              onChange={(e) => setWhistleMinutes(Number(e.target.value))}
              className="form-control h-8 w-20 border-line-inverse bg-white/5 text-ink-inverse text-xs"
            >
              {[1, 2, 3, 4, 5, 10, 15, 20].map((m) => (
                <option key={m} value={m} className="bg-card text-foreground">
                  {m} min
                </option>
              ))}
            </select>
            <button
              onClick={testWhistle}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold text-ink-inverse hover:bg-white/20 transition-all"
            >
              🔊 Testar
            </button>
          </div>
        )}
      </div>

      {/* Timeline */}
      {match.events.length > 0 && (
        <div className="rounded-2xl border border-line-inverse bg-white/5 p-4">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-ink-inverse-faint">Timeline</p>
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
            className="flex-1 border-line-inverse bg-transparent text-ink-inverse-soft hover:bg-white/10 hover:text-ink-inverse"
          >
            <Undo className="size-4" /> Desfazer
          </Button>
        )}
        <Button
          variant="outline"
          onClick={onFinish}
          className="flex-1 border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-400"
        >
          <Square className="size-4" /> Encerrar partida
        </Button>
      </div>
    </div>
  );
}
