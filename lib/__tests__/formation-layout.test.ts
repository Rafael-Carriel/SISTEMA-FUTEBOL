import { describe, expect, it } from 'vitest';

import type { MatchFormat, Player, Position } from '../fut-types';
import {
  assignFormationPlayers,
  assignFormationPositions,
  defaultFormationId,
  getFormation,
  listFormations,
} from '../formation-layout';
import { LINEUP_FIELD } from '../lineup-export';

function makePlayer(id: string, position: Position): Player {
  return {
    id,
    name: `Jogador ${id}`,
    nickname: id,
    number: 1,
    position,
    pace: 70,
    shooting: 70,
    passing: 70,
    defending: 70,
    resistance: 70,
    strength: 70,
    dribbling: 70,
    goalkeeping: position === 'GOL' ? 85 : 40,
    createdAt: '2026-09-01T12:00:00.000Z',
  };
}

/** Plantel com a composição que o formato pede. */
function squad(format: MatchFormat): Player[] {
  const shapes: Record<MatchFormat, Array<[Position, number]>> = {
    F5: [['GOL', 1], ['ZAG', 1], ['MEI', 2], ['ATA', 1]],
    F6: [['GOL', 1], ['ZAG', 2], ['MEI', 2], ['ATA', 1]],
    F7: [['GOL', 1], ['ZAG', 2], ['MEI', 2], ['ATA', 2]],
    F11: [['GOL', 1], ['ZAG', 4], ['MEI', 3], ['ATA', 3]],
  };
  const players: Player[] = [];
  let index = 1;
  for (const [position, count] of shapes[format]) {
    for (let i = 0; i < count; i += 1) {
      players.push(makePlayer(`${position.toLowerCase()}${i}`, position));
      index += 1;
    }
  }
  void index;
  return players;
}

const FORMATS: MatchFormat[] = ['F5', 'F6', 'F7', 'F11'];
const FORMAT_SIZE: Record<MatchFormat, number> = { F5: 5, F6: 6, F7: 7, F11: 11 };

describe('formações por formato', () => {
  it('cobre os quatro formatos com pelo menos um esquema', () => {
    for (const format of FORMATS) {
      const options = listFormations(format);
      expect(options.length).toBeGreaterThan(0);
      for (const option of options) {
        expect(option.label.length).toBeGreaterThan(0);
        expect(option.hint.length).toBeGreaterThan(0);
      }
    }
  });

  it('a vaga do gol é sempre o ponto mais profundo do esquema', () => {
    for (const format of FORMATS) {
      for (const option of listFormations(format)) {
        const slots = getFormation(format, option.id).slots;
        const keeper = slots.find((slot) => slot.position === 'GOL');
        expect(keeper).toBeDefined();
        const deepestOutfield = Math.max(...slots.filter((s) => s.position !== 'GOL').map((s) => s.y));
        expect(keeper!.y).toBeGreaterThan(deepestOutfield);
      }
    }
  });

  it('o esquema padrão tem exatamente o número de vagas do formato', () => {
    for (const format of FORMATS) {
      const formation = getFormation(format, defaultFormationId(format));
      expect(formation.slots).toHaveLength(FORMAT_SIZE[format]);
    }
  });

  it('nenhuma vaga escapa da largura do campo', () => {
    for (const format of FORMATS) {
      for (const option of listFormations(format)) {
        for (const slot of getFormation(format, option.id).slots) {
          expect(slot.x).toBeGreaterThanOrEqual(0);
          expect(slot.x).toBeLessThanOrEqual(100);
          expect(slot.y).toBeGreaterThan(0);
          expect(slot.y).toBeLessThan(100);
        }
      }
    }
  });
});

describe('assignFormationPlayers', () => {
  it('escala cada jogador na vaga da própria posição', () => {
    for (const format of FORMATS) {
      const players = squad(format);
      const slots = getFormation(format, defaultFormationId(format)).slots;
      const placed = assignFormationPlayers(players, format, defaultFormationId(format), 'gol0');
      expect(placed).toHaveLength(players.length);

      // todo jogador cai numa vaga da própria posição...
      for (const entry of placed) {
        expect(slots.some((slot) => slot.position === entry.player.position)).toBe(true);
      }
      // ...e o plantel inteiro é usado, sem ninguém de fora
      expect(new Set(placed.map((entry) => entry.player.id)).size).toBe(players.length);
    }
  });

  it('não deixa zagueiro de fora para escalar atacante na zaga', () => {
    // 4-4-2 com 4 zagueiros e 4 atacantes: nenhum atacante pode acabar na linha
    // de zaga enquanto um zagueiro fica no banco
    const players = [
      ...['z1', 'z2', 'z3', 'z4'].map((id) => makePlayer(id, 'ZAG')),
      ...['m1', 'm2', 'm3', 'm4'].map((id) => makePlayer(id, 'MEI')),
      ...['a1', 'a2', 'a3', 'a4'].map((id) => makePlayer(id, 'ATA')),
      makePlayer('g1', 'GOL'),
    ];
    const placed = assignFormationPlayers(players, 'F11', '4-4-2', 'g1');
    const defendersOnBackLine = placed.filter(
      (entry) => entry.player.position === 'ZAG' && entry.y >= 74,
    );
    expect(defendersOnBackLine).toHaveLength(4);
  });

  it('usa o goleiro escolhido à mão, mesmo fora da posição', () => {
    const players = [makePlayer('g1', 'GOL'), makePlayer('g2', 'GOL'), ...['z1', 'z2'].map((id) => makePlayer(id, 'ZAG'))];
    const placed = assignFormationPlayers(players, 'F5', '1-2-1', 'g2');
    const keeper = placed.find((entry) => entry.y === getFormation('F5', '1-2-1').slots[0].y);
    expect(keeper?.player.id).toBe('g2');
  });

  it('time incompleto mantém o desenho, sem empilhar', () => {
    const players = squad('F7').slice(0, 4);
    const placed = assignFormationPlayers(players, 'F7', '2-3-1', 'gol0');
    expect(placed).toHaveLength(4);
    const rows = new Set(placed.map((entry) => entry.y));
    expect(rows.size).toBeGreaterThan(1);
  });

  it('time maior que o esquema coloca o excedente numa linha extra à frente', () => {
    const players = [
      makePlayer('gol', 'GOL'),
      makePlayer('z1', 'ZAG'),
      makePlayer('z2', 'ZAG'),
      makePlayer('m1', 'MEI'),
      makePlayer('m2', 'MEI'),
      makePlayer('m3', 'MEI'),
      makePlayer('a1', 'ATA'),
      makePlayer('a2', 'ATA'),
    ];
    const placed = assignFormationPlayers(players, 'F5', '1-2-1', 'gol');

    expect(placed).toHaveLength(players.length);
    expect(new Set(placed.map((entry) => entry.player.id)).size).toBe(players.length);

    // as 5 vagas do esquema foram preenchidas e o excedente foi para uma linha
    // extra, adiante de tudo — sem empilhar ninguém
    expect(new Set(placed.map((entry) => `${entry.x}:${entry.y}`)).size).toBe(placed.length);
    const frontLine = Math.min(...getFormation('F5', '1-2-1').slots.map((slot) => slot.y));
    const extras = placed.filter((entry) => entry.y < frontLine);
    expect(extras).toHaveLength(players.length - 5);
  });

  it('assignFormationPositions continua funcionando como antes (esquema padrão)', () => {
    const players = squad('F7');
    const placed = assignFormationPositions(players, 'F7', 'gol0');
    expect(placed).toHaveLength(players.length);
  });

  it('o campo comporta as quatro linhas do campo de 11', () => {
    // menor folga entre linhas que o cartão precisa suportar
    const radius = 36;
    const chipHeight = radius * 0.6 + 26;
    const rows = 4;
    const halfNeed = (rows - 1) * (radius * 2 + 24) + chipHeight + radius;
    expect(LINEUP_FIELD.h / 2).toBeGreaterThan(halfNeed);
  });
});
