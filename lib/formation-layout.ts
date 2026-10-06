import type { MatchFormat, Player, Position } from './fut-types';
import { calcOverall } from './player-rating';

export interface FormationPlayer {
  player: Player;
  x: number;
  y: number;
}

/**
 * Vaga do esquema.
 *
 * `x` é a largura (0 = esquerda, 100 = direita) e `y` é a profundidade medida do
 * ATAQUE para o próprio gol: 25 é a linha de ataque e ~91 fica dentro da área.
 * A convenção é a mesma que o resto do app já usa para desenhar o campo, então
 * um esquema aqui aparece igual no quadro tático e no quadro de exportação.
 */
export interface FormationSlot {
  position: Position;
  x: number;
  y: number;
}

export interface Formation {
  /** Ex.: '1-2-1-1', '4-3-3'. */
  id: string;
  label: string;
  /** Resumo tático para o seletor. */
  hint: string;
  slots: FormationSlot[];
}

/** Ordem das linhas, do ataque para o gol. */
const ROW_ORDER: Position[] = ['ATA', 'MEI', 'ZAG', 'GOL'];

/** Ordem de prioridade ao encaixar jogador na vaga da própria posição. */
const FILL_ORDER: Position[] = ['GOL', 'ZAG', 'MEI', 'ATA'];

function slot(position: Position, x: number, y: number): FormationSlot {
  return { position, x, y };
}

function goalkeeper(): FormationSlot {
  return slot('GOL', 50, 91);
}

/** Monta o resumo tipo "1-2-1" contando as linhas (sem o goleiro). */
function describe(slots: FormationSlot[]): string {
  const outfield = slots.filter((item) => item.position !== 'GOL');
  const rows = new Map<number, number>();
  for (const item of outfield) rows.set(item.y, (rows.get(item.y) ?? 0) + 1);
  return [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, count]) => count)
    .join('-');
}

/**
 * Esquemas por formato, do mais comum para o menos.
 *
 * Coordenadas pensadas no desenho real de cada formato:
 * - futsal/fut6 usam o campo curto, então as linhas ficam mais próximas;
 * - fut7 tem 3 linhas de linha e um pivô;
 * - campo usa as quatro linhas clássicas.
 */
const FORMATIONS: Record<MatchFormat, Formation[]> = {
  F5: [
    {
      id: '1-2-1',
      label: '1-2-1 (losango)',
      hint: 'Fixos atrás, dois alas abertos, pivô na frente',
      slots: [goalkeeper(), slot('ZAG', 50, 74), slot('MEI', 26, 55), slot('MEI', 74, 55), slot('ATA', 50, 30)],
    },
    {
      id: '1-1-2',
      label: '1-1-2',
      hint: 'Um fixo, um armador e dois atacantes',
      slots: [goalkeeper(), slot('ZAG', 50, 74), slot('MEI', 50, 52), slot('ATA', 30, 28), slot('ATA', 70, 28)],
    },
    {
      id: '2-2',
      label: '2-2 (quadrado)',
      hint: 'Dois fixos e dois atacantes, marcação por zona',
      slots: [goalkeeper(), slot('ZAG', 32, 70), slot('ZAG', 68, 70), slot('ATA', 32, 36), slot('ATA', 68, 36)],
    },
    {
      id: '1-3',
      label: '1-3',
      hint: 'Um fixo e três na frente, pressão alta',
      slots: [goalkeeper(), slot('ZAG', 50, 72), slot('MEI', 25, 42), slot('ATA', 50, 28), slot('MEI', 75, 42)],
    },
  ],
  F6: [
    {
      id: '1-2-2',
      label: '1-2-2',
      hint: 'Equilíbrio: dois na marcação e dois no ataque',
      slots: [
        goalkeeper(),
        slot('ZAG', 30, 74),
        slot('ZAG', 70, 74),
        slot('MEI', 32, 48),
        slot('MEI', 68, 48),
        slot('ATA', 50, 26),
      ],
    },
    {
      id: '1-3-1',
      label: '1-3-1',
      hint: 'Três no meio, um pivô — controle de jogo',
      slots: [
        goalkeeper(),
        slot('ZAG', 50, 76),
        slot('MEI', 22, 52),
        slot('MEI', 50, 46),
        slot('MEI', 78, 52),
        slot('ATA', 50, 26),
      ],
    },
    {
      id: '2-1-2',
      label: '2-1-2',
      hint: 'Dois fixos, um armador central e dois atacantes',
      slots: [
        goalkeeper(),
        slot('ZAG', 32, 72),
        slot('ZAG', 68, 72),
        slot('MEI', 50, 50),
        slot('ATA', 32, 28),
        slot('ATA', 68, 28),
      ],
    },
  ],
  F7: [
    {
      id: '2-3-1',
      label: '2-3-1',
      hint: 'O mais comum no fut7: sólido atrás, três no meio',
      slots: [
        goalkeeper(),
        slot('ZAG', 32, 74),
        slot('ZAG', 68, 74),
        slot('MEI', 24, 52),
        slot('MEI', 50, 46),
        slot('MEI', 76, 52),
        slot('ATA', 50, 26),
      ],
    },
    {
      id: '3-2-1',
      label: '3-2-1',
      hint: 'Três atrás, dois armadores e um pivô',
      slots: [
        goalkeeper(),
        slot('ZAG', 24, 76),
        slot('ZAG', 50, 72),
        slot('ZAG', 76, 76),
        slot('MEI', 34, 48),
        slot('MEI', 66, 48),
        slot('ATA', 50, 26),
      ],
    },
    {
      id: '2-2-2',
      label: '2-2-2',
      hint: 'Dois por linha: defesa, meio e ataque',
      slots: [
        goalkeeper(),
        slot('ZAG', 32, 74),
        slot('ZAG', 68, 74),
        slot('MEI', 32, 50),
        slot('MEI', 68, 50),
        slot('ATA', 32, 26),
        slot('ATA', 68, 26),
      ],
    },
    {
      id: '1-3-2',
      label: '1-3-2',
      hint: 'Um fixo, três no meio e dois na frente',
      slots: [
        goalkeeper(),
        slot('ZAG', 50, 76),
        slot('MEI', 24, 50),
        slot('MEI', 50, 46),
        slot('MEI', 76, 50),
        slot('ATA', 34, 26),
        slot('ATA', 66, 26),
      ],
    },
  ],
  F11: [
    {
      id: '4-4-2',
      label: '4-4-2',
      hint: 'O clássico: duas linhas de quatro e dois atacantes',
      slots: [
        goalkeeper(),
        slot('ZAG', 16, 76),
        slot('ZAG', 38, 80),
        slot('ZAG', 62, 80),
        slot('ZAG', 84, 76),
        slot('MEI', 16, 50),
        slot('MEI', 38, 54),
        slot('MEI', 62, 54),
        slot('MEI', 84, 50),
        slot('ATA', 38, 26),
        slot('ATA', 62, 26),
      ],
    },
    {
      id: '4-3-3',
      label: '4-3-3',
      hint: 'Linha de quatro, meio de três e pontas abertos',
      slots: [
        goalkeeper(),
        slot('ZAG', 16, 76),
        slot('ZAG', 38, 80),
        slot('ZAG', 62, 80),
        slot('ZAG', 84, 76),
        slot('MEI', 28, 54),
        slot('MEI', 50, 48),
        slot('MEI', 72, 54),
        slot('ATA', 20, 26),
        slot('ATA', 50, 22),
        slot('ATA', 80, 26),
      ],
    },
    {
      id: '4-2-3-1',
      label: '4-2-3-1',
      hint: 'Dois volantes, três por dentro e um centroavante',
      slots: [
        goalkeeper(),
        slot('ZAG', 16, 76),
        slot('ZAG', 38, 80),
        slot('ZAG', 62, 80),
        slot('ZAG', 84, 76),
        slot('MEI', 36, 58),
        slot('MEI', 64, 58),
        slot('MEI', 20, 34),
        slot('MEI', 50, 32),
        slot('MEI', 80, 34),
        slot('ATA', 50, 18),
      ],
    },
    {
      id: '3-5-2',
      label: '3-5-2',
      hint: 'Três zagueiros, alas largos e dois atacantes',
      slots: [
        goalkeeper(),
        slot('ZAG', 28, 80),
        slot('ZAG', 50, 78),
        slot('ZAG', 72, 80),
        slot('MEI', 12, 52),
        slot('MEI', 34, 54),
        slot('MEI', 50, 48),
        slot('MEI', 66, 54),
        slot('MEI', 88, 52),
        slot('ATA', 38, 26),
        slot('ATA', 62, 26),
      ],
    },
    {
      id: '5-3-2',
      label: '5-3-2',
      hint: 'Retranca com cinco atrás e dois no contra-ataque',
      slots: [
        goalkeeper(),
        slot('ZAG', 10, 58),
        slot('ZAG', 30, 80),
        slot('ZAG', 50, 82),
        slot('ZAG', 70, 80),
        slot('ZAG', 90, 58),
        slot('MEI', 30, 48),
        slot('MEI', 50, 44),
        slot('MEI', 70, 48),
        slot('ATA', 38, 24),
        slot('ATA', 62, 24),
      ],
    },
  ],
};

export interface FormationOption {
  id: string;
  label: string;
  hint: string;
}

export function listFormations(format: MatchFormat): FormationOption[] {
  return FORMATIONS[format].map(({ id, label, hint, slots }) => ({
    id,
    label: label || describe(slots),
    hint,
  }));
}

export function getFormation(format: MatchFormat, id?: string): Formation {
  const options = FORMATIONS[format];
  return options.find((item) => item.id === id) ?? options[0];
}

export function defaultFormationId(format: MatchFormat): string {
  return FORMATIONS[format][0].id;
}

function roleDistance(player: Position, wanted: Position): number {
  if (player === wanted) return 0;
  if (player === 'GOL' || wanted === 'GOL') return 10;
  return Math.abs(ROW_ORDER.indexOf(player) - ROW_ORDER.indexOf(wanted));
}

/**
 * Encaixa os jogadores no esquema escolhido.
 *
 * O preenchimento é feito em DUAS passadas, por posição:
 *
 * 1. quem joga na posição (ZAG na zaga, MEI no meio, ATA no ataque) pega a vaga
 *    da sua posição, do ataque para a defesa e com as laterais na frente;
 * 2. só depois as vagas que sobraram são preenchidas com quem não é da posição.
 *
 * Sem essa ordem, o encaixe "melhor esforço" gastava as vagas de zaga com
 * atacantes e deixava zagueiros de fora — a escalação saía trocada. O goleiro
 * escolhido à mão tem prioridade absoluta na vaga do gol.
 */
export function assignFormationPlayers(
  players: Player[],
  format: MatchFormat,
  formationId?: string,
  goalkeeperId?: string,
): FormationPlayer[] {
  const slots = getFormation(format, formationId).slots;
  const remaining = [...players];
  const filled = new Map<number, Player>();

  /** Índice, em `remaining`, de quem melhor serve para a vaga. */
  function bestFor(slotPosition: Position): number {
    if (!remaining.length) return -1;
    let best = 0;
    for (let index = 1; index < remaining.length; index += 1) {
      const current = roleDistance(remaining[index].position, slotPosition);
      const champion = roleDistance(remaining[best].position, slotPosition);
      if (current < champion) best = index;
      else if (current === champion && calcOverall(remaining[index]) > calcOverall(remaining[best])) best = index;
    }
    return best;
  }

  function take(slotIndex: number): void {
    const slot = slots[slotIndex];
    const chosen = bestFor(slot.position);
    if (chosen < 0) return;
    filled.set(slotIndex, remaining[chosen]);
    remaining.splice(chosen, 1);
  }

  // 1. goleiro: escolhido à mão > especialista > melhor defesa
  const goalSlot = slots.findIndex((item) => item.position === 'GOL');
  if (goalSlot >= 0) {
    let keeperIndex = -1;
    if (goalkeeperId) keeperIndex = remaining.findIndex((player) => player.id === goalkeeperId);
    if (keeperIndex < 0) keeperIndex = remaining.findIndex((player) => player.position === 'GOL');
    if (keeperIndex < 0) keeperIndex = bestFor('GOL');
    if (keeperIndex >= 0) {
      filled.set(goalSlot, remaining[keeperIndex]);
      remaining.splice(keeperIndex, 1);
    }
  }

  // ordem de preenchimento: ataque primeiro, e dentro da linha as laterais antes
  // do centro (quem é ponta se encaixa na lateral e o centro fica para o pivô)
  const ordered = slots
    .map((item, index) => ({ item, index }))
    .filter(({ index }) => index !== goalSlot)
    .sort(
      (a, b) =>
        a.item.y - b.item.y ||
        Math.abs(b.item.x - 50) - Math.abs(a.item.x - 50),
    );

  // 2. passada 1: cada jogador na vaga da própria posição
  for (const position of FILL_ORDER) {
    for (const { item, index } of ordered) {
      if (filled.has(index) || item.position !== position) continue;
      if (!remaining.some((player) => player.position === position)) break;
      take(index);
    }
  }

  // 3. passada 2: quem sobrou completa as vagas restantes
  for (const { index } of ordered) {
    if (filled.has(index)) continue;
    if (!remaining.length) break;
    take(index);
  }

  // 4. time maior que o esquema: excedente numa linha extra ADIANTE de todas as
  //    vagas do esquema, espalhado na largura
  const extra = remaining.length;
  const frontLine = Math.min(...slots.map((slot) => slot.y));
  const extraRows = extra > 0 ? [Math.max(6, frontLine - 14), Math.max(10, frontLine - 8)] : [];
  const result: FormationPlayer[] = [];
  for (const [index, player] of filled) {
    const target = slots[index];
    result.push({ player, x: target.x, y: target.y });
  }
  remaining.forEach((player, position) => {
    result.push({
      player,
      x: extra <= 1 ? 50 : (100 / (extra + 1)) * (position + 1),
      y: extraRows[position % extraRows.length] ?? Math.max(6, frontLine - 12),
    });
  });

  // mantém a ordem do plantel para o desenho/animação ficar estável
  const order = new Map(players.map((player, index) => [player.id, index]));
  return result.sort((a, b) => (order.get(a.player.id) ?? 0) - (order.get(b.player.id) ?? 0));
}

/** Compatibilidade com o código que já usava o esquema padrão do formato. */
export function assignFormationPositions(
  players: Player[],
  format: MatchFormat,
  goalkeeperId?: string,
): FormationPlayer[] {
  return assignFormationPlayers(players, format, undefined, goalkeeperId);
}
