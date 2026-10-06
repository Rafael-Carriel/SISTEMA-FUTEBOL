/**
 * Exportação da escalação em imagem (PNG/JPEG).
 *
 * Desenha um card pronto para compartilhar: campo inteiro, um time em cada
 * metade, nomes e números legíveis em qualquer tamanho de tela.
 *
 * O layout é derivado do `FullPitchView` (components/pitch-view.tsx) para que a
 * imagem exportada seja fiel ao que o usuário vê no app.
 */
import type { FieldPositions, Match, MatchFormat, Player } from './fut-types';
import { assignFormationPlayers } from './formation-layout';
import { calcOverall } from './player-rating';
import { readableTextColor, teamAccent } from './color-utils';

/* ─── canvas + identidade visual ─── */
/**
 * Cartão vertical. A altura não é escolha estética: sai do requisito mais
 * apertado, que é campo de 11 com as quatro linhas do 4-4-2 mais o banco de
 * reservas. Há um teste que falha se alguém diminuir o cartão abaixo disso.
 */
export const LINEUP_EXPORT_SIZE = { width: 1080, height: 2100 } as const;

const FONT = "'Arial Black', 'Segoe UI', system-ui, Arial, sans-serif";
const FONT_BODY = "'Segoe UI', system-ui, Arial, sans-serif";

const C = {
  brand: '#baff55',
  shellTop: '#06120c',
  shellBottom: '#0d2417',
  grassTop: '#1a8a44',
  grassMid: '#0c6231',
  grassBottom: '#064d26',
  teamA: '#22c55e',
  teamB: '#3b82f6',
} as const;

/** Área do campo. Mais alta do que larga porque as linhas são empilhadas. */
export const LINEUP_FIELD = { x: 40, y: 196, w: 1000, h: 1420 } as const;

const FIELD = LINEUP_FIELD;

type Placed = { player: Player; x: number; y: number };

/** Metade do campo onde o time fica: visitante em cima, mandante embaixo. */
export type Half = 'top' | 'bottom';

/* ─── helpers ─── */
function initials(player: Player): string {
  const base = (player.nickname || player.name || '').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function shortName(player: Player): string {
  const base = (player.nickname || player.name || '').trim();
  if (base.length <= 14) return base;
  const first = base.split(/\s+/)[0];
  return first.length >= 4 ? first : base.slice(0, 14).trim();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, Math.min(w, h) / 2)));
}

/** Encolhe a fonte até o texto caber em `maxWidth`. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  family: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
  weight = 900,
): number {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  ctx.font = `${weight} ${size}px ${family}`;
  return size;
}

/**
 * Posições finais de um time no campo inteiro.
 *
 * Quando a partida não tem posições salvas, usa o esquema tático do formato
 * (F5/F7/F11), exatamente como o resto do app. Posições salvas são lidas por
 * jogador — cada time tem as suas — e nunca misturadas com as do adversário.
 */
export function resolveTeamFieldPositions(
  players: Player[],
  format: MatchFormat,
  fieldPositions?: FieldPositions,
  goalkeeperId?: string,
  formationId?: string,
): Placed[] {
  if (fieldPositions && Object.keys(fieldPositions).length > 0) {
    return players.map((player) => ({
      player,
      x: fieldPositions[player.id]?.x ?? 50,
      y: fieldPositions[player.id]?.y ?? 50,
    }));
  }
  return assignFormationPlayers(players, format, formationId, goalkeeperId).map(({ player, x, y }) => ({
    player,
    x,
    y,
  }));
}

/** Jogador já posicionado no campo inteiro, em pixels. */
type Spot = { player: Player; x: number; y: number };

/**
 * Distribui um time na sua metade do campo, a partir do desenho do esquema.
 *
 * O esquema escolhido manda no formato do time (largura das linhas, quantos atrás
 * e quantos na frente). O que a exportação ajusta é só o que precisa caber:
 *
 * 1. **O goleiro nunca fica sobre a linha do gol** — é ancorado a uma distância
 *    fixa do fundo.
 * 2. **Linhas que o esquema desenha muito juntas são afastadas** até a camisa +
 *    o nome de uma não encostarem na de cima. É o caso do 4-4-2, em que a linha
 *    de meio e a de zaga ficam a 4% uma da outra.
 * 3. **Dentro de cada linha, a largura do esquema é preservada** — só é aberta o
 *    suficiente para duas camisas não se sobreporem. Sem isso o 4-4-2 virava uma
 *    fila indiana no meio do campo.
 *
 * Posições salvas no quadro tático (modo `custom`) são respeitadas como
 * coordenadas, com um empurrão leve só para nada ficar ilegível.
 */
export function layoutTeamOnPitch(
  placed: Placed[],
  half: Half,
  radius: number,
  mode: 'formation' | 'custom' = 'formation',
): Spot[] {
  const marginX = 18;
  const marginY = 10;

  const clampX = (x: number) => Math.max(FIELD.x + marginX, Math.min(FIELD.x + FIELD.w - marginX, x));
  const halfStart = FIELD.y;
  const halfEnd = FIELD.y + FIELD.h / 2;
  const roomTop = half === 'top' ? halfStart : halfEnd;
  const roomBottom = half === 'top' ? halfEnd : FIELD.y + FIELD.h;
  // o goleiro é a única linha que pode chegar perto da linha do gol; as outras
  // respeitam a margem (raio + folga), senão a camisa encosta na borda do campo
  const clampY = (y: number) => Math.max(roomTop + marginY, Math.min(roomBottom - marginY, y));
  const clampYRow = (y: number, isKeeperRow: boolean) =>
    isKeeperRow
      ? Math.max(roomTop + radius, Math.min(roomBottom - radius, y))
      : Math.max(roomTop + radius + 6, Math.min(roomBottom - radius - 6, y));

  if (!placed.length) return [];

  // quadrante do jogador dentro do campo: bottom = gol no fim do campo
  const toScreenY = (value: number) => {
    const unit = Math.max(0, Math.min(100, value)) / 100;
    return half === 'bottom' ? roomBottom - unit * (roomBottom - roomTop) : roomTop + unit * (roomBottom - roomTop);
  };

  if (mode === 'custom') {
    const minDx = radius * 2 + 12;
    const minDy = radius * 2 + 46;
    // As posições salvas já vêm em coordenadas de tela do quadro tático (y = 0
    // no topo), então aqui NÃO se aplica a inversão de quadrante — inverter de
    // novo trocava goleiro e ataque de lugar.
    const home = placed.map((item) => ({
      player: item.player,
      x: clampX(FIELD.x + (Math.max(2, Math.min(98, item.x)) / 100) * FIELD.w),
      y: clampY(FIELD.y + (Math.max(2, Math.min(98, item.y)) / 100) * FIELD.h),
    }));
    const spots: Spot[] = home.map((item) => ({ ...item }));
    // Empurra os dois lados do par e, em cada passo, puxa de volta para a posição
    // que o usuário salvou. Sem o puxão o conjunto ia parar na borda do campo.
    const restore = 0.18;
    for (let pass = 0; pass < 60; pass += 1) {
      let moved = false;
      for (let index = 0; index < spots.length; index += 1) {
        const spot = spots[index];
        const target = home[index];
        spot.x += (target.x - spot.x) * restore;
        spot.y += (target.y - spot.y) * restore;
      }
      for (let i = 0; i < spots.length; i += 1) {
        for (let j = i + 1; j < spots.length; j += 1) {
          const a = spots[i];
          const b = spots[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const overlapX = minDx - Math.abs(dx);
          const overlapY = minDy - Math.abs(dy);
          if (overlapX <= 0 || overlapY <= 0) continue;
          moved = true;
          if (overlapX < overlapY) {
            const half = (overlapX / 2) * (dx >= 0 ? 1 : -1);
            a.x = clampX(a.x - half);
            b.x = clampX(b.x + half);
          } else {
            const half = (overlapY / 2) * (dy >= 0 ? 1 : -1);
            a.y = clampY(a.y - half);
            b.y = clampY(b.y + half);
          }
        }
      }
      if (!moved && pass > 0) break;
    }
    return spots;
  }

  // ─── modo esquema ───
  // 1. agrupa em linhas (tolerância pequena: o esquema marca linha com o mesmo Y,
  //    e o F11 usa 76/80 para abrir um pouco os laterais da zaga)
  const order = [...placed].sort((a, b) => a.y - b.y);
  const rowGroups: Placed[][] = [];
  for (const item of order) {
    const last = rowGroups[rowGroups.length - 1];
    if (last && Math.abs(last[last.length - 1].y - item.y) <= 8) last.push(item);
    else rowGroups.push([item]);
  }

  const rowY = rowGroups.map((row) => row[0].y); // 0 = ataque … 100 = gol
  const total = rowGroups.length;

  // 2. acha a posição de cada linha dentro da metade.
  //
  //    As proporções do esquema são sagradas (se o 4-4-2 desenha a zaga a 18% do
  //    ataque, é assim que vai sair), mas não cabem sempre: no campo de 11 a
  //    soma das linhas passa da metade. Então as proporções são escaladas até
  //    caber e o bloco é CENTRADO na metade — antes o bloco era colado no fundo e
  //    sobrava metade de campo vazio, com o time parecendo torto.
  const room = roomBottom - roomTop;
  const chipHeight = radius * 0.6 + 26;
  const halfHeight = chipHeight / 2;
  const backGapPx = radius + 46 + halfHeight; // goleiro até a linha do gol

  // 3. distância de cada linha até o PRÓPRIO gol, por restrições:
  //    - o goleiro fica a `backGapPx` do fundo;
  //    - cada linha acima respeita a proporção do esquema, mas nunca menos que
  //      `minRowGapPx` (senão o nome de uma invade a camisa da de cima).
  //    Por restrição o espaçamento mínimo é garantido — escalar proporções podia
  //    devolver linhas coladas quando o esquema era muito esticado.
  const minRowGapPx = radius * 2 + 54;
  const desired = rowY.map((value) => ((100 - value) / 100) * room);
  const distances: number[] = new Array(total);
  distances[total - 1] = backGapPx;
  for (let index = total - 2; index >= 0; index -= 1) {
    distances[index] = Math.max(distances[index + 1] + minRowGapPx, desired[index]);
  }

  // 4. bloco centrado na metade: se sobrou espaço, metade vai para o goleiro e
  //    metade para o ataque, em vez de deixar o time colado no fundo
  const roomAfterKeeper = room - backGapPx;
  const slack = roomAfterKeeper - (distances[0] - backGapPx);
  const centring = Math.max(0, Math.min(slack / 2, (0.06 * room)));
  const finalDistance = distances.map((value) => value + centring);

  // 5. pontos finais: cada linha vira coordenada de tela e é aberta na largura
  //    só o necessário para duas camisas não se sobreporem
  const spots: Spot[] = [];
  rowGroups.forEach((row, index) => {
    const targetY = half === 'bottom' ? roomBottom - finalDistance[index] : roomTop + finalDistance[index];
    const line = [...row].sort((a, b) => a.x - b.x);
    const need = radius * 2 + 12;
    const minX = Math.min(...line.map((item) => item.x));
    const maxX = Math.max(...line.map((item) => item.x));
    const spanUnit = maxX - minX;
    const spanPx = (spanUnit / 100) * FIELD.w;
    const stepPx =
      line.length < 2 ? 0 : spanPx >= need * (line.length - 1) ? spanPx / (line.length - 1) : need;
    const totalSpan = stepPx * (line.length - 1);
    const centrePx = FIELD.x + ((minX + maxX) / 2 / 100) * FIELD.w;
    const limitLeft = FIELD.x + marginX + radius;
    const limitRight = FIELD.x + FIELD.w - marginX - radius - totalSpan;
    const start = Math.max(limitLeft, Math.min(limitRight, centrePx - totalSpan / 2));
    line.forEach((item, position) => {
      spots.push({
        player: item.player,
        x: line.length === 1 ? clampX(centrePx) : clampX(start + stepPx * position),
        y: Math.max(roomTop + radius, Math.min(roomBottom - radius, targetY)),
      });
    });
  });

  return spots;
}

function teamOverall(placed: Placed[]): number {
  if (!placed.length) return 0;
  return Math.round(placed.reduce((sum, item) => sum + calcOverall(item.player), 0) / placed.length);
}

/* ─── fundo / moldura ─── */
function drawBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, C.shellTop);
  grad.addColorStop(1, C.shellBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width / 2, FIELD.y, 0, width / 2, FIELD.y, height * 0.7);
  glow.addColorStop(0, 'rgba(186,255,85,.10)');
  glow.addColorStop(1, 'rgba(186,255,85,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Baliza desenhada atrás da linha de fundo, com rede — como numa foto de campo
 * vista de cima. É isso que deixa claro onde é o gol de cada time.
 */
function drawGoal(ctx: CanvasRenderingContext2D, centreX: number, lineY: number, width: number, depth: number, top: boolean) {
  const gx = centreX - width / 2;
  const gy = top ? lineY - depth : lineY;

  ctx.save();
  roundRect(ctx, gx, gy, width, depth, 4);
  ctx.fillStyle = 'rgba(255,255,255,.13)';
  ctx.fill();
  ctx.clip();

  // rede
  ctx.strokeStyle = 'rgba(255,255,255,.4)';
  ctx.lineWidth = 1;
  const mesh = 11;
  for (let mx = gx + mesh; mx < gx + width; mx += mesh) {
    ctx.beginPath();
    ctx.moveTo(mx, gy);
    ctx.lineTo(mx, gy + depth);
    ctx.stroke();
  }
  for (let my = gy + mesh; my < gy + depth; my += mesh) {
    ctx.beginPath();
    ctx.moveTo(gx, my);
    ctx.lineTo(gx + width, my);
    ctx.stroke();
  }
  ctx.restore();

  // travessões e fundo, mais fortes que a rede
  ctx.save();
  roundRect(ctx, gx, gy, width, depth, 4);
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();
}

function drawPitch(ctx: CanvasRenderingContext2D) {
  const { x, y, w, h } = FIELD;

  ctx.save();
  roundRect(ctx, x, y, w, h, 30);
  ctx.clip();

  // grama + listras verticais
  const grass = ctx.createLinearGradient(0, y, 0, y + h);
  grass.addColorStop(0, C.grassTop);
  grass.addColorStop(0.5, C.grassMid);
  grass.addColorStop(1, C.grassBottom);
  ctx.fillStyle = grass;
  ctx.fillRect(x, y, w, h);

  const stripe = w / 10;
  ctx.fillStyle = 'rgba(255,255,255,.045)';
  for (let i = 0; i < 10; i += 2) ctx.fillRect(x + i * stripe, y, stripe, h);

  // vinheta
  const vignette = ctx.createRadialGradient(x + w / 2, y + h / 2, h * 0.15, x + w / 2, y + h / 2, h * 0.72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,.38)');
  ctx.fillStyle = vignette;
  ctx.fillRect(x, y, w, h);

  // ─── marcações ───
  const m = 26; // margem interna das linhas
  const fx = x + m;
  const fy = y + m;
  const fw = w - m * 2;
  const fh = h - m * 2;
  const midY = y + h / 2;
  const centreX = x + w / 2;

  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';

  // gols primeiro, atrás das linhas
  const goalW = fw * 0.26;
  const goalDepth = 30;
  drawGoal(ctx, centreX, fy, goalW, goalDepth, true);
  drawGoal(ctx, centreX, fy + fh, goalW, goalDepth, false);

  // contorno do campo
  ctx.strokeRect(fx, fy, fw, fh);

  // linha e círculo do meio-campo
  ctx.beginPath();
  ctx.moveTo(fx, midY);
  ctx.lineTo(fx + fw, midY);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centreX, midY, fw * 0.135, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,.62)';
  ctx.beginPath();
  ctx.arc(centreX, midY, 5, 0, Math.PI * 2);
  ctx.fill();

  // áreas, marcas do pênalti e meia-lua
  const penW = fw * 0.56;
  const penH = fh * 0.17;
  const smallW = fw * 0.28;
  const smallH = fh * 0.058;
  const arcR = fw * 0.12;

  for (const top of [true, false]) {
    const penY = top ? fy : fy + fh - penH;
    const smallY = top ? fy : fy + fh - smallH;
    ctx.strokeRect(centreX - penW / 2, penY, penW, penH);
    ctx.strokeRect(centreX - smallW / 2, smallY, smallW, smallH);

    // marca do pênalti
    const penY2 = top ? fy + penH * 0.62 : fy + fh - penH * 0.62;
    ctx.fillStyle = 'rgba(255,255,255,.62)';
    ctx.beginPath();
    ctx.arc(centreX, penY2, 5, 0, Math.PI * 2);
    ctx.fill();

    // meia-lua: o pedaço do círculo do pênalti que sobra fora da área
    const arcEdge = top ? fy + penH : fy + fh - penH;
    const half = Math.acos(Math.max(-1, Math.min(1, (arcEdge - penY2) / arcR)));
    ctx.beginPath();
    if (top) ctx.arc(centreX, penY2, arcR, Math.PI / 2 - half, Math.PI / 2 + half);
    else ctx.arc(centreX, penY2, arcR, -Math.PI / 2 - half, -Math.PI / 2 + half);
    ctx.stroke();
  }

  // arcos de canto
  const corner = 26;
  for (const [cx, cy, rot] of [
    [fx, fy, 0],
    [fx + fw, fy, Math.PI / 2],
    [fx + fw, fy + fh, Math.PI],
    [fx, fy + fh, -Math.PI / 2],
  ] as const) {
    ctx.beginPath();
    ctx.arc(cx, cy, corner, rot, rot + Math.PI / 2);
    ctx.stroke();
  }

  ctx.restore();

  // borda do campo
  roundRect(ctx, x, y, w, h, 30);
  ctx.strokeStyle = 'rgba(255,255,255,.32)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

/* ─── jogador ─── */
interface PlayerStyle {
  color: string;
  ink: string;
  radius: number;
  numberSize: number;
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  spot: Spot,
  style: PlayerStyle,
  options: { goalkeeper: boolean },
) {
  const { player, x: cx, y: cy } = spot;
  const { color, ink, radius: R, numberSize } = style;

  if (options.goalkeeper) {
    ctx.beginPath();
    ctx.arc(cx, cy, R + 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(186,255,85,.16)';
    ctx.fill();
  }

  // avatar
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  const photo = player.photoUrl;
  const image = photo ? imageCache.get(photo) : undefined;
  if (image) {
    const size = Math.min(image.width, image.height);
    const sx = (image.width - size) / 2;
    ctx.drawImage(image, sx, 0, size, size, cx - R, cy - R, R * 2, R * 2);
  } else {
    const label = initials(player);
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(R * 0.78)}px ${FONT}`;
    ctx.fillText(label, cx, cy + R * 0.04);
  }
  ctx.restore();

  // anel
  ctx.beginPath();
  ctx.arc(cx, cy, R - 2, 0, Math.PI * 2);
  ctx.strokeStyle = options.goalkeeper ? C.brand : '#ffffff';
  ctx.lineWidth = options.goalkeeper ? 6 : 5;
  ctx.stroke();

  // número
  const bx = cx + R * 0.78;
  const by = cy + R * 0.78;
  const br = numberSize * 0.88;
  ctx.beginPath();
  ctx.arc(bx, by, br + 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(6,18,12,.9)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx, by, br, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.fillStyle = '#06120c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${numberSize}px ${FONT}`;
  ctx.fillText(String(player.number), bx, by + 1);

  // goleiro
  if (options.goalkeeper) {
    const tagW = 46;
    const tagH = 24;
    const tx = cx - R * 0.92;
    const ty = cy - R * 0.92;
    roundRect(ctx, tx - tagW / 2, ty - tagH / 2, tagW, tagH, 8);
    ctx.fillStyle = C.brand;
    ctx.fill();
    ctx.fillStyle = '#06120c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 15px ${FONT}`;
    ctx.fillText('GOL', tx, ty + 1);
  }

  // nome e posição num chip de duas linhas abaixo da camisa. A altura do chip é o
  // que define o espaçamento mínimo entre as linhas — mantenha em sincronia com
  // `chipHeight` em layoutTeamOnPitch.
  const name = shortName(player);
  const roleSize = Math.max(11, Math.round(R * 0.28));
  const size = Math.max(14, Math.round(R * 0.36));
  ctx.font = `800 ${size}px ${FONT_BODY}`;
  const textW = Math.min(ctx.measureText(name).width, R * 2.6);
  const chipW = Math.max(textW, roleSize * 3.1) + 22;
  const chipH = size + roleSize + 13;
  const chipX = Math.max(FIELD.x + 6, Math.min(FIELD.x + FIELD.w - 6 - chipW, cx - chipW / 2));
  const chipY = cy + R + 4;
  const textX = chipX + chipW / 2;

  roundRect(ctx, chipX, chipY, chipW, chipH, 10);
  ctx.fillStyle = 'rgba(6,18,12,.86)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.2)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${size}px ${FONT_BODY}`;
  ctx.fillText(name, textX, chipY + 6 + size / 2);

  ctx.fillStyle = 'rgba(255,255,255,.58)';
  ctx.font = `800 ${roleSize}px ${FONT_BODY}`;
  ctx.fillText(player.position, textX, chipY + chipH - 6 - roleSize / 2);
}

function drawTeam(
  ctx: CanvasRenderingContext2D,
  placed: Placed[],
  half: Half,
  color: string,
  goalkeeperId: string | undefined,
  style: Omit<PlayerStyle, 'color' | 'ink'>,
  mode: 'formation' | 'custom' = 'formation',
) {
  const ink = readableTextColor(color);
  const full: PlayerStyle = { ...style, color, ink };
  const spots = layoutTeamOnPitch(placed, half, style.radius, mode);

  for (const spot of spots) {
    drawPlayer(ctx, spot, full, { goalkeeper: spot.player.id === goalkeeperId });
  }
}

/* ─── cabeçalho / placar / rodapé ─── */
function formatMatchDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(parsed).replace('.', '');
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  match: Match,
  overallA: number,
  overallB: number,
  width: number,
) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // chip da marca
  const brand = 'NA TRAVE';
  ctx.font = `900 24px ${FONT}`;
  const brandW = ctx.measureText(brand).width;
  roundRect(ctx, 40, 44, brandW + 40, 40, 20);
  ctx.fillStyle = C.brand;
  ctx.fill();
  ctx.fillStyle = '#06120c';
  ctx.fillText(brand, 60, 65);

  // formato
  ctx.fillStyle = 'rgba(255,255,255,.42)';
  ctx.font = `800 19px ${FONT_BODY}`;
  ctx.fillText((match.format ?? 'F7').toUpperCase(), 40 + brandW + 60, 65);

  ctx.textAlign = 'right';
  ctx.fillText(`${formatMatchDate(match.date)} · ${match.time}`, width - 40, 65);

  // título
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  const title = match.title || 'Escalação';
  fitFont(ctx, title, FONT, width - 120, 56, 30, 900);
  ctx.fillText(title, width / 2, 136);

  // times + força média
  ctx.font = `800 21px ${FONT_BODY}`;
  ctx.fillStyle = teamAccent(C.teamA);
  ctx.fillText(`${match.teamAName} · ${overallA}`, width * 0.28, 182);
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.fillText('x', width / 2, 182);
  ctx.fillStyle = teamAccent(C.teamB);
  ctx.fillText(`${overallB} · ${match.teamBName}`, width * 0.72, 182);
}

/**
 * Faixa do banco de reservas.
 *
 * Os reservas não entram em campo, então ficam listados em duas colunas com
 * número e posição — quem não jogou continua registrado na imagem.
 */
function drawBench(ctx: CanvasRenderingContext2D, match: Match, bench: Player[], width: number) {
  const top = FIELD.y + FIELD.h + 20;
  const panelH = 300;
  const left = FIELD.x;
  const panelW = width - FIELD.x * 2;

  ctx.save();

  // painel
  roundRect(ctx, left, top, panelW, panelH, 22);
  ctx.fillStyle = 'rgba(255,255,255,.045)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // cabeçalho
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const count = bench.length;
  const heading = count > 0 ? `BANCO · ${count} ${count === 1 ? 'RESERVA' : 'RESERVAS'}` : 'BANCO · SEM RESERVAS';
  ctx.font = `900 17px ${FONT_BODY}`;
  const chipW = ctx.measureText(heading).width + 34;
  roundRect(ctx, left + 22, top + 20, chipW, 34, 17);
  ctx.fillStyle = 'rgba(186,255,85,.16)';
  ctx.fill();
  ctx.fillStyle = C.brand;
  ctx.font = `900 17px ${FONT_BODY}`;
  ctx.fillText(heading, left + 22 + 17, top + 38);

  if (!count) {
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.font = `700 19px ${FONT_BODY}`;
    ctx.textAlign = 'center';
    ctx.fillText('Todos os confirmados estão em campo.', width / 2, top + 120);
    ctx.restore();
    return;
  }

  // duas colunas
  const columnW = (panelW - 44 - 24) / 2;
  const rows = Math.ceil(count / 2);
  const rowH = Math.min(40, (panelH - 96) / Math.max(1, rows));
  for (let index = 0; index < count; index += 1) {
    const column = index < rows ? 0 : 1;
    const line = index < rows ? index : index - rows;
    const x = left + 22 + column * (columnW + 24);
    const y = top + 72 + line * rowH;
    const rowHeight = rowH - 7;

    roundRect(ctx, x, y, columnW, rowHeight, 11);
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.fill();

    // número
    const player = bench[index];
    const centreY = y + rowHeight / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(186,255,85,.9)';
    ctx.font = `900 16px ${FONT}`;
    ctx.fillText(String(player.number), x + 24, centreY);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 17px ${FONT_BODY}`;
    ctx.fillText(player.nickname || player.name, x + 46, centreY);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.font = `800 13px ${FONT_BODY}`;
    ctx.fillText(player.position, x + columnW - 13, centreY);
  }

  ctx.restore();
}

function drawFooter(ctx: CanvasRenderingContext2D, match: Match, width: number, height: number) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // placar
  const scoreY = 1832;
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 76px ${FONT}`;
  ctx.fillText(`${match.scoreA} — ${match.scoreB}`, width / 2, scoreY);

  // divisor
  const divY = 1898;
  const divider = ctx.createLinearGradient(width * 0.2, 0, width * 0.8, 0);
  divider.addColorStop(0, 'rgba(255,255,255,0)');
  divider.addColorStop(0.5, 'rgba(186,255,85,.5)');
  divider.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = divider;
  ctx.fillRect(width * 0.2, divY, width * 0.6, 2);

  // meta
  ctx.fillStyle = 'rgba(255,255,255,.56)';
  ctx.font = `700 19px ${FONT_BODY}`;
  const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    .format(new Date(`${match.date}T12:00:00`));
  ctx.fillText([date, match.time].filter(Boolean).join(' · '), width / 2, divY + 32);

  if (match.venue) {
    ctx.fillStyle = 'rgba(255,255,255,.38)';
    ctx.font = `700 17px ${FONT_BODY}`;
    ctx.fillText(match.venue, width / 2, divY + 60);
  }

  ctx.fillStyle = 'rgba(186,255,85,.5)';
  ctx.font = `800 15px ${FONT_BODY}`;
  ctx.fillText('NA TRAVE · FUT DA GALERA', width / 2, divY + 90);
  ctx.restore();
}

/* ─── imagens (fotos dos jogadores) ─── */
/** Fotos já carregadas, por URL — evita baixar a mesma foto a cada exportação. */
const imageCache = new Map<string, HTMLImageElement>();
const MAX_CACHED_IMAGES = 400;

function loadImages(players: Player[]): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();

  const urls = [...new Set(players.map((p) => p.photoUrl).filter((url): url is string => !!url))];
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const cached = imageCache.get(url);
          if (cached) {
            // devolve para o fim da fila: o Map vira LRU simples
            imageCache.delete(url);
            imageCache.set(url, cached);
            return resolve();
          }
          const image = new Image();
          image.crossOrigin = 'anonymous';
          image.onload = () => {
            imageCache.set(url, image);
            if (imageCache.size > MAX_CACHED_IMAGES) {
              const oldest = imageCache.keys().next().value;
              if (oldest !== undefined) imageCache.delete(oldest);
            }
            resolve();
          };
          image.onerror = () => resolve();
          image.src = url;
        }),
    ),
  ).then(() => undefined);
}

/* ─── render + export ─── */
export type LineupRenderOptions = {
  /** Multiplicador de resolução (1 = 1080x1620, 2 = 2160x3240). */
  scale?: number;
  teamAColor?: string;
  teamBColor?: string;
};

/** Área segura para o canvas em navegadores móveis (Safari/Chrome). */
const MAX_CANVAS_PIXELS = 16_777_216;

/** Desenha a escalação no canvas informado. Reutilizado pelo preview e pelo build. */
export function renderLineupCanvas(
  canvas: HTMLCanvasElement,
  match: Match,
  players: Player[],
  options: LineupRenderOptions = {},
): void {
  const { width, height } = LINEUP_EXPORT_SIZE;
  // 2x é opcional: em celular o canvas 2x passa da área máxima suportada (o que
  // devolveria uma imagem vazia), então nesse caso fica em 1x
  const wanted = Math.max(1, Math.min(2, options.scale ?? 1));
  const scale = wanted * width * height <= MAX_CANVAS_PIXELS ? wanted : 1;

  // Definir width/height zera o contexto, então o scale vem depois.
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (scale !== 1) ctx.scale(scale, scale);

  const byId = new Map(players.map((player) => [player.id, player]));
  const pick = (ids: string[]) =>
    ids.map((id) => byId.get(id)).filter((player): player is Player => Boolean(player));

  const teamAPlayers = pick(match.teamA);
  const teamBPlayers = pick(match.teamB);
  const format = match.format ?? 'F7';

  const placedA = resolveTeamFieldPositions(
    teamAPlayers,
    format,
    match.fieldPositions,
    match.goalkeeperAId,
    match.formationA,
  );
  const placedB = resolveTeamFieldPositions(
    teamBPlayers,
    format,
    match.fieldPositions,
    match.goalkeeperBId,
    match.formationB,
  );

  drawBackdrop(ctx, width, height);
  drawPitch(ctx);

  // camisas menores quando a partida tem mais gente: mantém as linhas
  // espaçadas e o nome legível em futsal, fut6, fut7 e campo
  const largest = Math.max(teamAPlayers.length, teamBPlayers.length, 1);
  const radius = Math.max(40, 48 - largest);
  const shape = { radius, numberSize: Math.round(radius * 0.46) };

  // posições salvas viram coordenadas absolutas do quadro tático; sem elas, o
  // esquema escolhido manda no desenho
  const hasSaved = Boolean(match.fieldPositions && Object.keys(match.fieldPositions).length > 0);
  const mode = hasSaved ? 'custom' : 'formation';

  drawTeam(ctx, placedB, 'top', options.teamBColor ?? C.teamB, match.goalkeeperBId, shape, mode);
  drawTeam(ctx, placedA, 'bottom', options.teamAColor ?? C.teamA, match.goalkeeperAId, shape, mode);

  drawHeader(ctx, match, teamOverall(placedA), teamOverall(placedB), width);
  drawBench(ctx, match, pick(match.bench ?? []), width);
  drawFooter(ctx, match, width, height);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function safeFileName(match: Match, format: string): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `escalacao-${match.date}-${slug(match.teamAName) || 'time-a'}-vs-${slug(match.teamBName) || 'time-b'}.${format}`;
}

export type LineupExportFormat = 'png' | 'jpeg';

export type LineupExportResult = {
  dataUrl: string;
  fileName: string;
};

/** Renderiza e retorna a imagem como data URL (usado pelo download e por previews). */
export async function buildLineupImage(
  match: Match,
  players: Player[],
  options: LineupRenderOptions & { format?: LineupExportFormat; quality?: number } = {},
): Promise<LineupExportResult> {
  const { format = 'png', quality = 0.95, ...rest } = options;
  const fileName = safeFileName(match, format);
  if (typeof document === 'undefined') return { dataUrl: '', fileName };

  await loadImages(players);

  const canvas = document.createElement('canvas');
  renderLineupCanvas(canvas, match, players, rest);

  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  return { dataUrl: canvas.toDataURL(mime, quality), fileName };
}

/** Baixa a escalação como imagem (PNG por padrão). */
export async function exportLineup(
  match: Match,
  players: Player[],
  options: LineupRenderOptions & { format?: LineupExportFormat; quality?: number } = {},
): Promise<LineupExportResult | null> {
  const result = await buildLineupImage(match, players, options);
  if (typeof document === 'undefined') return null;

  const link = document.createElement('a');
  link.download = result.fileName;
  link.href = result.dataUrl;
  link.click();
  return result;
}
