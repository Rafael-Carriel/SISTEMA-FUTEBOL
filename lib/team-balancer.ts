import type { Player } from './fut-types';

function overall(player: Player): number {
  return Math.round((player.pace + player.shooting + player.passing + player.defending + player.physical) / 5);
}

function teamPower(players: Player[]): number {
  return players.reduce((sum, p) => sum + overall(p) + 0.3 * p.pace + 0.2 * p.defending + 0.15 * p.shooting, 0);
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

export function balancedTeamsSmart(ids: string[], playerById: (id: string) => Player | undefined): { teamA: string[]; teamB: string[] } {
  const players = uniqueLineupPlayers(ids, playerById);
  if (players.length < 2) {
    const half = Math.ceil(players.length / 2);
    return { teamA: players.slice(0, half).map((p) => p.id), teamB: players.slice(half).map((p) => p.id) };
  }

  const teamA: Player[] = [];
  const teamB: Player[] = [];
  let powerA = 0;
  let powerB = 0;

  const maxA = Math.ceil(players.length / 2);
  const maxB = Math.floor(players.length / 2);
  const positions = ['GOL', 'ZAG', 'MEI', 'ATA'] as const;
  const weightedPower = (player: Player) =>
    overall(player) + 0.3 * player.pace + 0.2 * player.defending + 0.15 * player.shooting;

  // Distribute one position at a time. This keeps both teams with the closest
  // possible number of goalkeepers, defenders, midfielders and attackers.
  for (const position of positions) {
    const group = players
      .filter((player) => player.position === position)
      .sort((a, b) => overall(b) - overall(a));

    for (const player of group) {
      const countA = teamA.filter((member) => member.position === position).length;
      const countB = teamB.filter((member) => member.position === position).length;
      const canJoinA = teamA.length < maxA;
      const canJoinB = teamB.length < maxB;
      const joinA = !canJoinB || (canJoinA && (
        countA < countB || (countA === countB && powerA <= powerB)
      ));
      const power = weightedPower(player);

      if (joinA) {
        teamA.push(player);
        powerA += power;
      } else {
        teamB.push(player);
        powerB += power;
      }
    }
  }

  return { teamA: teamA.map((p) => p.id), teamB: teamB.map((p) => p.id) };
}

export function getTeamBalanceInfo(
  teamA: Player[],
  teamB: Player[]
): { percentage: number; label: string; color: string } {
  const powerA = teamPower(teamA);
  const powerB = teamPower(teamB);
  const total = powerA + powerB;
  if (total === 0) return { percentage: 100, label: 'Times vazios', color: 'text-muted-foreground' };

  const ratio = Math.min(powerA, powerB) / Math.max(powerA, powerB);
  const percentage = Math.round(ratio * 100);

  if (percentage >= 95) return { percentage, label: 'Times muito equilibrados!', color: 'text-emerald-500' };
  if (percentage >= 88) return { percentage, label: 'Times equilibrados', color: 'text-emerald-500' };
  if (percentage >= 78) return { percentage, label: 'Leve vantagem para um lado', color: 'text-yellow-500' };
  return { percentage, label: 'Times desbalanceados', color: 'text-red-500' };
}
