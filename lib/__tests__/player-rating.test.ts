import { describe, expect, it } from 'vitest';

import type { Player } from '../fut-types';
import { calcOverall, normalizePlayer } from '../player-rating';

function makePlayer(overrides: Partial<Player> & { id: string }): Player {
  return {
    name: `Jogador ${overrides.id}`,
    nickname: `J${overrides.id}`,
    number: 10,
    position: 'MEI',
    pace: 70,
    shooting: 70,
    passing: 70,
    dribbling: 70,
    defending: 70,
    resistance: 70,
    strength: 70,
    goalkeeping: 35,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('calcOverall', () => {
  it('mede jogador de linha com os 7 atributos de campo (drible entra, goleiro ignorado)', () => {
    const atacante = makePlayer({
      id: 'a1',
      position: 'ATA',
      pace: 80, shooting: 80, passing: 80, dribbling: 80, defending: 40, resistance: 80, strength: 80, goalkeeping: 99,
    });
    expect(calcOverall(atacante)).toBe(74);
    // Goleiro não pesa no overall de quem joga fora do gol.
    expect(calcOverall({ ...atacante, goalkeeping: 1 })).toBe(74);
  });

  it('mede goleiro dando peso à habilidade de goleiro', () => {
    const goleiro = makePlayer({
      id: 'g1',
      position: 'GOL',
      pace: 60, shooting: 30, passing: 70, dribbling: 30, defending: 80, resistance: 70, strength: 70, goalkeeping: 90,
    });
    expect(calcOverall(goleiro)).toBe(80);
    // Chute e drible não pesam no overall de goleiro.
    expect(calcOverall({ ...goleiro, shooting: 95, dribbling: 95 })).toBe(80);
  });
});

describe('normalizePlayer', () => {
  it('preenche drible e goleiro de jogadores antigos vindos do Firestore', () => {
    const antigo = {
      ...makePlayer({ id: 'velho', position: 'ATA' }),
      dribbling: undefined,
      goalkeeping: undefined,
    } as unknown as Player;
    const normalizado = normalizePlayer(antigo);
    expect(normalizado.dribbling).toBe(72);
    expect(normalizado.goalkeeping).toBe(35);
  });

  it('mantém tudo que já existia quando os atributos estão presentes', () => {
    const atual = makePlayer({ id: 'atual', position: 'GOL', dribbling: 44, goalkeeping: 91 });
    expect(normalizePlayer(atual)).toBe(atual);
  });

  it('migra physical legado para resistência e força', () => {
    const antigo = {
      ...makePlayer({ id: 'legacy' }),
      resistance: undefined,
      strength: undefined,
      physical: 75,
    } as unknown as Player;
    const normalizado = normalizePlayer(antigo);
    expect(normalizado.resistance).toBe(75);
    expect(normalizado.strength).toBe(75);
  });
});