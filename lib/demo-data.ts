import type { Match, Payment, Player } from './fut-types';

export const demoPlayers: Player[] = [
  { id: 'matheus', name: 'Matheus Oliveira', nickname: 'Matheus', number: 10, position: 'ATA', pace: 84, shooting: 88, passing: 76, defending: 42, physical: 78, createdAt: '2026-08-01T12:00:00.000Z' },
  { id: 'juninho', name: 'Junior Pereira', nickname: 'Juninho', number: 7, position: 'MEI', pace: 82, shooting: 80, passing: 87, defending: 52, physical: 69, createdAt: '2026-08-01T12:01:00.000Z' },
  { id: 'caio', name: 'Caio Henrique', nickname: 'Caio', number: 9, position: 'ATA', pace: 79, shooting: 84, passing: 72, defending: 39, physical: 81, createdAt: '2026-08-01T12:02:00.000Z' },
  { id: 'biel', name: 'Gabriel Santos', nickname: 'Biel', number: 11, position: 'ATA', pace: 88, shooting: 79, passing: 74, defending: 38, physical: 72, createdAt: '2026-08-01T12:03:00.000Z' },
  { id: 'rafa', name: 'Rafael Lima', nickname: 'Rafa', number: 1, position: 'GOL', pace: 58, shooting: 45, passing: 70, defending: 89, physical: 82, createdAt: '2026-08-01T12:04:00.000Z' },
  { id: 'dudu', name: 'Eduardo Alves', nickname: 'Dudu', number: 4, position: 'ZAG', pace: 68, shooting: 55, passing: 68, defending: 86, physical: 88, createdAt: '2026-08-01T12:05:00.000Z' },
  { id: 'pedro', name: 'Pedro Martins', nickname: 'Pedrinho', number: 8, position: 'MEI', pace: 77, shooting: 73, passing: 84, defending: 61, physical: 70, createdAt: '2026-08-01T12:06:00.000Z' },
  { id: 'lucas', name: 'Lucas Rocha', nickname: 'Luquinha', number: 5, position: 'ZAG', pace: 72, shooting: 58, passing: 71, defending: 82, physical: 85, createdAt: '2026-08-01T12:07:00.000Z' },
  { id: 'bruno', name: 'Bruno Costa', nickname: 'Brunão', number: 12, position: 'GOL', pace: 55, shooting: 42, passing: 66, defending: 86, physical: 87, createdAt: '2026-08-01T12:08:00.000Z' },
  { id: 'leo', name: 'Leonardo Souza', nickname: 'Léo', number: 6, position: 'MEI', pace: 80, shooting: 72, passing: 82, defending: 66, physical: 73, createdAt: '2026-08-01T12:09:00.000Z' },
];

export const demoMatches: Match[] = [
  {
    id: 'jogo-2026-09-01', title: 'Fut das quintas', venue: 'Arena Gol de Placa · Quadra 2', date: '2026-09-01', time: '21:00', status: 'live', teamAName: 'Time Verde', teamBName: 'Time Branco', teamA: ['matheus', 'caio', 'rafa', 'dudu', 'pedro'], teamB: ['juninho', 'biel', 'bruno', 'lucas', 'leo'], scoreA: 5, scoreB: 4,
    events: [
      { id: 'e1', type: 'goal', playerId: 'matheus', assistPlayerId: 'pedro', team: 'A', minute: 4, createdAt: '2026-09-01T21:04:00.000Z' },
      { id: 'e2', type: 'goal', playerId: 'juninho', assistPlayerId: 'leo', team: 'B', minute: 8, createdAt: '2026-09-01T21:08:00.000Z' },
      { id: 'e3', type: 'goal', playerId: 'matheus', team: 'A', minute: 12, createdAt: '2026-09-01T21:12:00.000Z' },
      { id: 'e4', type: 'goal', playerId: 'biel', assistPlayerId: 'juninho', team: 'B', minute: 18, createdAt: '2026-09-01T21:18:00.000Z' },
      { id: 'e5', type: 'goal', playerId: 'caio', assistPlayerId: 'matheus', team: 'A', minute: 25, createdAt: '2026-09-01T21:25:00.000Z' },
      { id: 'e6', type: 'goal', playerId: 'juninho', team: 'B', minute: 29, createdAt: '2026-09-01T21:29:00.000Z' },
      { id: 'e7', type: 'goal', playerId: 'matheus', assistPlayerId: 'caio', team: 'A', minute: 34, createdAt: '2026-09-01T21:34:00.000Z' },
      { id: 'e8', type: 'goal', playerId: 'biel', assistPlayerId: 'leo', team: 'B', minute: 37, createdAt: '2026-09-01T21:37:00.000Z' },
      { id: 'e9', type: 'goal', playerId: 'caio', assistPlayerId: 'pedro', team: 'A', minute: 41, createdAt: '2026-09-01T21:41:00.000Z' },
      { id: 's1', type: 'save', playerId: 'rafa', team: 'A', minute: 40, createdAt: '2026-09-01T21:40:00.000Z' },
    ], createdAt: '2026-09-01T20:30:00.000Z',
  },
  {
    id: 'jogo-2026-08-27', title: 'Fut das quintas', venue: 'Arena Gol de Placa', date: '2026-08-27', time: '21:00', status: 'finished', teamAName: 'Time Verde', teamBName: 'Time Branco', teamA: ['matheus', 'juninho', 'rafa', 'lucas', 'leo'], teamB: ['caio', 'biel', 'bruno', 'dudu', 'pedro'], scoreA: 7, scoreB: 5,
    events: [
      { id: 'a1', type: 'goal', playerId: 'matheus', assistPlayerId: 'juninho', team: 'A', minute: 5, createdAt: '2026-08-27T21:05:00.000Z' },
      { id: 'a2', type: 'goal', playerId: 'matheus', assistPlayerId: 'leo', team: 'A', minute: 16, createdAt: '2026-08-27T21:16:00.000Z' },
      { id: 'a3', type: 'goal', playerId: 'juninho', assistPlayerId: 'matheus', team: 'A', minute: 21, createdAt: '2026-08-27T21:21:00.000Z' },
      { id: 'a4', type: 'goal', playerId: 'caio', assistPlayerId: 'pedro', team: 'B', minute: 8, createdAt: '2026-08-27T21:08:00.000Z' },
      { id: 'a5', type: 'goal', playerId: 'biel', team: 'B', minute: 29, createdAt: '2026-08-27T21:29:00.000Z' },
      { id: 'a6', type: 'save', playerId: 'rafa', team: 'A', minute: 32, createdAt: '2026-08-27T21:32:00.000Z' },
      { id: 'a7', type: 'save', playerId: 'rafa', team: 'A', minute: 36, createdAt: '2026-08-27T21:36:00.000Z' },
    ], createdAt: '2026-08-27T20:30:00.000Z',
  },
];

export const demoPayments: Payment[] = demoPlayers.map((player, index) => ({
  id: `2026-09_${player.id}`,
  playerId: player.id,
  month: '2026-09',
  amount: 40,
  paid: index < 7,
  paidAt: index < 7 ? `2026-09-0${(index % 7) + 1}T12:00:00.000Z` : undefined,
}));
