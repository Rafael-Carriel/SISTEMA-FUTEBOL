import type { Player } from './fut-types';
import { calcOverall } from './player-rating';

const POSITIONS = ['GOL', 'ZAG', 'MEI', 'ATA'] as const;
const ATTRIBUTES = [
  ['pace', 'Velocidade'], ['resistance', 'Resistência'], ['strength', 'Força'],
  ['defending', 'Defesa'], ['passing', 'Passe'], ['dribbling', 'Drible'], ['shooting', 'Chute'],
] as const;

// A cartinha zerada significa que o jogador ainda não foi avaliado.
// Uma estimativa neutra evita tratar o avulso como incapaz de jogar.
function unrated(player: Player): boolean {
  return ATTRIBUTES.every(([key]) => !player[key]) && !player.goalkeeping;
}
function rating(player: Player, key: (typeof ATTRIBUTES)[number][0] | 'goalkeeping'): number {
  if (unrated(player)) return 50;
  const value = player[key];
  return Number.isFinite(value) ? Math.max(0, Math.min(99, value)) : 50;
}
function mean(players: Player[], key: (typeof ATTRIBUTES)[number][0] | 'goalkeeping'): number {
  return players.length ? players.reduce((sum, player) => sum + rating(player, key), 0) / players.length : 0;
}
function overallMean(players: Player[]): number {
  return players.length ? players.reduce((sum, player) => sum + (unrated(player) ? 50 : calcOverall(player)), 0) / players.length : 0;
}
function differences(teamA: Player[], teamB: Player[]) {
  const outA = teamA.filter((p) => p.position !== 'GOL');
  const outB = teamB.filter((p) => p.position !== 'GOL');
  return ATTRIBUTES.map(([key, label]) => ({
    key, label, teamA: mean(outA, key), teamB: mean(outB, key),
    difference: Math.abs(mean(outA, key) - mean(outB, key)),
  }));
}
function imbalance(teamA: Player[], teamB: Player[]): number {
  const gaps = differences(teamA, teamB).map((item) => item.difference);
  const keeperA = teamA.filter((p) => p.position === 'GOL');
  const keeperB = teamB.filter((p) => p.position === 'GOL');
  if (keeperA.length && keeperB.length) gaps.push(Math.abs(mean(keeperA, 'goalkeeping') - mean(keeperB, 'goalkeeping')));
  gaps.push(Math.abs(overallMean(teamA) - overallMean(teamB)));
  // Penaliza especialmente o pior atributo, evitando compensar lentidão com chute.
  const attributeCost = gaps.reduce((sum, gap) => sum + gap * gap, 0) / gaps.length + 2 * Math.max(...gaps) ** 2;
  const roleCost = POSITIONS.reduce((sum, position) => {
    const delta = Math.abs(teamA.filter((p) => p.position === position).length - teamB.filter((p) => p.position === position).length);
    return sum + Math.max(0, delta - 1) ** 2;
  }, 0);
  return attributeCost + roleCost * 1000000;
}

function playerIdentity(player: Player): string {
  const name = (player.nickname || player.name).trim().toLocaleLowerCase('pt-BR');
  return `${name}|${player.number}`;
}

/** Garante que o mesmo jogador nunca entre duas vezes no sorteio. */
export function uniqueLineupPlayers(
  ids: string[],
  playerById: (id: string) => Player | undefined,
): Player[] {
  const seenIds = new Set<string>();
  const seenPeople = new Set<string>();

  return ids.flatMap((id) => {
    const player = playerById(id);
    if (!player) return [];
    const identity = playerIdentity(player);
    if (seenIds.has(player.id) || seenPeople.has(identity)) return [];
    seenIds.add(player.id);
    seenPeople.add(identity);
    return [player];
  });
}

/** Busca o menor desequilíbrio por atributo respeitando tamanho e posições. */
export function balancedTeamsSmart(ids: string[], playerById: (id: string) => Player | undefined): { teamA: string[]; teamB: string[] } {
  const players = uniqueLineupPlayers(ids, playerById).sort((a, b) => a.id.localeCompare(b.id));
  const target = Math.ceil(players.length / 2);
  if (players.length < 2) return { teamA: players.map((p) => p.id), teamB: [] };
  let bestA: Player[] = [];
  let bestB: Player[] = [];
  let bestScore = Infinity;
  function consider(a: Player[], b: Player[]) {
    const score = imbalance(a, b);
    if (score < bestScore - 1e-9) { bestScore = score; bestA = [...a]; bestB = [...b]; }
  }
  const totals = POSITIONS.map((position) => players.filter((p) => p.position === position).length);
  if (players.length <= 22) {
    const a: Player[] = [], b: Player[] = [];
    const countsA = [0, 0, 0, 0], countsB = [0, 0, 0, 0];
    function search(index: number) {
      if (bestScore === 0) return;
      if (index === players.length) { consider(a, b); return; }
      const player = players[index];
      const role = POSITIONS.indexOf(player.position);
      const maxRole = Math.ceil(totals[role] / 2);
      if (a.length < target && countsA[role] < maxRole) {
        a.push(player); countsA[role]++; search(index + 1); countsA[role]--; a.pop();
      }
      // Em times de tamanho igual, trocar os nomes A/B não muda o resultado.
      if (!(index === 0 && players.length % 2 === 0) && b.length < players.length - target && countsB[role] < maxRole) {
        b.push(player); countsB[role]++; search(index + 1); countsB[role]--; b.pop();
      }
    }
    search(0);
  } else {
    // Elencos grandes: várias divisões iniciais e trocas que reduzem o custo.
    // PRNG fixo mantém o resultado reproduzível e o tempo limitado.
    let seed = 1234567;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let attempt = 0; attempt < 12; attempt++) {
      const a: Player[] = [], b: Player[] = [];
      for (const position of POSITIONS) {
        const group = players.filter((p) => p.position === position);
        for (let i = group.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [group[i], group[j]] = [group[j], group[i]]; }
        for (const player of group) {
          const countA = a.filter((p) => p.position === position).length;
          const countB = b.filter((p) => p.position === position).length;
          if (b.length === players.length - target || (a.length < target && (countA < countB || (countA === countB && a.length <= b.length)))) a.push(player);
          else b.push(player);
        }
      }
      let score = imbalance(a, b);
      for (let pass = 0; pass < 30; pass++) {
        let swap: [number, number] | null = null;
        let nextScore = score;
        for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
          [a[i], b[j]] = [b[j], a[i]];
          const candidate = imbalance(a, b);
          [a[i], b[j]] = [b[j], a[i]];
          if (candidate < nextScore - 1e-9) { nextScore = candidate; swap = [i, j]; }
        }
        if (!swap) break;
        const [i, j] = swap;
        [a[i], b[j]] = [b[j], a[i]];
        score = nextScore;
      }
      consider(a, b);
    }
  }
  return { teamA: bestA.map((p) => p.id), teamB: bestB.map((p) => p.id) };
}

export function getTeamBalanceInfo(teamA: Player[], teamB: Player[]) {
  const attributes = differences(teamA, teamB);
  const unratedCount = [...teamA, ...teamB].filter(unrated).length;
  const percentage = !teamA.length && !teamB.length ? 100 : Math.max(0, Math.round(100 - Math.sqrt(imbalance(teamA, teamB) / 3)));
  const label = !teamA.length && !teamB.length ? 'Times vazios' : percentage >= 95 ? 'Times muito equilibrados!' : percentage >= 88 ? 'Times equilibrados' : percentage >= 78 ? 'Leve vantagem para um lado' : 'Times desbalanceados';
  const color = !teamA.length && !teamB.length ? 'text-muted-foreground' : percentage >= 88 ? 'text-emerald-500' : percentage >= 78 ? 'text-yellow-500' : 'text-red-500';
  return { percentage, label, color, attributes, unratedCount };
}
