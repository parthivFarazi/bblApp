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
  const gameLookup = new Map(games.map((g) => [g.id, g]));
  const rows: TeamStatsRow[] = [];

  // Build a per-team stat accumulator directly from events using game context
  // instead of relying on the player directory's teamId (which can be stale
  // when a player appears on different teams across games).
  const teamTotals = new Map<string, Totals>();
  const ensureTeamTotals = (id: string) => {
    if (!teamTotals.has(id)) teamTotals.set(id, zeroTotals());
    return teamTotals.get(id)!;
  };

  scopedEvents.forEach((event) => {
    const game = gameLookup.get(event.gameId);
    if (!game) return;

    // The game engine records half:'top' when the HOME team bats (teamA in
    // initialLiveState) and half:'bottom' when the AWAY team bats.  This is
    // the opposite of the standard baseball convention, but it is consistent
    // across all persisted data so we match it here.
    const battingTeamId = event.half === 'top' ? game.homeTeamId : game.awayTeamId;
    const defendingTeamId = event.half === 'top' ? game.awayTeamId : game.homeTeamId;

    const battingTotals = ensureTeamTotals(battingTeamId);

    switch (event.eventType) {
      case 'single':
      case 'double':
      case 'triple':
      case 'homerun': {
        const bases = eventBaseValue[event.eventType];
        battingTotals.atBats += 1;
        battingTotals.hits += 1;
        battingTotals.totalBases += bases;
        battingTotals.rbi += event.rbi;
        if (event.eventType === 'single') battingTotals.singles += 1;
        if (event.eventType === 'double') battingTotals.doubles += 1;
        if (event.eventType === 'triple') battingTotals.triples += 1;
        if (event.eventType === 'homerun') battingTotals.homeruns += 1;
        break;
      }
      case 'strikeout':
        battingTotals.atBats += 1;
        battingTotals.strikeouts += 1;
        break;
      case 'caught_out': {
        battingTotals.atBats += 1;
        const defTotals = ensureTeamTotals(defendingTeamId);
        defTotals.catches += 1;
        break;
      }
      case 'error': {
        const defTotals = ensureTeamTotals(defendingTeamId);
        defTotals.errors += 1;
        break;
      }
      case 'steal_success':
      case 'steal_fail': {
        battingTotals.stealsAttempted += 1;
        if (event.eventType === 'steal_success') {
          battingTotals.stealsWon += 1;
          battingTotals.basesStolen += 1;
          battingTotals.rbi += event.rbi ?? 0;
        } else {
          battingTotals.stealsLost += 1;
        }
        const defTotals = ensureTeamTotals(defendingTeamId);
        defTotals.basesDefended += 1;
        if (event.eventType === 'steal_fail') {
          defTotals.basesDefendedSuccessful += 1;
        }
        break;
      }
      default:
        break;
    }
  });

  teamIds.forEach((teamId) => {
    const totals = teamTotals.get(teamId) ?? zeroTotals();
    const stats = {
      gamesPlayed: 0,
      averageScore: 0,
      wins: 0,
      losses: 0,
      atBats: totals.atBats,
      hits: totals.hits,
      singles: totals.singles,
      doubles: totals.doubles,
      triples: totals.triples,
      homeruns: totals.homeruns,
      strikeouts: totals.strikeouts,
      battingAverage: 0,
      slugging: 0,
      catches: totals.catches,
      errors: totals.errors,
      stealsAttempted: totals.stealsAttempted,
      stealsWon: totals.stealsWon,
      stealsLost: totals.stealsLost,
      basesDefended: totals.basesDefended,
      basesDefendedSuccessful: totals.basesDefendedSuccessful,
      basesStolen: totals.basesStolen,
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
      let totalRuns = 0;
      teamGames.forEach((game) => {
        const isHome = game.homeTeamId === teamId;
        const runs = game.finalScore
          ? isHome
            ? game.finalScore.home
            : game.finalScore.away
          : 0;
        const oppRuns = game.finalScore
          ? isHome
            ? game.finalScore.away
            : game.finalScore.home
          : 0;
        totalRuns += runs;
        if (runs > oppRuns) {
          stats.wins += 1;
        } else if (runs < oppRuns) {
          stats.losses += 1;
        }
      });
      stats.averageScore = totalRuns / teamGames.length;
    }

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

type LocalRecordedDetail = {
  game: Game;
  events: GameEvent[];
  players: PlayerIdentity[];
};

const getGameTime = (value?: string) => {
  if (!value) return Number.NaN;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.NaN : parsed;
};

const scoresMatch = (local: Game, remote: Game) => {
  if (!local.finalScore || !remote.finalScore) return true;
  if (local.homeTeamId === remote.homeTeamId && local.awayTeamId === remote.awayTeamId) {
    return (
      local.finalScore.home === remote.finalScore.home &&
      local.finalScore.away === remote.finalScore.away
    );
  }
  if (local.homeTeamId === remote.awayTeamId && local.awayTeamId === remote.homeTeamId) {
    return (
      local.finalScore.home === remote.finalScore.away &&
      local.finalScore.away === remote.finalScore.home
    );
  }
  return false;
};

const findMatchingGame = (
  local: Game,
  remoteGames: Game[],
  matchWindowMs: number,
) => {
  const localTime = getGameTime(local.startTime);
  let bestMatch: { game: Game; diff: number } | null = null;

  remoteGames.forEach((remote) => {
    if (remote.type !== local.type) return;
    const sameTeams =
      (remote.homeTeamId === local.homeTeamId && remote.awayTeamId === local.awayTeamId) ||
      (remote.homeTeamId === local.awayTeamId && remote.awayTeamId === local.homeTeamId);
    if (!sameTeams) return;
    if (!scoresMatch(local, remote)) return;

    const remoteTime = getGameTime(remote.startTime);
    if (Number.isNaN(localTime) || Number.isNaN(remoteTime)) {
      if (!bestMatch) {
        bestMatch = { game: remote, diff: Number.POSITIVE_INFINITY };
      }
      return;
    }

    const diff = Math.abs(remoteTime - localTime);
    if (diff <= matchWindowMs && (!bestMatch || diff < bestMatch.diff)) {
      bestMatch = { game: remote, diff };
    }
  });

  return bestMatch?.game;
};

export const mergeLocalStatsData = ({
  games,
  events,
  players,
  localDetails,
  matchWindowMs = 10 * 60 * 1000,
}: {
  games: Game[];
  events: GameEvent[];
  players: PlayerIdentity[];
  localDetails: LocalRecordedDetail[];
  matchWindowMs?: number;
}) => {
  if (!localDetails.length) {
    return { games, events, players };
  }

  const mergedGames = [...games];
  const mergedEvents = [...events];
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const eventCountByGame = new Map<string, number>();

  events.forEach((event) => {
    eventCountByGame.set(event.gameId, (eventCountByGame.get(event.gameId) ?? 0) + 1);
  });

  localDetails.forEach((detail) => {
    detail.players.forEach((player) => {
      playerMap.set(player.id, player);
    });

    const directMatch = mergedGames.find((game) => game.id === detail.game.id);
    const matchedGame =
      directMatch ?? findMatchingGame(detail.game, mergedGames, matchWindowMs);

    if (matchedGame) {
      const existingCount = eventCountByGame.get(matchedGame.id) ?? 0;
      if (existingCount === 0 && detail.events.length) {
        mergedEvents.push(
          ...detail.events.map((event) => ({
            ...event,
            gameId: matchedGame.id,
          })),
        );
        eventCountByGame.set(matchedGame.id, detail.events.length);
      }
      return;
    }

    mergedGames.push(detail.game);
    if (detail.events.length) {
      mergedEvents.push(...detail.events);
      eventCountByGame.set(
        detail.game.id,
        (eventCountByGame.get(detail.game.id) ?? 0) + detail.events.length,
      );
    }
  });

  return { games: mergedGames, events: mergedEvents, players: Array.from(playerMap.values()) };
};
