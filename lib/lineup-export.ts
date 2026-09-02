import type { FieldPositions, Match, Player, Position } from './fut-types';

/* ─── default position layout (same as pitch-view) ─── */
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

function assignDefaultPositions(players: Player[]): Array<{ player: Player; x: number; y: number }> {
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

function resolvePositions(
  players: Player[],
  fieldPositions?: FieldPositions,
): Array<{ player: Player; x: number; y: number }> {
  if (fieldPositions && Object.keys(fieldPositions).length > 0) {
    return players.map((player) => ({
      player,
      x: fieldPositions[player.id]?.x ?? 50,
      y: fieldPositions[player.id]?.y ?? 50,
    }));
  }
  return assignDefaultPositions(players);
}

function initials(player: Player): string {
  return (player.nickname || player.name)
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/* ─── draw field lines on canvas ─── */
function drawFieldLines(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  fw: number,
  fh: number,
) {
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;

  // border
  ctx.strokeRect(ox, oy, fw, fh);

  // half line
  ctx.beginPath();
  ctx.moveTo(ox, oy + fh / 2);
  ctx.lineTo(ox + fw, oy + fh / 2);
  ctx.stroke();

  // center circle
  ctx.beginPath();
  ctx.arc(ox + fw / 2, oy + fh / 2, fw * 0.14, 0, Math.PI * 2);
  ctx.stroke();

  // penalty area
  const paH = fh * 0.18;
  ctx.strokeRect(ox + fw * 0.1, oy, fw * 0.8, paH);

  // goal area
  const gaH = fh * 0.06;
  ctx.strokeRect(ox + fw * 0.3, oy, fw * 0.4, gaH);

  // bottom penalty & goal area
  ctx.strokeRect(ox + fw * 0.1, oy + fh - paH, fw * 0.8, paH);
  ctx.strokeRect(ox + fw * 0.3, oy + fh - gaH, fw * 0.4, gaH);

  // center dot
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(ox + fw / 2, oy + fh / 2, 3, 0, Math.PI * 2);
  ctx.fill();
}

/* ─── draw one team on a field ─── */
function drawTeam(
  ctx: CanvasRenderingContext2D,
  players: Array<{ player: Player; x: number; y: number }>,
  ox: number,
  oy: number,
  fw: number,
  fh: number,
  teamColor: string,
  flip: boolean,
) {
  const R = 22; // circle radius

  for (const { player, x, y } of players) {
    const px = ox + (flip ? 100 - x : x) * fw / 100;
    const py = oy + (flip ? 100 - y : y) * fh / 100;

    // shadow
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    // circle background
    ctx.beginPath();
    ctx.arc(px, py, R, 0, Math.PI * 2);
    ctx.fillStyle = teamColor;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // initials inside circle
    ctx.fillStyle = '#fff';
    ctx.font = '900 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(player), px, py);

    // number badge
    const bx = px + R * 0.65;
    const by = py + R * 0.65;
    ctx.beginPath();
    ctx.arc(bx, by, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx, by, 10, 0, Math.PI * 2);
    ctx.fillStyle = teamColor;
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '900 11px Arial';
    ctx.fillText(String(player.number), bx, by);

    // name label below
    const name = player.nickname;
    ctx.font = '900 13px Arial';
    const tw = ctx.measureText(name).width;
    const lw = tw + 14;
    const lh = 22;
    const lx = px - lw / 2;
    const ly = py + R + 6;

    // white bg box
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.roundRect(lx, ly, lw, lh, 6);
    ctx.fill();

    // name text
    ctx.fillStyle = '#0b1710';
    ctx.font = '900 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, px, ly + lh / 2);
  }

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

/* ─── main export ─── */
export type LineupExportFormat = 'png' | 'jpeg';

export async function exportLineup(
  match: Match,
  players: Player[],
  options: { format?: LineupExportFormat; quality?: number } = {},
): Promise<void> {
  const { format = 'png', quality = 0.92 } = options;
  const teamAPlayers = match.teamA.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  const teamBPlayers = match.teamB.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];

  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#07100b');
  grad.addColorStop(1, '#14271a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Title bar
  ctx.fillStyle = '#baff55';
  ctx.font = '900 28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('NA TRAVE', W / 2, 50);

  // Match title
  ctx.fillStyle = '#fff';
  ctx.font = '900 36px Arial';
  ctx.fillText(`${match.teamAName}  vs  ${match.teamBName}`, W / 2, 100);

  // Subtitle
  const dateStr = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${match.date}T12:00:00`));
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '700 18px Arial';
  ctx.fillText(`${match.title}  ·  ${dateStr}  ·  ${match.time}  ·  ${match.venue}`, W / 2, 135);

  // Two fields side by side
  const gap = 30;
  const fieldW = (W - gap * 3) / 2;
  const fieldH = H - 220;
  const fieldY = 170;
  const fieldAX = gap;
  const fieldBX = gap * 2 + fieldW;

  // Field backgrounds
  for (const fx of [fieldAX, fieldBX]) {
    const fieldGrad = ctx.createLinearGradient(0, fieldY, 0, fieldY + fieldH);
    fieldGrad.addColorStop(0, '#1a7a2e');
    fieldGrad.addColorStop(1, '#0f4d1a');
    ctx.fillStyle = fieldGrad;
    ctx.beginPath();
    ctx.roundRect(fx, fieldY, fieldW, fieldH, 16);
    ctx.fill();
  }

  // Draw field lines
  drawFieldLines(ctx, fieldAX, fieldY, fieldW, fieldH);
  drawFieldLines(ctx, fieldBX, fieldY, fieldW, fieldH);

  // Resolve positions
  const placedA = resolvePositions(teamAPlayers, match.fieldPositions);
  const placedB = resolvePositions(teamBPlayers, match.fieldPositions);

  // Draw teams
  drawTeam(ctx, placedA, fieldAX, fieldY, fieldW, fieldH, '#16a34a', false);
  drawTeam(ctx, placedB, fieldBX, fieldY, fieldW, fieldH, '#3b82f6', false);

  // Team labels
  ctx.textAlign = 'center';
  ctx.fillStyle = '#16a34a';
  ctx.font = '900 22px Arial';
  ctx.fillText(match.teamAName, fieldAX + fieldW / 2, fieldY - 8);
  ctx.fillStyle = '#3b82f6';
  ctx.fillText(match.teamBName, fieldBX + fieldW / 2, fieldY - 8);

  // Score
  ctx.fillStyle = '#baff55';
  ctx.font = '900 52px Arial';
  ctx.fillText(`${match.scoreA} — ${match.scoreB}`, W / 2, H - 25);

  // Bottom branding
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '700 14px Arial';
  ctx.fillText('NA TRAVE · Fut da galera', W / 2, H - 6);

  // Download
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const link = document.createElement('a');
  const teamANick = match.teamAName.toLowerCase().replaceAll(/\s+/g, '-');
  const teamBNick = match.teamBName.toLowerCase().replaceAll(/\s+/g, '-');
  link.download = `escalacao-${match.date}-${teamANick}-vs-${teamBNick}.${format}`;
  link.href = canvas.toDataURL(mime, quality);
  link.click();
}
