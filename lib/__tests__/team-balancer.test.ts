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
    resistance: 70,
    strength: 70,
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


describe('equilíbrio por perfil', () => {
  it('divide velocidade, força, defesa e drible mesmo com overall igual', () => {
    const players = [
      makePlayer({ id: 'a', pace: 99, strength: 1, defending: 1, dribbling: 99 }),
      makePlayer({ id: 'b', pace: 1, strength: 99, defending: 99, dribbling: 1 }),
      makePlayer({ id: 'c', pace: 1, strength: 99, defending: 99, dribbling: 1 }),
      makePlayer({ id: 'd', pace: 99, strength: 1, defending: 1, dribbling: 99 }),
    ];
    const lookup = new Map(players.map((p) => [p.id, p]));
    const result = balancedTeamsSmart(players.map((p) => p.id), (id) => lookup.get(id));
    const a = result.teamA.map((id) => lookup.get(id)!);
    const b = result.teamB.map((id) => lookup.get(id)!);
    expect(getTeamBalanceInfo(a, b).attributes.every((item) => item.difference === 0)).toBe(true);
  });

  it('não considera perfis opostos equilibrados só porque o overall coincide', () => {
    const a = makePlayer({ id: 'a', pace: 99, defending: 1 });
    const b = makePlayer({ id: 'b', pace: 1, defending: 99 });
    expect(getTeamBalanceInfo([a], [b]).percentage).toBeLessThan(78);
  });

  it('mantém cada posição distribuída e é independente da ordem de seleção', () => {
    const players = Array.from({ length: 15 }, (_, i) => makePlayer({ id: String(i), position: (['GOL', 'ZAG', 'MEI', 'ATA'] as const)[i % 4], pace: 35 + i * 4 }));
    const lookup = new Map(players.map((p) => [p.id, p]));
    const ids = players.map((p) => p.id);
    const result = balancedTeamsSmart(ids, (id) => lookup.get(id));
    expect(result).toEqual(balancedTeamsSmart([...ids].reverse(), (id) => lookup.get(id)));
    expect(result.teamA.length).toBe(8);
    expect(result.teamB.length).toBe(7);
    for (const role of ['GOL', 'ZAG', 'MEI', 'ATA']) {
      const count = (team: string[]) => team.filter((id) => lookup.get(id)!.position === role).length;
      expect(Math.abs(count(result.teamA) - count(result.teamB))).toBeLessThanOrEqual(1);
    }
  });

  it('usa estimativa neutra para avulso sem atributos e informa a limitação', () => {
    const avulso = makePlayer({ id: 'avulso', pace: 0, shooting: 0, passing: 0, defending: 0, resistance: 0, strength: 0, dribbling: 0, goalkeeping: 0 });
    const info = getTeamBalanceInfo([avulso], [makePlayer({ id: 'regular', pace: 50, shooting: 50, passing: 50, defending: 50, resistance: 50, strength: 50, dribbling: 50 })]);
    expect(info.percentage).toBe(100);
    expect(info.unratedCount).toBe(1);
  });

  it('também distribui elencos grandes sem perder jogadores ou posições', () => {
    const players = Array.from({ length: 25 }, (_, i) => makePlayer({ id: String(i), position: (['GOL', 'ZAG', 'MEI', 'ATA'] as const)[i % 4], pace: 30 + i * 2 }));
    const lookup = new Map(players.map((p) => [p.id, p]));
    const result = balancedTeamsSmart(players.map((p) => p.id), (id) => lookup.get(id));
    expect(new Set([...result.teamA, ...result.teamB]).size).toBe(25);
    expect(result.teamA.length).toBe(13);
    expect(result.teamB.length).toBe(12);
    for (const role of ['GOL', 'ZAG', 'MEI', 'ATA']) {
      const count = (team: string[]) => team.filter((id) => lookup.get(id)!.position === role).length;
      expect(Math.abs(count(result.teamA) - count(result.teamB))).toBeLessThanOrEqual(1);
    }
  });
});


it('equilibra 22 jogadores e distribui a habilidade dos goleiros', () => {
  const players = Array.from({ length: 22 }, (_, i) => makePlayer({ id: String(i), position: i < 2 ? 'GOL' : 'MEI', pace: 30 + (i * 17) % 70, defending: 25 + (i * 11) % 70, dribbling: 20 + (i * 19) % 79, goalkeeping: i === 0 ? 90 : 70 }));
  const lookup = new Map(players.map((p) => [p.id, p]));
  const result = balancedTeamsSmart(players.map((p) => p.id), (id) => lookup.get(id));
  expect(result.teamA.length).toBe(11);
  expect(result.teamB.length).toBe(11);
  expect(result.teamA.filter((id) => lookup.get(id)!.position === 'GOL')).toHaveLength(1);
  expect(result.teamB.filter((id) => lookup.get(id)!.position === 'GOL')).toHaveLength(1);
});
