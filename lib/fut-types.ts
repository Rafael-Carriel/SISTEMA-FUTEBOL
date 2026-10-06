export type Position = 'GOL' | 'ZAG' | 'MEI' | 'ATA';

export type MatchFormat = 'F5' | 'F6' | 'F7' | 'F11';

/** Formatos disponíveis na criação da partida, com quantos jogadores vão a campo. */
export const MATCH_FORMATS: Array<{ value: MatchFormat; label: string; players: number }> = [
  { value: 'F5', label: 'Futsal (5)', players: 5 },
  { value: 'F6', label: 'Fut6 (6)', players: 6 },
  { value: 'F7', label: 'Fut7 (7)', players: 7 },
  { value: 'F11', label: 'Campo (11)', players: 11 },
];

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
  resistance: number;
  strength: number;
  dribbling: number;
  goalkeeping: number;
  createdAt: string;
  isAvulso?: boolean;
  matchId?: string;
  avulsoValue?: number;
  orgId?: string;
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
  /** Esquema tático escolhido para cada time (ver lib/formation-layout). */
  formationA?: string;
  formationB?: string;
  /** Confirmados que ficaram no banco (não entram em campo). */
  bench?: string[];
  fieldPositions?: FieldPositions;
  startedAt?: string;
  goalkeeperAId?: string;
  goalkeeperBId?: string;
  orgId?: string;
};

export type Payment = {
  id: string;
  playerId: string;
  month: string;
  amount: number;
  paid: boolean;
  paidAt?: string;
  orgId?: string;
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

export type Role = 'admin' | 'member';

export type User = {
  id: string;
  email: string;
  displayName: string;
  photoUrl?: string | null;
  phone?: string | null;
  createdAt: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  createdBy: string;
  sport?: string;
  city?: string;
};

export type Member = {
  userId: string;
  orgId: string;
  role: Role;
  joinedAt: string;
  displayName?: string;
  email?: string | null;
  phone?: string | null;
};

export type Invite = {
  id: string;
  email: string;
  role: Role;
  code: string;
  expiresAt: string;
  orgId: string;
  orgName: string;
  createdAt: string;
  status?: 'pending' | 'accepted' | 'revoked';
};