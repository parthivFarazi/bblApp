import {
  Game,
  GameEvent,
  IndividualStatsRow,
  PlayerIdentity,
  StatScope,
  TeamStatsRow,
} from '@/types';

type Totals = {
  atBats: number;
  singles: number;
  doubles: number;
  triples: number;
  homeruns: number;
  strikeouts: number;
  catches: number;
  errors: number;
  stealsAttempted: number;
  stealsWon: number;
  stealsLost: number;
  basesDefended: number;
  basesDefendedSuccessful: number;
  basesStolen: number;
  hits: number;
  totalBases: number;
  rbi: number;
};

const zeroTotals = (): Totals => ({
  atBats: 0,
  singles: 0,
  doubles: 0,
  triples: 0,
  homeruns: 0,
  strikeouts: 0,
  catches: 0,
  errors: 0,
  stealsAttempted: 0,
  stealsWon: 0,
  stealsLost: 0,
  basesDefended: 0,
  basesDefendedSuccessful: 0,
  basesStolen: 0,
  hits: 0,
  totalBases: 0,
  rbi: 0,
});

const eventBaseValue: Record<string, number> = {
  single: 1,
  double: 2,
  triple: 3,
  homerun: 4,
};

const defaultScopeYear = (games: Game[]) => {
  const years = [...new Set(games.map((g) => new Date(g.startTime).getFullYear()))];
  return years.sort((a, b) => b - a)[0] ?? new Date().getFullYear();
};

export const filterEventsByScope = (
  events: GameEvent[],
  games: Game[],
  scope: StatScope,
  opts?: { year?: number; leagueId?: string },
) => {
  if (scope === 'overall') {
    return events;
  }

  const lookup = new Map(games.map((game) => [game.id, game]));

  if (scope === 'year') {
    const targetYear = opts?.year ?? defaultScopeYear(games);
    return events.filter((event) => {
      const game = lookup.get(event.gameId);
      if (!game) return false;
      return new Date(game.startTime).getFullYear() === targetYear;
    });
  }

  if (scope === 'league') {
    return events.filter((event) => {
      const game = lookup.get(event.gameId);
      if (!game) return false;
      if (opts?.leagueId) {
        return game.leagueId === opts.leagueId;
      }
      return game.type === 'league';
    });
  }

  return events;
};

export interface IndividualLeaderboardConfig {
  events: GameEvent[];
  games: Game[];
  players: PlayerIdentity[];
  scope: StatScope;
  year?: number;
  leagueId?: string;
  sortBy?: keyof IndividualStatsRow['stats'];
}

const ensurePlayerTotals = (
  store: Record<string, Totals>,
  playerId: string,
): Totals => {
  if (!store[playerId]) {
    store[playerId] = zeroTotals();
  }
  return store[playerId];
};

export const buildIndividualLeaderboard = ({
  events,
  games,
  players,
  scope,
  year,
  leagueId,
  sortBy = 'slugging',
}: IndividualLeaderboardConfig): IndividualStatsRow[] => {
  const scopedEvents = filterEventsByScope(events, games, scope, { year, leagueId });
  const playerDirectory = new Map(players.map((p) => [p.id, p]));
  const guestIds = new Set(players.filter((p) => p.isGuest).map((p) => p.id));
  const totals: Record<string, Totals> = {};
  const gameParticipation = new Map<string, Set<string>>();
  const metaByKey = new Map<
    string,
    {
      displayName: string;
      brotherId?: string;
      teamId?: string;
    }
  >();

  const resolveKey = (playerId?: string | null) => {
    if (!playerId) return null;
    const player = playerDirectory.get(playerId);
    if (player?.isGuest) return null;
    const displayName = player?.displayName ?? 'Unknown Player';
    const baseKey =
      player?.brotherId && player.brotherId.trim().length
        ? player.brotherId
        : displayName.toLowerCase();
    if (!metaByKey.has(baseKey)) {
      metaByKey.set(baseKey, {
        displayName,
        brotherId: player?.brotherId,
        teamId: player?.teamId,
      });
    }
    return baseKey;
  };

  const markGameParticipation = (playerId: string, gameId: string) => {
    if (!gameParticipation.has(playerId)) {
      gameParticipation.set(playerId, new Set());
    }
    gameParticipation.get(playerId)?.add(gameId);
  };

  scopedEvents.forEach((event) => {
    const batterKey = resolveKey(event.batterId);
    if (!batterKey) return;
    const batterTotals = ensurePlayerTotals(totals, batterKey);
    markGameParticipation(batterKey, event.gameId);

    switch (event.eventType) {
      case 'single':
      case 'double':
      case 'triple':
      case 'homerun': {
        const bases = eventBaseValue[event.eventType];
        batterTotals.atBats += 1;
        batterTotals.hits += 1;
        batterTotals.totalBases += bases;
        batterTotals.rbi += event.rbi;

        if (event.eventType === 'single') batterTotals.singles += 1;
        if (event.eventType === 'double') batterTotals.doubles += 1;
        if (event.eventType === 'triple') batterTotals.triples += 1;
        if (event.eventType === 'homerun') batterTotals.homeruns += 1;
        break;
      }
      case 'strikeout':
        batterTotals.atBats += 1;
        batterTotals.strikeouts += 1;
        break;
      case 'caught_out':
        batterTotals.atBats += 1;
        break;
      case 'error': {
        const defenderKey = resolveKey(event.defenderId);
        if (defenderKey) {
          const defenderTotals = ensurePlayerTotals(totals, defenderKey);
          defenderTotals.errors += 1;
        }
        break;
      }
      case 'steal_success':
      case 'steal_fail': {
        const runnerKey = resolveKey(event.runnerId);
        if (runnerKey) {
          const runnerTotals = ensurePlayerTotals(totals, runnerKey);
          markGameParticipation(runnerKey, event.gameId);
          runnerTotals.stealsAttempted += 1;
          if (event.eventType === 'steal_success') {
            runnerTotals.stealsWon += 1;
            runnerTotals.basesStolen += 1;
            runnerTotals.rbi += event.rbi ?? 0;
          } else {
            runnerTotals.stealsLost += 1;
          }
        }
        const defenderKey = resolveKey(event.defenderId);
        if (defenderKey) {
          const defenderTotals = ensurePlayerTotals(totals, defenderKey);
          markGameParticipation(defenderKey, event.gameId);
          defenderTotals.basesDefended += 1;
          if (event.eventType === 'steal_fail') {
            defenderTotals.basesDefendedSuccessful += 1;
          }
        }
        break;
      }
      case 'strike':
        break;
    }

    if (event.eventType === 'caught_out') {
      const defenderKey = resolveKey(event.defenderId);
      if (!defenderKey) return;
      const defenderTotals = ensurePlayerTotals(totals, defenderKey);
      defenderTotals.catches += 1;
    }
  });

  const rows: IndividualStatsRow[] = Object.entries(totals).map(([playerKey, statTotals]) => {
    const hits = statTotals.hits;
    const atBats = statTotals.atBats || 1;
    const meta = metaByKey.get(playerKey);
    return {
      playerId: playerKey,
      displayName: meta?.displayName ?? 'Unknown Player',
      brotherId: meta?.brotherId,
      teamId: meta?.teamId,
      stats: {
        gamesPlayed: gameParticipation.get(playerKey)?.size ?? 0,
        atBats: statTotals.atBats,
        hits,
        singles: statTotals.singles,
        doubles: statTotals.doubles,
        triples: statTotals.triples,
        homeruns: statTotals.homeruns,
        strikeouts: statTotals.strikeouts,
        battingAverage: statTotals.atBats ? hits / statTotals.atBats : 0,
        slugging: statTotals.atBats ? statTotals.totalBases / statTotals.atBats : 0,
        catches: statTotals.catches,
        errors: statTotals.errors,
        stealsAttempted: statTotals.stealsAttempted,
        stealsWon: statTotals.stealsWon,
        stealsLost: statTotals.stealsLost,
        basesDefended: statTotals.basesDefended,
        basesDefendedSuccessful: statTotals.basesDefendedSuccessful,
        basesStolen: statTotals.basesStolen,
        rbi: statTotals.rbi,
      },
    };
  });

  return rows.sort((a, b) => b.stats[sortBy] - a.stats[sortBy]);
};

export interface TeamLeaderboardConfig {
  teamIds: string[];
  teamLabelLookup: Record<string, string>;
  scope: StatScope;
  games: Game[];
  events: GameEvent[];
  players: PlayerIdentity[];
  leagueId?: string;
  year?: number;
}

export const buildTeamLeaderboard = ({
  teamIds,
  teamLabelLookup,
  scope,
  games,
  events,
  players,
  leagueId,
  year,
}: TeamLeaderboardConfig): TeamStatsRow[] => {
  const scopedEvents = filterEventsByScope(events, games, scope, { year, leagueId });
  const playerStats = buildIndividualLeaderboard({
    events: scopedEvents,
    games,
    players,
    scope: 'overall',
  });
  const playerById = new Map(playerStats.map((row) => [row.playerId, row.stats]));
  const rows: TeamStatsRow[] = [];

  teamIds.forEach((teamId) => {
    const stats = {
      gamesPlayed: 0,
      averageScore: 0,
      atBats: 0,
      hits: 0,
      singles: 0,
      doubles: 0,
      triples: 0,
      homeruns: 0,
      strikeouts: 0,
      battingAverage: 0,
      slugging: 0,
    catches: 0,
    errors: 0,
    stealsAttempted: 0,
    stealsWon: 0,
    stealsLost: 0,
    basesDefended: 0,
    basesDefendedSuccessful: 0,
    basesStolen: 0,
  };

    const teamGames = games.filter((game) => {
      const isParticipant = game.homeTeamId === teamId || game.awayTeamId === teamId;
      if (!isParticipant) return false;
      if (scope === 'league') {
        if (leagueId) {
          return game.leagueId === leagueId;
        }
        return game.type === 'league';
      }
      if (scope === 'year' && year) {
        return new Date(game.startTime).getFullYear() === year;
      }
      return true;
    });

    stats.gamesPlayed = teamGames.length;
    if (teamGames.length) {
      const totalRuns = teamGames.reduce((sum, game) => {
        const isHome = game.homeTeamId === teamId;
        const runs = game.finalScore
          ? isHome
            ? game.finalScore.home
            : game.finalScore.away
          : 0;
        return sum + runs;
      }, 0);
      stats.averageScore = totalRuns / teamGames.length;
    }

    playerStats.forEach((row) => {
      if (row.teamId && row.teamId !== teamId) {
        return;
      }
      const details = playerById.get(row.playerId);
      if (!details) return;
      stats.atBats += details.atBats;
      stats.hits += details.hits;
      stats.singles += details.singles;
      stats.doubles += details.doubles;
      stats.triples += details.triples;
      stats.homeruns += details.homeruns;
      stats.strikeouts += details.strikeouts;
      stats.catches += details.catches;
      stats.errors += details.errors;
      stats.stealsAttempted += details.stealsAttempted;
      stats.stealsWon += details.stealsWon;
      stats.stealsLost += details.stealsLost;
      stats.basesDefended += details.basesDefended;
      stats.basesDefendedSuccessful += details.basesDefendedSuccessful ?? 0;
      stats.basesStolen += details.basesStolen;
    });

    stats.battingAverage = stats.atBats ? stats.hits / stats.atBats : 0;
    const totalBases =
      stats.singles + stats.doubles * 2 + stats.triples * 3 + stats.homeruns * 4;
    stats.slugging = stats.atBats ? totalBases / stats.atBats : 0;

    rows.push({
      teamId,
      label: teamLabelLookup[teamId] ?? 'Unknown Team',
      scope,
      stats,
    });
  });

  return rows.sort((a, b) => b.stats.slugging - a.stats.slugging);
};
