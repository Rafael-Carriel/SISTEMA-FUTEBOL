import type { Player, Position } from './fut-types';

/** Atributos numéricos da cartinha, na ordem exibida na UI. */
export const RATING_FIELDS = [
  'pace',
  'shooting',
  'passing',
  'dribbling',
  'defending',
  'resistance',
  'strength',
  'goalkeeping',
] as const;

export type RatingField = (typeof RATING_FIELDS)[number];

/**
 * Peso de cada atributo no overall, estilo FIFA:
 * - Jogador de linha: média dos 7 atributos de campo (drible entra, goleiro não pesa).
 * - Goleiro: habilidade de goleiro domina, defesa reforçada, chute/drible zerados.
 */
export function ratingWeights(position: Position): Record<RatingField, number> {
  if (position === 'GOL') {
    return { pace: 1, shooting: 0, passing: 1, dribbling: 0, defending: 2, resistance: 1, strength: 1, goalkeeping: 5 };
  }
  return { pace: 1, shooting: 1, passing: 1, dribbling: 1, defending: 1, resistance: 1, strength: 1, goalkeeping: 0 };
}

/** Overall ponderado por posição (0-99). */
export function calcOverall(player: Player): number {
  const weights = ratingWeights(player.position);
  const weightedSum = RATING_FIELDS.reduce((sum, field) => sum + player[field] * weights[field], 0);
  const totalWeight = RATING_FIELDS.reduce((sum, field) => sum + weights[field], 0);
  return Math.round(weightedSum / totalWeight);
}

/** Preenche os novos atributos em jogadores antigos vindos do Firestore. */
export function normalizePlayer(player: Player): Player {
  const hasDribbling = typeof player.dribbling === 'number';
  const hasGoalkeeping = typeof player.goalkeeping === 'number';
  const hasResistance = typeof player.resistance === 'number';
  const hasStrength = typeof player.strength === 'number';
  if (hasDribbling && hasGoalkeeping && hasResistance && hasStrength) return player;
  const legacyPhysical = (player as Player & { physical?: number }).physical;
  return {
    ...player,
    dribbling: hasDribbling ? player.dribbling : (player.position === 'ATA' || player.position === 'MEI' ? 72 : 55),
    goalkeeping: hasGoalkeeping ? player.goalkeeping : (player.position === 'GOL' ? 80 : 35),
    resistance: hasResistance ? player.resistance : legacyPhysical ?? 70,
    strength: hasStrength ? player.strength : legacyPhysical ?? 70,
  };
}