export type Position = 'GOL' | 'ZAG' | 'MEI' | 'ATA';

export type MatchFormat = 'F5' | 'F7' | 'F11';

export type Player = {
  id: string;
  name: string;
  nickname: string;
  number: number;
  position: Position;
  photoUrl?: string;
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
  createdAt: string;
  isAvulso?: boolean;
  matchId?: string;
  avulsoValue?: number;
};

export type MatchEventType = 'goal' | 'save' | 'frango' | 'yellow' | 'red' | 'substitution';

export type MatchEvent = {
  id: string;
  type: MatchEventType;
  playerId: string;
  assistPlayerId?: string;
  team: 'A' | 'B';
  minute: number;
  createdAt: string;
  // For substitution events
  playerOutId?: string;
  // For own goal / frango
  isOwnGoal?: boolean;
};

export type FieldPositions = Record<string, { x: number; y: number }>;

export type Match = {
  id: string;
  title: string;
  venue: string;
  date: string;
  time: string;
  status: 'scheduled' | 'live' | 'finished';
  teamAName: string;
  teamBName: string;
  teamA: string[];
  teamB: string[];
  scoreA: number;
  scoreB: number;
  events: MatchEvent[];
  createdAt: string;
  format?: MatchFormat;
  fieldPositions?: FieldPositions;
  startedAt?: string;
  goalkeeperAId?: string;
  goalkeeperBId?: string;
};

export type Payment = {
  id: string;
  playerId: string;
  month: string;
  amount: number;
  paid: boolean;
  paidAt?: string;
};

export type PlayerStats = {
  player: Player;
  goals: number;
  assists: number;
  saves: number;
  appearances: number;
  wins: number;
  draws: number;
  losses: number;
  overall: number;
};

export type LineupExportOptions = {
  format: 'png' | 'jpeg';
  quality?: number;
  width?: number;
  height?: number;
  includeNames?: boolean;
  includeNumbers?: boolean;
};