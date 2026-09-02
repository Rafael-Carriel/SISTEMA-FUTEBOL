'use client';

import { useMemo } from 'react';
import type { MatchFormat, Player } from '@/lib/fut-types';
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
  const ids = new Set<string>();
  const people = new Set(blocked);
  return players.filter((player) => {
    const identity = playerIdentity(player);
    if (ids.has(player.id) || people.has(identity)) return false;
    ids.add(player.id);
    people.add(identity);
    return true;
  });
}

/* ─── SVG field markings ─── */
function FieldLines({ w, h, flip, format }: { w: number; h: number; flip: boolean; format: MatchFormat }) {
  const half = h / 2;
  const goalY = flip ? 0 : h - h * 0.18;
  const goalSmallY = flip ? 0 : h - h * 0.06;
  const penSpotY = flip ? h * 0.11 : h - h * 0.11;

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
      <line x1="0" y1={half} x2={w} y2={half} stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeDasharray="6,6" />
      <circle cx={w / 2} cy={half} r={centerCircleR} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
      <circle cx={w / 2} cy={half} r="2.5" fill="rgba(255,255,255,0.5)" />
      <rect x={(w - penaltyWidth) / 2} y={goalY} width={penaltyWidth} height={penaltyHeight} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
      <rect x={(w - goalWidth) / 2} y={goalSmallY} width={goalWidth} height={goalHeight} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
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
  format: MatchFormat;
}

function PitchHalf({ teamName, teamColor, players, w, h, compact, flip, format }: PitchHalfProps) {
  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-[280px]">
      <h4 className="text-xs font-black uppercase tracking-wider w-full" style={{ color: teamColor }}>
        {teamName}
      </h4>
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
              <span className="mt-1 max-w-[72px] truncate text-center font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" style={{ fontSize: compact ? '8px' : '9px', lineHeight: '1' }} title={`${player.nickname} #${player.number}`}>
                {player.nickname}
              </span>
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
  format?: MatchFormat;
}

export function PitchView({
  teamA,
  teamB,
  teamAName = 'Time Verde',
  teamBName = 'Time Branco',
  teamAColor = '#16a34a',
  teamBColor = '#3b82f6',
  compact = false,
  format = 'F7',
}: PitchViewProps) {
  const cleanTeamA = useMemo(() => dedupePlayers(teamA), [teamA]);
  const blocked = useMemo(() => new Set(cleanTeamA.map(playerIdentity)), [cleanTeamA]);
  const cleanTeamB = useMemo(() => dedupePlayers(teamB, blocked), [teamB, blocked]);
  const placedA = useMemo(() => assignFormationPositions(cleanTeamA, format), [cleanTeamA, format]);
  const placedB = useMemo(() => assignFormationPositions(cleanTeamB, format), [cleanTeamB, format]);

  // Adjust dimensions based on format
  const getDimensions = () => {
    if (compact) {
      return format === 'F5' ? { w: 160, h: 200 } : format === 'F7' ? { w: 180, h: 280 } : { w: 200, h: 320 };
    }
    return format === 'F5' ? { w: 240, h: 320 } : format === 'F7' ? { w: 260, h: 400 } : { w: 300, h: 480 };
  };

  const { w, h } = getDimensions();

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
      <PitchHalf teamName={teamAName} teamColor={teamAColor} players={placedA} w={w} h={h} compact={compact} flip={false} format={format} />
      <PitchHalf teamName={teamBName} teamColor={teamBColor} players={placedB} w={w} h={h} compact={compact} flip={false} format={format} />
    </div>
  );
}
