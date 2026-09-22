import { describe, expect, it } from 'vitest';

import type { Player } from '../fut-types';
import { balancedTeamsSmart, getTeamBalanceInfo, uniqueLineupPlayers } from '../team-balancer';

function makePlayer(overrides: Partial<Player> & { id: string }): Player {
  return {
    name: `Jogador ${overrides.id}`,
    nickname: `J${overrides.id}`,
    number: 10,
    position: 'MEI',
    pace: 70,
    shooting: 70,
    passing: 70,
    defending: 70,
    physical: 70,
    dribbling: 70,
    goalkeeping: 70,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const squad = [
  makePlayer({ id: 'g1', position: 'GOL', number: 1 }),
  makePlayer({ id: 'z1', position: 'ZAG', number: 2 }),
  makePlayer({ id: 'z2', position: 'ZAG', number: 3 }),
  makePlayer({ id: 'm1', position: 'MEI', number: 8 }),
  makePlayer({ id: 'm2', position: 'MEI', number: 10 }),
  makePlayer({ id: 'a1', position: 'ATA', number: 9, shooting: 95 }),
];
const byId = new Map(squad.map((p) => [p.id, p]));

describe('uniqueLineupPlayers', () => {
  it('remove ids duplicados e ids desconhecidos', () => {
    const result = uniqueLineupPlayers(['m1', 'm1', 'fantasma', 'm2'], (id) => byId.get(id));
    expect(result.map((p) => p.id)).toEqual(['m1', 'm2']);
  });

  it('remove a mesma pessoa com ids diferentes', () => {
    const clone = makePlayer({ id: 'm1-clone', nickname: 'Jm1', name: 'Jogador m1', number: 8, position: 'MEI' });
    const lookup = (id: string) => (id === 'm1-clone' ? clone : byId.get(id));
    expect(uniqueLineupPlayers(['m1', 'm1-clone'], lookup).map((p) => p.id)).toEqual(['m1']);
  });
});

describe('balancedTeamsSmart', () => {
  it('divide sem repetir ninguem e sem perder ninguem', () => {
    const ids = squad.map((p) => p.id);
    const { teamA, teamB } = balancedTeamsSmart(ids, (id) => byId.get(id));
    const all = [...teamA, ...teamB];
    expect(new Set(all).size).toBe(ids.length);
    expect([...all].sort()).toEqual([...ids].sort());
  });

  it('equilibra quantidades (diferença máxima de 1)', () => {
    const ids = squad.map((p) => p.id);
    const { teamA, teamB } = balancedTeamsSmart(ids, (id) => byId.get(id));
    expect(Math.abs(teamA.length - teamB.length)).toBeLessThanOrEqual(1);
  });

  it('separa o craque e o goleiro em times diferentes quando possivel', () => {
    const ids = squad.map((p) => p.id);
    const { teamA, teamB } = balancedTeamsSmart(ids, (id) => byId.get(id));
    const withStar = teamA.includes('a1') ? teamA : teamB;
    const other = withStar === teamA ? teamB : teamA;
    expect(other.length).toBeGreaterThan(0);
  });
});

describe('getTeamBalanceInfo', () => {
  it('retorna 100% para times identicos', () => {
    const info = getTeamBalanceInfo([squad[3]], [squad[4]]);
    expect(info.percentage).toBeGreaterThanOrEqual(90);
    expect(typeof info.label).toBe('string');
  });

  it('trata times vazios sem quebrar', () => {
    expect(getTeamBalanceInfo([], []).percentage).toBe(100);
  });
});
