import type { Player } from './fut-types';

function overall(player: Player): number {
  return Math.round((player.pace + player.shooting + player.passing + player.defending + player.physical) / 5);
}

function teamPower(players: Player[]): number {
  return players.reduce((sum, p) => sum + overall(p) + 0.3 * p.pace + 0.2 * p.defending + 0.15 * p.shooting, 0);
}

export function balancedTeamsSmart(ids: string[], playerById: (id: string) => Player | undefined): { teamA: string[]; teamB: string[] } {
  const players = ids.map((id) => playerById(id)).filter(Boolean) as Player[];
  if (players.length < 2) {
    const half = Math.ceil(players.length / 2);
    return { teamA: players.slice(0, half).map((p) => p.id), teamB: players.slice(half).map((p) => p.id) };
  }

  // Sort by overall descending
  const ordered = [...players].sort((a, b) => overall(b) - overall(a));

  const teamA: Player[] = [];
  const teamB: Player[] = [];
  let powerA = 0;
  let powerB = 0;

  // Snake draft: A, B, B, A, A, B, B, A...
  ordered.forEach((player, i) => {
    const pattern = Math.floor(i / 2) % 2; // 0,0,1,1,2,2...
    const pickA = i % 2 === 0 ? pattern === 0 : pattern === 1;

    if (pickA || teamB.length > teamA.length) {
      teamA.push(player);
      powerA += overall(player) + 0.3 * player.pace + 0.2 * player.defending + 0.15 * player.shooting;
    } else {
      teamB.push(player);
      powerB += overall(player) + 0.3 * player.pace + 0.2 * player.defending + 0.15 * player.shooting;
    }
  });

  // Fine-tune: if power difference > 5%, try swapping last players
  const totalPower = powerA + powerB;
  if (totalPower > 0) {
    const diff = Math.abs(powerA - powerB) / totalPower;
    if (diff > 0.05 && teamA.length > 1 && teamB.length > 1) {
      const lastA = teamA[teamA.length - 1];
      const lastB = teamB[teamB.length - 1];
      const ovrA = overall(lastA) + 0.3 * lastA.pace + 0.2 * lastA.defending;
      const ovrB = overall(lastB) + 0.3 * lastB.pace + 0.2 * lastB.defending;

      if (powerA > powerB && ovrA > ovrB) {
        teamA.pop();
        teamB.pop();
        teamA.push(lastB);
        teamB.push(lastA);
      } else if (powerB > powerA && ovrB > ovrA) {
        teamA.pop();
        teamB.pop();
        teamA.push(lastB);
        teamB.push(lastA);
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
