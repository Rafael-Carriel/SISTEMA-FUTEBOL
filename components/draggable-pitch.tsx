'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical, MousePointer2 } from 'lucide-react';
import type { Player, MatchFormat, FieldPositions } from '@/lib/fut-types';
import { assignFormationPositions } from '@/lib/formation-layout';

/* ─── helpers ─── */
function initials(player: Player): string {
  const base = (player.nickname || player.name).trim();
  const parts = base.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function playerIdentity(player: Player): string {
  return `${(player.nickname || player.name).trim().toLocaleLowerCase('pt-BR')}|${player.number}`;
}

function dedupePlayers(players: Player[], blocked = new Set<string>()): Player[] {
  const seenIds = new Set<string>();
  const seenPeople = new Set(blocked);
  return players.filter((player) => {
    const identity = playerIdentity(player);
    if (seenIds.has(player.id) || seenPeople.has(identity)) return false;
    seenIds.add(player.id);
    seenPeople.add(identity);
    return true;
  });
}

/* ─── SVG field markings ─── */
function FieldLines({
  w,
  h,
  flip,
  format,
}: { w: number; h: number; flip: boolean; format: MatchFormat }) {
  const half = h / 2;
  // `flip=false` means the team attacks upwards, with its own goal at the bottom.
  // Keeping player coordinates and markings under the same rule prevents the
  // second formation from appearing upside down.
  const goalY = flip ? 0 : h - h * 0.15;
  const goalSmallY = flip ? 0 : h - h * 0.05;
  const penSpotY = flip ? h * 0.1 : h - h * 0.1;

  // Adjust dimensions based on format
  const penaltyWidth = format === 'F5' ? w * 0.9 : format === 'F7' ? w * 0.8 : w * 0.75;
  const penaltyHeight = format === 'F5' ? h * 0.2 : format === 'F7' ? h * 0.18 : h * 0.16;
  const goalWidth = format === 'F5' ? w * 0.6 : format === 'F7' ? w * 0.4 : w * 0.35;
  const goalHeight = format === 'F5' ? h * 0.08 : format === 'F7' ? h * 0.06 : h * 0.05;
  const centerCircleR = format === 'F5' ? w * 0.18 : format === 'F7' ? w * 0.14 : w * 0.12;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    >
      {/* half-way */}
      <line
        x1="0"
        y1={half}
        x2={w}
        y2={half}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.5"
        strokeDasharray="6,6"
      />
      {/* center circle */}
      <circle
        cx={w / 2}
        cy={half}
        r={centerCircleR}
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.5"
      />
      <circle cx={w / 2} cy={half} r="2.5" fill="rgba(255,255,255,0.5)" />
      {/* penalty area */}
      <rect
        x={(w - penaltyWidth) / 2}
        y={goalY}
        width={penaltyWidth}
        height={penaltyHeight}
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.5"
      />
      {/* goal area */}
      <rect
        x={(w - goalWidth) / 2}
        y={goalSmallY}
        width={goalWidth}
        height={goalHeight}
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.5"
      />
      {/* pen spot */}
      <circle cx={w / 2} cy={penSpotY} r="2.5" fill="rgba(255,255,255,0.5)" />
    </svg>
  );
}

/* ─── Draggable player node ─── */
interface DraggablePlayerProps {
  player: Player;
  x: number;
  y: number;
  teamColor: string;
  teamName: string;
  onDragEnd: (playerId: string, x: number, y: number) => void;
  editable: boolean;
  compact: boolean;
  flip: boolean;
  format: MatchFormat;
  index: number;
}

function DraggablePlayer({
  player,
  x,
  y,
  teamColor,
  teamName,
  onDragEnd,
  editable,
  compact,
  flip,
  format,
  index,
}: DraggablePlayerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const size = compact ? 42 : 52;
  const nameFontSize = compact ? '10px' : '12px';
  const badgeSize = compact ? 16 : 20;
  const numberFontSize = compact ? '8px' : '9px';

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!editable) return;
      e.preventDefault();
      setIsDragging(true);
      playerRef.current?.setPointerCapture(e.pointerId);
    },
    [editable]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !editable || !playerRef.current) return;
      const rect = playerRef.current.getBoundingClientRect();
      const containerRect = rect; // parent is the field div
      // We'll calculate relative to the field container
      const fieldRect = playerRef.current.parentElement?.getBoundingClientRect();
      if (!fieldRect) return;

      const newX = ((e.clientX - fieldRect.left) / fieldRect.width) * 100;
      const newY = ((e.clientY - fieldRect.top) / fieldRect.height) * 100;

      // Clamp to field bounds with margin to prevent clipping at edges (border + player radius)
      const clampedX = Math.max(5, Math.min(95, flip ? 100 - newX : newX));
      const clampedY = Math.max(5, Math.min(95, flip ? 100 - newY : newY));

      setDragPos({ x: clampedX, y: clampedY });
    },
    [isDragging, editable, flip]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !editable) return;
      setIsDragging(false);
      if (dragPos) {
        onDragEnd(player.id, dragPos.x, dragPos.y);
      }
      setDragPos(null);
      playerRef.current?.releasePointerCapture(e.pointerId);
    },
    [isDragging, editable, dragPos, onDragEnd]
  );

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove as any);
      window.addEventListener('pointerup', handlePointerUp as any);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove as any);
        window.removeEventListener('pointerup', handlePointerUp as any);
      };
    }
  }, [isDragging, handlePointerMove, handlePointerUp]);

  const displayX = dragPos ? (flip ? 100 - dragPos.x : dragPos.x) : (flip ? 100 - x : x);
  const displayY = dragPos ? (flip ? 100 - dragPos.y : dragPos.y) : (flip ? 100 - y : y);

  return (
    <div
      ref={playerRef}
      className="lineup-player absolute flex flex-col items-center transition-transform duration-150"
      style={{
        left: `${displayX}%`,
        top: `${displayY}%`,
        transform: 'translate(-50%,-50%)',
        zIndex: isDragging ? 100 : 10,
        cursor: editable ? (isDragging ? 'grabbing' : 'grab') : 'default',
        touchAction: editable ? 'none' : 'auto',
        animationDelay: `${120 + index * 75}ms`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="relative" style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.5))' }}>
        <span
          className="relative grid place-items-center overflow-hidden rounded-full border-2 font-black select-none"
          style={{
            width: size,
            height: size,
            fontSize: compact ? '11px' : '14px',
            background: teamColor,
            borderColor: '#fff',
            color: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {player.photoUrl ? (
            <img src={player.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(player)
          )}
        </span>
        <span
          className="absolute -bottom-1 -right-1 grid place-items-center rounded-full border-2 font-black text-white select-none"
          style={{
            width: badgeSize,
            height: badgeSize,
            fontSize: numberFontSize,
            background: teamColor,
            borderColor: '#fff',
          }}
        >
          {player.number}
        </span>
        {editable && isDragging && (
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/80 text-white text-[9px] font-medium whitespace-nowrap">
            <GripVertical className="size-3" />
            Solte para posicionar
          </span>
        )}
      </div>
      <span
        className="mt-1 max-w-[72px] truncate text-center font-bold select-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
        style={{ fontSize: compact ? '8px' : nameFontSize, color: '#fff', lineHeight: '1' }}
        title={`${player.nickname} #${player.number} · ${player.position}`}
      >
        {player.nickname}
      </span>
    </div>
  );
}

/* ─── Pitch half for a single team ─── */
interface PitchHalfProps {
  teamName: string;
  teamColor: string;
  players: Array<{ player: Player; x: number; y: number }>;
  w: number;
  h: number;
  compact: boolean;
  flip: boolean;
  format: MatchFormat;
  editable: boolean;
  onDragEnd: (playerId: string, x: number, y: number) => void;
}

function PitchHalf({
  teamName,
  teamColor,
  players,
  w,
  h,
  compact,
  flip,
  format,
  editable,
  onDragEnd,
}: PitchHalfProps) {
  const teamOverall = players.length
    ? Math.round(players.reduce((sum, item) => sum + Math.round((item.player.pace + item.player.shooting + item.player.passing + item.player.defending + item.player.physical) / 5), 0) / players.length)
    : 0;
  return (
    <div className="lineup-team flex w-full flex-col gap-3">
      <div className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
        <span className="size-2.5 rounded-full shadow-[0_0_12px_currentColor]" style={{ color: teamColor, background: teamColor }} />
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-xs font-black uppercase tracking-wider" style={{ color: teamColor }}>{teamName}</h4>
          <p className="text-[10px] font-bold text-muted-foreground">{players.length} jogadores · média {teamOverall}</p>
        </div>
        {editable && (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[9px] font-extrabold text-primary">
            <MousePointer2 className="size-3" />
            Arraste
          </span>
        )}
      </div>
      <div
        className="relative overflow-hidden w-full"
        style={{
          aspectRatio: `${w} / ${h}`,
          background: 'repeating-linear-gradient(90deg, rgba(255,255,255,.025) 0, rgba(255,255,255,.025) 12.5%, transparent 12.5%, transparent 25%), linear-gradient(180deg, #167934 0%, #0b4a20 100%)',
          borderRadius: 18,
          border: `3px solid ${teamColor}`,
          boxShadow: `0 0 0 1px ${teamColor}30, inset 0 0 60px rgba(0,0,0,.18), 0 14px 36px rgba(0,0,0,0.22)`,
        }}
      >
        <FieldLines w={w} h={h} flip={flip} format={format} />

        {players.map(({ player, x, y }, index) => (
          <DraggablePlayer
            key={player.id}
            player={player}
            x={x}
            y={y}
            teamColor={teamColor}
            teamName={teamName}
            onDragEnd={onDragEnd}
            editable={editable}
            compact={compact}
            flip={flip}
            format={format}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Main export ─── */
interface DraggablePitchProps {
  teamA: Player[];
  teamB: Player[];
  teamAName?: string;
  teamBName?: string;
  teamAColor?: string;
  teamBColor?: string;
  compact?: boolean;
  format?: MatchFormat;
  editable?: boolean;
  fieldPositions?: FieldPositions;
  onPositionsChange?: (positions: FieldPositions) => void;
}

export function DraggablePitch({
  teamA,
  teamB,
  teamAName = 'Time Verde',
  teamBName = 'Time Branco',
  teamAColor = '#16a34a',
  teamBColor = '#3b82f6',
  compact = false,
  format = 'F7',
  editable = false,
  fieldPositions,
  onPositionsChange,
}: DraggablePitchProps) {
  const [positions, setPositions] = useState<FieldPositions>({});
  const cleanTeamA = useMemo(() => dedupePlayers(teamA), [teamA]);
  const teamAIdentities = useMemo(() => new Set(cleanTeamA.map(playerIdentity)), [cleanTeamA]);
  const cleanTeamB = useMemo(() => dedupePlayers(teamB, teamAIdentities), [teamB, teamAIdentities]);

  useEffect(() => {
    if (fieldPositions && Object.keys(fieldPositions).length > 0) {
      setPositions(fieldPositions);
    } else {
      const defaultsA = assignFormationPositions(cleanTeamA, format);
      const defaultsB = assignFormationPositions(cleanTeamB, format);
      const initial: FieldPositions = {};
      [...defaultsA, ...defaultsB].forEach(({ player, x, y }) => {
        initial[player.id] = { x, y };
      });
      setPositions(initial);
    }
  }, [fieldPositions, cleanTeamA, cleanTeamB, format]);

  // Notify parent of position changes
  const handleDragEnd = useCallback(
    (playerId: string, x: number, y: number) => {
      const newPositions = { ...positions, [playerId]: { x, y } };
      setPositions(newPositions);
      onPositionsChange?.(newPositions);
    },
    [positions, onPositionsChange]
  );

  const placedA = useMemo(() => {
    return cleanTeamA.map((player) => ({
      player,
      x: positions[player.id]?.x ?? 50,
      y: positions[player.id]?.y ?? 50,
    }));
  }, [cleanTeamA, positions]);

  const placedB = useMemo(() => {
    return cleanTeamB.map((player) => ({
      player,
      x: positions[player.id]?.x ?? 50,
      y: positions[player.id]?.y ?? 50,
    }));
  }, [cleanTeamB, positions]);

  // Adjust field dimensions based on format
  const getDimensions = () => {
    if (compact) {
      return format === 'F5' ? { w: 260, h: 330 } : format === 'F7' ? { w: 280, h: 370 } : { w: 300, h: 410 };
    }
    return format === 'F5' ? { w: 240, h: 320 } : format === 'F7' ? { w: 280, h: 400 } : { w: 320, h: 480 };
  };

  const { w, h } = getDimensions();

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <PitchHalf
        teamName={teamAName}
        teamColor={teamAColor}
        players={placedA}
        w={w}
        h={h}
        compact={compact}
        flip={false}
        format={format}
        editable={editable}
        onDragEnd={handleDragEnd}
      />
      <PitchHalf
        teamName={teamBName}
        teamColor={teamBColor}
        players={placedB}
        w={w}
        h={h}
        compact={compact}
        flip={false}
        format={format}
        editable={editable}
        onDragEnd={handleDragEnd}
      />
    </div>
  );
}
