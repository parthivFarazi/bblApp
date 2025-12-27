export type UserRole = 'guest' | 'brother';

export type GameMode = 'friendly' | 'league';

export type GameHalf = 'top' | 'bottom';

export type EventType =
  | 'single'
  | 'double'
  | 'triple'
  | 'homerun'
  | 'strike'
  | 'error'
  | 'strikeout'
  | 'caught_out'
  | 'steal_success'
  | 'steal_fail';

export type StatScope = 'overall' | 'year' | 'league';

export interface Brother {
  id: string;
  firstName: string;
  lastName: string;
  pledgeClass: string;
  duNickname?: string;
  handedness?: 'R' | 'L';
  throws?: 'R' | 'L';
}

export interface GuestPlayer {
  id: string;
  displayName: string;
}

export interface League {
  id: string;
  name: string;
  year: number;
  commissionerId?: string;
}

export interface LeagueTeam {
  id: string;
  leagueId: string;
  name: string;
  color: string;
  slug: string;
}

export interface LeagueTeamMember {
  id: string;
  teamId: string;
  brotherId: string;
  battingOrder: number;
  isActive: boolean;
  displayName?: string;
}

export interface Game {
  id: string;
  type: GameMode;
  leagueId?: string;
  seasonLabel?: string;
  homeTeamId: string;
  awayTeamId: string;
  plannedInnings: number;
  location?: string;
  startTime: string;
  completedAt?: string;
  notes?: string;
  finalScore?: {
    home: number;
    away: number;
  };
}

export interface GamePlayer {
  id: string;
  gameId: string;
  teamId: string;
  brotherId?: string;
  guestName?: string;
  battingOrder: number;
  isActive: boolean;
}

export interface BaseState {
  first: string | null;
  second: string | null;
  third: string | null;
}

export interface GameEvent {
  id: string;
  gameId: string;
  eventType: EventType;
  batterId: string;
  defenderId?: string;
  runnerId?: string;
  inning: number;
  half: GameHalf;
  baseStateBefore: BaseState;
  baseStateAfter: BaseState;
  runsScored: number;
  rbi: number;
  timestamp: number;
  notes?: string;
}

export interface PlayerIdentity {
  id: string;
  displayName: string;
  brotherId?: string;
  isGuest?: boolean;
  teamId?: string;
}

export interface LineupSlot {
  playerId: string;
  identity: PlayerIdentity;
  battingOrder: number;
}

export interface TeamLineupState {
  teamId: string;
  lineup: LineupSlot[];
  currentIndex: number;
}

export interface InningScore {
  inning: number;
  top: number;
  bottom: number;
}

export interface ScoreboardState {
  [teamId: string]: {
    runs: number;
    hits: number;
    errors: number;
    inningRuns: Record<number, number>;
  };
}

export interface LiveGameState {
  gameId: string;
  type: GameMode;
  teamLabels: Record<string, string>;
  teamOrder: string[];
  leagueId?: string;
  inning: number;
  half: GameHalf;
  outs: number;
  strikes: number;
  offenseTeamId: string;
  defenseTeamId: string;
  bases: BaseState;
  scoreboard: ScoreboardState;
  lineups: Record<string, TeamLineupState>;
  plannedInnings: number;
  isComplete: boolean;
}

export interface IndividualStatsRow {
  playerId: string;
  displayName: string;
  brotherId?: string;
  teamId?: string;
  stats: {
    gamesPlayed: number;
    atBats: number;
    hits: number;
    singles: number;
    doubles: number;
    triples: number;
    homeruns: number;
    strikeouts: number;
    battingAverage: number;
    slugging: number;
    catches: number;
    errors: number;
    stealsAttempted: number;
    stealsWon: number;
    stealsLost: number;
    basesDefended: number;
    basesDefendedSuccessful: number;
    basesStolen: number;
    rbi: number;
  };
}

export interface TeamStatsRow {
  teamId: string;
  label: string;
  scope: StatScope;
  stats: {
    gamesPlayed: number;
    averageScore: number;
    wins: number;
    losses: number;
    atBats: number;
    hits: number;
    singles: number;
    doubles: number;
    triples: number;
    homeruns: number;
    strikeouts: number;
    battingAverage: number;
    slugging: number;
    catches: number;
    errors: number;
    stealsAttempted: number;
    stealsWon: number;
    stealsLost: number;
    basesDefended: number;
    basesDefendedSuccessful: number;
    basesStolen: number;
  };
}

export interface GameSummary {
  id: string;
  finalScore: { home: number; away: number };
  inningBreakdown: InningScore[];
  type: GameMode;
  playedAt: string;
  topPerformerIds: string[];
}

export interface FriendlyGameSetupPayload {
  type: 'friendly';
  teamAName: string;
  teamBName: string;
  playerPool: PlayerIdentity[];
  teamAPlayers: PlayerIdentity[];
  teamBPlayers: PlayerIdentity[];
}

export interface LeagueGameSetupPayload {
  type: 'league';
  leagueId?: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  leagueTeamMembers: LeagueTeamMember[];
}

export type GameSetupPayload = FriendlyGameSetupPayload | LeagueGameSetupPayload;
