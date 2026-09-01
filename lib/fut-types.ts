export type Position = 'GOL' | 'ZAG' | 'MEI' | 'ATA';

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
};

export type MatchEvent = {
  id: string;
  type: 'goal' | 'save';
  playerId: string;
  assistPlayerId?: string;
  team: 'A' | 'B';
  minute: number;
  createdAt: string;
};

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
