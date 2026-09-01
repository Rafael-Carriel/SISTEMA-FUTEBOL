'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical, MousePointer2 } from 'lucide-react';
import type { Player, Position, MatchFormat, FieldPositions } from '@/lib/fut-types';

/* ─── helpers ─── */
function initials(player: Player): string {
  return (player.nickname || player.name)
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/* ─── default position coordinates by format ─── */
const DEFAULT_POSITIONS: Record<MatchFormat, Record<Position, { x: number; y: number }[]>> = {
  F5: {
    GOL: [{ x: 50, y: 92 }],
    ZAG: [{ x: 30, y: 70 }, { x: 70, y: 70 }],
    MEI: [{ x: 50, y: 50 }],
    ATA: [{ x: 30, y: 28 }, { x: 70, y: 28 }],
  },
  F7: {
    GOL: [{ x: 50, y: 92 }],
    ZAG: [{ x: 25, y: 72 }, { x: 50, y: 68 }, { x: 75, y: 72 }],
    MEI: [{ x: 30, y: 48 }, { x: 50, y: 44 }, { x: 70, y: 48 }],
    ATA: [{ x: 35, y: 24 }, { x: 65, y: 24 }],
  },
  F11: {
    GOL: [{ x: 50, y: 94 }],
    ZAG: [{ x: 20, y: 76 }, { x: 40, y: 72 }, { x: 60, y: 72 }, { x: 80, y: 76 }],
    MEI: [{ x: 25, y: 52 }, { x: 50, y: 48 }, { x: 75, y: 52 }, { x: 15, y: 56 }, { x: 85, y: 56 }],
    ATA: [{ x: 30, y: 28 }, { x: 50, y: 24 }, { x: 70, y: 28 }],
  },
};

function getDefaultPositions(
  players: Player[],
  format: MatchFormat = 'F7'
): Array<{ player: Player; x: number; y: number }> {
  const byPos: Record<Position, Player[]> = { GOL: [], ZAG: [], MEI: [], ATA: [] };
  players.forEach((p) => byPos[p.position].push(p));

  const result: Array<{ player: Player; x: number; y: number }> = [];
  const coords = DEFAULT_POSITIONS[format];
  for (const pos of ['GOL', 'ZAG', 'MEI', 'ATA'] as Position[]) {
    const posCoords = coords[pos];
    byPos[pos].forEach((player, idx) => {
      const coord = posCoords[idx] || posCoords[posCoords.length - 1];
      result.push({ player, x: coord.x, y: coord.y });
    });
  }
  return result;
}

/* ─── SVG field markings ─── */
function FieldLines({
  w,
  h,
  flip,
  format,
}: { w: number; h: number; flip: boolean; format: MatchFormat }) {
  const half = h / 2;
  const goalY = flip ? h - h * 0.15 : 0;
  const goalSmallY = flip ? h - h * 0.05 : 0;
  const penSpotY = flip ? h - h * 0.1 : h * 0.1;

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
}: DraggablePlayerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const size = compact ? 36 : 48;
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
      className="absolute flex flex-col items-center transition-transform duration-75"
      style={{
        left: `${displayX}%`,
        top: `${displayY}%`,
        transform: 'translate(-50%,-50%)',
        zIndex: isDragging ? 100 : 10,
        cursor: editable ? (isDragging ? 'grabbing' : 'grab') : 'default',
        touchAction: editable ? 'none' : 'auto',
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
      {!compact && (
        <span
          className="mt-1 max-w-[80px] truncate text-center font-bold select-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
          style={{ fontSize: nameFontSize, color: '#fff' }}
        >
          {player.nickname}
        </span>
      )}
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
  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-[280px]">
      <div className="flex items-center gap-2 w-full">
        <h4 className="text-xs font-black uppercase tracking-wider" style={{ color: teamColor }}>
          {teamName}
        </h4>
        {editable && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
            <MousePointer2 className="size-3" />
            <MousePointer2 className="size-3" />
            Arraste os jogadores
          </span>
        )}
      </div>
      <div
        className="relative overflow-hidden w-full"
        style={{
          aspectRatio: `${w} / ${h}`,
          background: 'linear-gradient(180deg, #1a7a2e 0%, #0f4d1a 100%)',
          borderRadius: 14,
          border: `3px solid ${teamColor}`,
          boxShadow: `0 0 0 1px ${teamColor}30, 0 8px 32px rgba(0,0,0,0.25)`,
        }}
      >
        <FieldLines w={w} h={h} flip={flip} format={format} />

        {players.map(({ player, x, y }) => (
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

  // Initialize positions from fieldPositions prop or generate defaults
  useEffect(() => {
    if (fieldPositions && Object.keys(fieldPositions).length > 0) {
      setPositions(fieldPositions);
    } else {
      const defaults = getDefaultPositions([...teamA, ...teamB], format);
      const initial: FieldPositions = {};
      defaults.forEach(({ player, x, y }) => {
        initial[player.id] = { x, y };
      });
      setPositions(initial);
    }
  }, [fieldPositions, teamA, teamB, format]);

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
    return teamA.map((player) => ({
      player,
      x: positions[player.id]?.x ?? 50,
      y: positions[player.id]?.y ?? 50,
    }));
  }, [teamA, positions]);

  const placedB = useMemo(() => {
    return teamB.map((player) => ({
      player,
      x: positions[player.id]?.x ?? 50,
      y: positions[player.id]?.y ?? 50,
    }));
  }, [teamB, positions]);

  // Adjust field dimensions based on format
  const getDimensions = () => {
    if (compact) {
      // Smaller dimensions for dialog preview to fit side-by-side
      return format === 'F5' ? { w: 150, h: 220 } : format === 'F7' ? { w: 165, h: 240 } : { w: 175, h: 260 };
    }
    return format === 'F5' ? { w: 240, h: 320 } : format === 'F7' ? { w: 280, h: 400 } : { w: 320, h: 480 };
  };

  const { w, h } = getDimensions();

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
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
        flip={true}
        format={format}
        editable={editable}
        onDragEnd={handleDragEnd}
      />
    </div>
  );
}