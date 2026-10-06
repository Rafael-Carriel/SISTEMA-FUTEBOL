import { describe, expect, it } from 'vitest';

import type { FieldPositions, Match, MatchFormat, Player } from '../fut-types';
import {
  LINEUP_EXPORT_SIZE,
  LINEUP_FIELD,
  layoutTeamOnPitch,
  resolveTeamFieldPositions,
} from '../lineup-export';

const HALF = {
  top: [LINEUP_FIELD.y, LINEUP_FIELD.y + LINEUP_FIELD.h / 2],
  bottom: [LINEUP_FIELD.y + LINEUP_FIELD.h / 2, LINEUP_FIELD.y + LINEUP_FIELD.h],
} as const;

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
    createdAt: '2026-09-01T12:00:00.000Z',
    ...overrides,
  };
}

function roster(format: MatchFormat): Player[] {
  const counts: Record<MatchFormat, { GOL: number; ZAG: number; MEI: number; ATA: number }> = {
    F5: { GOL: 1, ZAG: 1, MEI: 2, ATA: 1 },
    F7: { GOL: 1, ZAG: 2, MEI: 2, ATA: 2 },
    F11: { GOL: 1, ZAG: 4, MEI: 3, ATA: 3 },
  };
  const players: Player[] = [];
  let number = 1;
  for (const role of ['GOL', 'ZAG', 'MEI', 'ATA'] as const) {
    for (let index = 0; index < counts[format][role]; index += 1) {
      players.push(
        makePlayer({
          id: `${role.toLowerCase()}${index}`,
          nickname: role === 'ZAG' ? 'Zagueirão' : `Jogador ${number}`,
          position: role,
          number,
        }),
      );
      number += 1;
    }
  }
  return players;
}

/** Distância mínima entre dois jogadores que dividem a mesma faixa horizontal. */
function minSameLaneDistance(spots: ReturnType<typeof layoutTeamOnPitch>) {
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < spots.length; i += 1) {
    for (let j = i + 1; j < spots.length; j += 1) {
      if (Math.abs(spots[i].x - spots[j].x) >= 150) continue;
      min = Math.min(min, Math.abs(spots[i].y - spots[j].y));
    }
  }
  return min;
}

/** Menor distância entre linhas vizinhas (o chip de nome precisa caber). */
function minRowGap(spots: ReturnType<typeof layoutTeamOnPitch>) {
  const rows = [...new Set(spots.map((spot) => Math.round(spot.y)))].sort((a, b) => a - b);
  let min = Number.POSITIVE_INFINITY;
  for (let index = 1; index < rows.length; index += 1) min = Math.min(min, rows[index] - rows[index - 1]);
  return min;
}

describe('resolveTeamFieldPositions', () => {
  const target = [
    makePlayer({ id: 'b1', position: 'GOL' }),
    makePlayer({ id: 'b2', position: 'ZAG' }),
  ];

  it('lê as posições salvas de cada jogador, sem misturar os times', () => {
    const fieldPositions: FieldPositions = {
      b1: { x: 80, y: 10 },
      b2: { x: 20, y: 30 },
    };
    const placed = resolveTeamFieldPositions(target, 'F7', fieldPositions);
    expect(placed.map((item) => [item.player.id, item.x, item.y])).toEqual([
      ['b1', 80, 10],
      ['b2', 20, 30],
    ]);
  });

  it('ignora posições do adversário (bug antigo: os dois times usavam o mesmo mapa)', () => {
    const fieldPositions: FieldPositions = { a1: { x: 5, y: 5 } };
    const placed = resolveTeamFieldPositions(target, 'F7', fieldPositions);
    expect(placed.map((item) => [item.x, item.y])).toEqual([
      [50, 50],
      [50, 50],
    ]);
  });

  it('cai no esquema do formato quando não há posições salvas', () => {
    const placed = resolveTeamFieldPositions(target, 'F7', undefined, 'b1');
    const goalkeeper = placed.find((item) => item.player.id === 'b1');
    expect(goalkeeper?.y).toBeGreaterThan(80);
  });
});

describe('layoutTeamOnPitch', () => {
  for (const format of ['F5', 'F7', 'F11'] as const) {
    it(`${format}: ninguém fica colado nem sai da própria metade`, () => {
      const radius = 44;
      const spots = layoutTeamOnPitch(
        resolveTeamFieldPositions(roster(format), format, undefined, 'gol0'),
        'bottom',
        radius,
      );

      expect(spots).toHaveLength(roster(format).length);
      // duas camisas na mesma faixa horizontal não podem se sobrepor
      expect(minSameLaneDistance(spots)).toBeGreaterThan(radius * 2 + 12);
      // o chip de nome de uma linha não pode alcançar a linha de cima
      expect(minRowGap(spots)).toBeGreaterThan(radius * 2 + 36);
      // todos dentro da metade de baixo do campo
      const [halfTop, halfBottom] = HALF.bottom;
      for (const spot of spots) {
        expect(spot.y).toBeGreaterThanOrEqual(halfTop);
        expect(spot.y).toBeLessThanOrEqual(halfBottom);
      }
    });
  }

  it('nenhuma camisa invade o gol nem o meio-campo', () => {
    const radius = 44;
    for (const format of ['F5', 'F7', 'F11'] as const) {
      for (const half of ['top', 'bottom'] as const) {
        const spots = layoutTeamOnPitch(
          resolveTeamFieldPositions(roster(format), format, undefined, 'gol0'),
          half,
          radius,
        );
        const [roomTop, roomBottom] = HALF[half];
        for (const spot of spots) {
          expect(spot.y - radius).toBeGreaterThanOrEqual(roomTop - 1);
          expect(spot.y + radius).toBeLessThanOrEqual(roomBottom + 1);
        }
      }
    }
  });

  it('mantém o goleiro na frente do gol e o ataque na frente do time', () => {
    const spots = layoutTeamOnPitch(
      resolveTeamFieldPositions(roster('F11'), 'F11', undefined, 'gol0'),
      'bottom',
      44,
    );
    /** Profundidade média da linha de cada posição (maior = mais perto do gol). */
    const lineDepth = (role: string) => {
      const line = spots.filter((spot) => spot.player.position === role);
      return line.reduce((sum, spot) => sum + spot.y, 0) / Math.max(1, line.length);
    };
    expect(lineDepth('GOL')).toBeGreaterThan(lineDepth('ZAG'));
    expect(lineDepth('ZAG')).toBeGreaterThan(lineDepth('MEI'));
    expect(lineDepth('MEI')).toBeGreaterThan(lineDepth('ATA'));

    // o goleiro fica dentro do campo, à frente da linha do gol
    const keeper = spots.find((spot) => spot.player.position === 'GOL');
    expect(keeper?.y).toBeLessThan(HALF.bottom[1]);
    expect(keeper?.y).toBeGreaterThan(HALF.bottom[1] - 160);
  });

  it('espelha o visitante para o gol oposto', () => {
    const placed = resolveTeamFieldPositions(roster('F7'), 'F7', undefined, 'gol0');
    const home = layoutTeamOnPitch(placed, 'bottom', 44);
    const away = layoutTeamOnPitch(placed, 'top', 44);

    for (const spot of away) {
      expect(spot.y).toBeGreaterThanOrEqual(HALF.top[0]);
      expect(spot.y).toBeLessThan(HALF.top[1]);
    }
    for (const spot of home) {
      expect(spot.y).toBeGreaterThan(HALF.bottom[0]);
      expect(spot.y).toBeLessThanOrEqual(HALF.bottom[1]);
    }
    // o visitante defende o gol de cima, o mandante o de baixo
    const keeperOf = (spots: ReturnType<typeof layoutTeamOnPitch>) =>
      spots.find((spot) => spot.player.position === 'GOL')?.y ?? 0;
    expect(keeperOf(away)).toBeLessThan(keeperOf(home));
  });

  it('não empilha times incompletos (F7 com 5 jogadores repete o Y no esquema)', () => {
    const five = roster('F7').slice(0, 5);
    const spots = layoutTeamOnPitch(
      resolveTeamFieldPositions(five, 'F7', undefined, 'gol0'),
      'bottom',
      44,
    );
    expect(new Set(spots.map((spot) => Math.round(spot.y))).size).toBeGreaterThan(1);
    expect(minSameLaneDistance(spots)).toBeGreaterThan(0);
  });

  it('respeita o quadro tático quando as posições foram salvas', () => {
    const fieldPositions: FieldPositions = {
      gol0: { x: 50, y: 90 },
      zag0: { x: 78, y: 20 },
    };
    const players = [makePlayer({ id: 'gol0', position: 'GOL' }), makePlayer({ id: 'zag0', position: 'ZAG' })];
    const spots = layoutTeamOnPitch(
      resolveTeamFieldPositions(players, 'F7', fieldPositions),
      'bottom',
      44,
      'custom',
    );
    const keeper = spots.find((spot) => spot.player.id === 'gol0');
    const defender = spots.find((spot) => spot.player.id === 'zag0');
    // o quadro tático salvo manda: x = 50% fica no meio; x = 78% à direita
    expect(keeper?.x).toBeLessThan(defender?.x ?? 0);
    // y = 90% fica junto do próprio gol (embaixo); y = 20% adiantado (em cima)
    expect(keeper?.y).toBeGreaterThan(defender?.y ?? 0);
  });
});

describe('LINEUP_EXPORT_SIZE', () => {
  it('usa o cartão vertical', () => {
    expect(LINEUP_EXPORT_SIZE).toEqual({ width: 1080, height: 2100 });
  });

  it('é alto o bastante para campo + banco + rodapé sem nada sair do cartão', () => {
    // menor exigência geométrica: campo de 11 com as 4 linhas do 4-4-2, mais a
    // faixa do banco e o rodapé. Se alguém diminuir o cartão, este teste quebra.
    const radius = 36;
    const chipHeight = radius * 0.6 + 26;
    const rows = 4;
    const halfNeed = radius * 2 * (rows - 1) + chipHeight * (rows - 1) + (radius + 46 + chipHeight / 2);
    const fieldNeed = halfNeed * 2;
    const benchPanel = 300;
    const footer = 260;
    const minimum = LINEUP_FIELD.y + fieldNeed + 20 + benchPanel + footer;
    expect(LINEUP_EXPORT_SIZE.height).toBeGreaterThanOrEqual(minimum);
  });

  it('cabe na área máxima de canvas de navegadores móveis', () => {
    expect(LINEUP_EXPORT_SIZE.width * LINEUP_EXPORT_SIZE.height).toBeLessThanOrEqual(16_777_216);
  });

  it('deixa o campo e o banco dentro do cartão', () => {
    expect(LINEUP_FIELD.y).toBeGreaterThan(0);
    expect(LINEUP_FIELD.y + LINEUP_FIELD.h).toBeLessThan(LINEUP_EXPORT_SIZE.height);
    expect(LINEUP_FIELD.x + LINEUP_FIELD.w).toBeLessThanOrEqual(LINEUP_EXPORT_SIZE.width);
    // campo + banco + rodapé
    expect(LINEUP_FIELD.y + LINEUP_FIELD.h + 20 + 300).toBeLessThan(LINEUP_EXPORT_SIZE.height);
  });
});

describe('safeFileName via buildLineupImage', () => {
  it('monta o nome do arquivo sem depender do DOM', async () => {
    const { buildLineupImage } = await import('../lineup-export');
    const match = {
      id: 'm1',
      title: 'Fut',
      venue: 'Arena',
      date: '2026-09-01',
      time: '21:00',
      status: 'finished',
      teamAName: 'Time Verde',
      teamBName: 'Seleção Azul',
      teamA: [],
      teamB: [],
      scoreA: 0,
      scoreB: 0,
      events: [],
      createdAt: '2026-09-01T20:00:00.000Z',
    } as Match;
    const result = await buildLineupImage(match, [], {});
    expect(result.fileName).toBe('escalacao-2026-09-01-time-verde-vs-selecao-azul.png');
  });
});
