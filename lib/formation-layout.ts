import type { MatchFormat, Player, Position } from './fut-types';

export interface FormationPlayer {
  player: Player;
  x: number;
  y: number;
}

interface FormationSlot {
  position: Position;
  x: number;
  y: number;
}

/** Esquemas padrão: F5 1-1-2-1, F7 1-2-2-2 e F11 1-4-3-3. */
const FORMATIONS: Record<MatchFormat, FormationSlot[]> = {
  F5: [
    { position: 'GOL', x: 50, y: 91 },
    { position: 'ZAG', x: 50, y: 70 },
    { position: 'MEI', x: 30, y: 49 },
    { position: 'MEI', x: 70, y: 49 },
    { position: 'ATA', x: 50, y: 25 },
  ],
  F7: [
    { position: 'GOL', x: 50, y: 91 },
    { position: 'ZAG', x: 30, y: 72 },
    { position: 'ZAG', x: 70, y: 72 },
    { position: 'MEI', x: 30, y: 49 },
    { position: 'MEI', x: 70, y: 49 },
    { position: 'ATA', x: 30, y: 25 },
    { position: 'ATA', x: 70, y: 25 },
  ],
  F11: [
    { position: 'GOL', x: 50, y: 93 },
    { position: 'ZAG', x: 16, y: 74 },
    { position: 'ZAG', x: 39, y: 70 },
    { position: 'ZAG', x: 61, y: 70 },
    { position: 'ZAG', x: 84, y: 74 },
    { position: 'MEI', x: 24, y: 49 },
    { position: 'MEI', x: 50, y: 45 },
    { position: 'MEI', x: 76, y: 49 },
    { position: 'ATA', x: 24, y: 24 },
    { position: 'ATA', x: 50, y: 20 },
    { position: 'ATA', x: 76, y: 24 },
  ],
};

const ROLE_ORDER: Position[] = ['GOL', 'ZAG', 'MEI', 'ATA'];

function roleDistance(player: Position, slot: Position): number {
  if (player === slot) return 0;
  if (player === 'GOL' || slot === 'GOL') return 10;
  return Math.abs(ROLE_ORDER.indexOf(player) - ROLE_ORDER.indexOf(slot));
}

function overall(player: Player): number {
  return Math.round((player.pace + player.shooting + player.passing + player.defending + player.physical) / 5);
}

function slotsForCount(format: MatchFormat, count: number): FormationSlot[] {
  const slots = [...FORMATIONS[format]];
  // For incomplete teams, remove players from the most populated advanced line
  // first while preserving a goalkeeper and a balanced visual shape.
  const removalOrder: Position[] = ['ATA', 'MEI', 'ZAG'];
  let removalIndex = 0;
  while (slots.length > count && slots.length > 1) {
    const role = removalOrder[removalIndex % removalOrder.length];
    const candidates = slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => slot.position === role);
    const removable = candidates.length > 1 ? candidates[candidates.length - 1] : candidates[0];
    if (removable) slots.splice(removable.index, 1);
    removalIndex += 1;
  }

  while (slots.length < count) {
    const extraIndex = slots.length - FORMATIONS[format].length;
    const x = extraIndex % 2 === 0 ? 18 : 82;
    const y = 38 + Math.floor(extraIndex / 2) * 8;
    slots.push({ position: 'MEI', x, y: Math.min(62, y) });
  }
  return slots;
}

/** Encaixa os jogadores no desenho tático, mesmo quando as posições cadastradas não fecham o esquema. */
export function assignFormationPositions(players: Player[], format: MatchFormat, goalkeeperId?: string): FormationPlayer[] {
  const remaining = [...players];
  const slots = slotsForCount(format, players.length);

  return slots.flatMap((slot) => {
    if (!remaining.length) return [];
    if (slot.position === 'GOL' && goalkeeperId) {
      const goalkeeperIndex = remaining.findIndex((player) => player.id === goalkeeperId);
      if (goalkeeperIndex >= 0) {
        const [goalkeeper] = remaining.splice(goalkeeperIndex, 1);
        return [{ player: goalkeeper, x: slot.x, y: slot.y }];
      }
    }
    remaining.sort((a, b) => {
      const roleScore = roleDistance(a.position, slot.position) - roleDistance(b.position, slot.position);
      return roleScore || overall(b) - overall(a);
    });
    const player = remaining.shift();
    return player ? [{ player, x: slot.x, y: slot.y }] : [];
  });
}
