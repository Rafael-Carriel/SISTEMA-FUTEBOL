'use client';

import { useMemo } from 'react';
import type { Player, Position } from '@/lib/fut-types';

/* ─── helpers ─── */
function initials(player: Player): string {
  return (player.nickname || player.name)
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/* ─── position layout coordinates ─── */
const POSITION_COORDS: Record<Position, { x: number; y: number }[]> = {
  GOL: [{ x: 50, y: 90 }],
  ZAG: [
    { x: 25, y: 74 },
    { x: 50, y: 70 },
    { x: 75, y: 74 },
    { x: 15, y: 76 },
    { x: 85, y: 76 },
  ],
  MEI: [
    { x: 20, y: 52 },
    { x: 50, y: 48 },
    { x: 80, y: 52 },
    { x: 35, y: 56 },
    { x: 65, y: 56 },
    { x: 10, y: 54 },
    { x: 90, y: 54 },
  ],
  ATA: [
    { x: 30, y: 26 },
    { x: 50, y: 22 },
    { x: 70, y: 26 },
    { x: 40, y: 32 },
    { x: 60, y: 32 },
  ],
};

function getPositionCoords(count: number, position: Position): { x: number; y: number }[] {
  const base = POSITION_COORDS[position];
  if (count <= base.length) return base.slice(0, count);
  const result = [...base];
  for (let i = 0; i < count - base.length; i++) {
    const anchor = base[base.length - 1];
    result.push({ x: anchor.x + (i % 2 === 0 ? -8 : 8), y: anchor.y + (i % 2 === 0 ? 3 : -3) });
  }
  return result;
}

function assignPositions(players: Player[]): Array<{ player: Player; x: number; y: number }> {
  const byPos: Record<Position, Player[]> = { GOL: [], ZAG: [], MEI: [], ATA: [] };
  players.forEach((p) => byPos[p.position].push(p));

  const result: Array<{ player: Player; x: number; y: number }> = [];
  for (const pos of ['GOL', 'ZAG', 'MEI', 'ATA'] as Position[]) {
    const coords = getPositionCoords(byPos[pos].length, pos);
    byPos[pos].forEach((player, idx) => {
      result.push({ player, x: coords[idx].x, y: coords[idx].y });
    });
  }
  return result;
}

/* ─── SVG field markings ─── */
function FieldLines({ w, h, flip }: { w: number; h: number; flip: boolean }) {
  const half = h / 2;
  const goalY = flip ? h - h * 0.18 : 0;
  const goalSmallY = flip ? h - h * 0.06 : 0;
  const penSpotY = flip ? h - h * 0.11 : h * 0.11;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    >
      {/* half-way */}
      <line x1="0" y1={half} x2={w} y2={half} stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeDasharray="6,6" />
      {/* center circle */}
      <circle cx={w / 2} cy={half} r={w * 0.14} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
      <circle cx={w / 2} cy={half} r="2.5" fill="rgba(255,255,255,0.5)" />
      {/* penalty area */}
      <rect x={w * 0.1} y={goalY} width={w * 0.8} height={h * 0.18} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
      {/* goal area */}
      <rect x={w * 0.3} y={goalSmallY} width={w * 0.4} height={h * 0.06} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
      {/* pen spot */}
      <circle cx={w / 2} cy={penSpotY} r="2.5" fill="rgba(255,255,255,0.5)" />
    </svg>
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
}

function PitchHalf({ teamName, teamColor, players, w, h, compact, flip }: PitchHalfProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <h4 className="text-xs font-black uppercase tracking-wider" style={{ color: teamColor }}>
        {teamName}
      </h4>
      <div
        className="relative overflow-hidden"
        style={{
          width: w,
          height: h,
          background: 'linear-gradient(180deg, #1a7a2e 0%, #0f4d1a 100%)',
          borderRadius: 14,
          border: `3px solid ${teamColor}`,
          boxShadow: `0 0 0 1px ${teamColor}30, 0 8px 32px rgba(0,0,0,0.25)`,
        }}
      >
        <FieldLines w={w} h={h} flip={flip} />

        {players.map(({ player, x, y }) => {
          const px = flip ? 100 - x : x;
          const py = flip ? 100 - y : y;
          return (
            <div
              key={player.id}
              className="pointer-events-none absolute flex flex-col items-center"
              style={{ left: `${px}%`, top: `${py}%`, transform: 'translate(-50%,-50%)', zIndex: 10 }}
            >
              <div className="relative" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}>
                <span
                  className="relative grid size-9 place-items-center overflow-hidden rounded-full border-2 text-[9px] font-black"
                  style={{ background: teamColor, borderColor: '#fff', color: '#fff' }}
                >
                  {player.photoUrl ? (
                    <img src={player.photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(player)
                  )}
                </span>
                <span
                  className="absolute -bottom-1 -right-1 grid size-[18px] place-items-center rounded-full border-2 text-[7px] font-black text-white"
                  style={{ background: teamColor, borderColor: '#fff' }}
                >
                  {player.number}
                </span>
              </div>
              {!compact && (
                <span className="mt-0.5 max-w-[60px] truncate text-center text-[9px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {player.nickname}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── main export ─── */
interface PitchViewProps {
  teamA: Player[];
  teamB: Player[];
  teamAName?: string;
  teamBName?: string;
  teamAColor?: string;
  teamBColor?: string;
  compact?: boolean;
}

export function PitchView({
  teamA,
  teamB,
  teamAName = 'Time Verde',
  teamBName = 'Time Branco',
  teamAColor = '#16a34a',
  teamBColor = '#3b82f6',
  compact = false,
}: PitchViewProps) {
  const placedA = useMemo(() => assignPositions(teamA), [teamA]);
  const placedB = useMemo(() => assignPositions(teamB), [teamB]);

  const w = compact ? 180 : 260;
  const h = compact ? 280 : 400;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <PitchHalf teamName={teamAName} teamColor={teamAColor} players={placedA} w={w} h={h} compact={compact} flip={false} />
      <PitchHalf teamName={teamBName} teamColor={teamBColor} players={placedB} w={w} h={h} compact={compact} flip={true} />
    </div>
  );
}
