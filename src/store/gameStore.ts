import { create } from 'zustand';
import { nanoid } from 'nanoid/non-secure';

import {
  FriendlyGameSetupPayload,
  GameEvent,
  GameSetupPayload,
  GameMode,
  LiveGameState,
  PlayerIdentity,
} from '@/types';

interface CompletedGameRecord {
  id: string;
  type: GameMode;
  leagueId?: string;
  teamLabels: Record<string, string>;
  score: Record<string, number>;
  playedAt: string;
  teamOrder: string[];
}
import {
  EMPTY_BASES,
  advanceRunnersForHit,
  cloneBases,
  getCurrentBatter,
  hitValueMap,
  moveToNextBatter,
  resolveSteal,
  toggleHalf,
} from '@/utils/baseball';

interface GameStoreState {
  mode: 'idle' | 'live' | 'complete';
  live?: LiveGameState;
  events: GameEvent[];
  recentPlays: GameEvent[];
  completedGames: CompletedGameRecord[];
  startGame: (payload: GameSetupPayload) => void;
  logHit: (type: keyof typeof hitValueMap) => void;
  logStrike: () => void;
  logError: (defenderId: string) => void;
  logCaughtOut: (defenderId: string) => void;
  logSteal: (runnerId: string, defenderId: string, success: boolean) => void;
  completeGame: () => void;
  reset: () => void;
}

const createScoreboardState = (teamIds: string[]) =>
  teamIds.reduce<LiveGameState['scoreboard']>((acc, teamId) => {
    acc[teamId] = { runs: 0, hits: 0, errors: 0, inningRuns: {} };
    return acc;
  }, {});

const toLineupState = (teamId: string, players: PlayerIdentity[]) => ({
  teamId,
  lineup: players.map((player, index) => ({
    playerId: player.id,
    identity: player,
    battingOrder: index + 1,
  })),
  currentIndex: 0,
});

const friendlyTeamId = (_label: string) => createUuid();

const createUuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

const initialLiveState = (
  type: GameMode,
  teamAId: string,
  teamBId: string,
  teamLabels: Record<string, string>,
  lineups: Record<string, ReturnType<typeof toLineupState>>,
  teamOrder: string[],
  leagueId?: string,
): LiveGameState => ({
  gameId: createUuid(),
  type,
  teamLabels,
  teamOrder,
  leagueId,
  inning: 1,
  half: 'top',
  outs: 0,
  strikes: 0,
  offenseTeamId: teamAId,
  defenseTeamId: teamBId,
  bases: { ...EMPTY_BASES },
  scoreboard: createScoreboardState([teamAId, teamBId]),
  lineups,
  plannedInnings: 1,
  isComplete: false,
});

const rotateSides = (live: LiveGameState): LiveGameState => {
  const nextHalf = toggleHalf(live.half);
  const nextInning = live.half === 'bottom' ? live.inning + 1 : live.inning;

  return {
    ...live,
    half: nextHalf,
    inning: nextInning,
    plannedInnings: Math.max(live.plannedInnings, nextInning),
    outs: 0,
    strikes: 0,
    bases: { ...EMPTY_BASES },
    offenseTeamId: live.defenseTeamId,
    defenseTeamId: live.offenseTeamId,
  };
};

const appendEvent = (state: GameStoreState, event: GameEvent) => ({
  events: [...state.events, event],
  recentPlays: [event, ...state.recentPlays].slice(0, 6),
});

const createEventPayload = (
  live: LiveGameState,
  overrides: Partial<GameEvent>,
  batterId: string,
): GameEvent => ({
  id: nanoid(),
  gameId: live.gameId,
  inning: live.inning,
  half: live.half,
  batterId,
  runsScored: 0,
  rbi: 0,
  baseStateBefore: cloneBases(live.bases),
  baseStateAfter: cloneBases(live.bases),
  timestamp: Date.now(),
  eventType: 'strike',
  ...overrides,
});

export const useGameStore = create<GameStoreState>((set, get) => ({
  mode: 'idle',
  live: undefined,
  events: [],
  recentPlays: [],
  completedGames: [],
  startGame: (payload) => {
    if (payload.type === 'friendly') {
      const friendlyPayload = payload as FriendlyGameSetupPayload;
      const teamAId = friendlyTeamId(friendlyPayload.teamAName);
      const teamBId = friendlyTeamId(friendlyPayload.teamBName);
      const lineupA = toLineupState(
        teamAId,
        friendlyPayload.teamAPlayers.map((player) => ({ ...player, teamId: teamAId })),
      );
      const lineupB = toLineupState(
        teamBId,
        friendlyPayload.teamBPlayers.map((player) => ({ ...player, teamId: teamBId })),
      );
      set({
        mode: 'live',
        live: initialLiveState(
          'friendly',
          teamAId,
          teamBId,
          { [teamAId]: friendlyPayload.teamAName, [teamBId]: friendlyPayload.teamBName },
          { [teamAId]: lineupA, [teamBId]: lineupB },
          [teamAId, teamBId],
          undefined,
        ),
        events: [],
        recentPlays: [],
      });
      return;
    }

    if (payload.type === 'league') {
      const lineupHome = toLineupState(
        payload.homeTeamId,
        payload.leagueTeamMembers
          .filter((member) => member.teamId === payload.homeTeamId)
          .sort((a, b) => a.battingOrder - b.battingOrder)
          .map((member) => ({
            id: member.brotherId,
            displayName: member.displayName ?? member.brotherId,
            brotherId: member.brotherId,
            teamId: member.teamId,
          })),
      );
      const lineupAway = toLineupState(
        payload.awayTeamId,
        payload.leagueTeamMembers
          .filter((member) => member.teamId === payload.awayTeamId)
          .sort((a, b) => a.battingOrder - b.battingOrder)
          .map((member) => ({
            id: member.brotherId,
            displayName: member.displayName ?? member.brotherId,
            brotherId: member.brotherId,
            teamId: member.teamId,
          })),
      );
      set({
        mode: 'live',
        live: initialLiveState(
          'league',
          payload.homeTeamId,
          payload.awayTeamId,
          {
            [payload.homeTeamId]: payload.homeTeamName,
            [payload.awayTeamId]: payload.awayTeamName,
          },
          {
            [payload.homeTeamId]: lineupHome,
            [payload.awayTeamId]: lineupAway,
          },
          [payload.homeTeamId, payload.awayTeamId],
          payload.leagueId,
        ),
        events: [],
        recentPlays: [],
      });
    }
  },
  logHit: (type) =>
    set((state) => {
      const live = state.live;
      if (!live) {
        return state;
      }

      const offenseLineup = live.lineups[live.offenseTeamId];
      const batter = getCurrentBatter(offenseLineup);
      const hitValue = hitValueMap[type];
      const result = advanceRunnersForHit(live.bases, hitValue, batter.playerId);

      const updatedScoreboard = {
        ...live.scoreboard,
        [live.offenseTeamId]: {
          ...live.scoreboard[live.offenseTeamId],
          runs: live.scoreboard[live.offenseTeamId].runs + result.runsScored,
          hits: live.scoreboard[live.offenseTeamId].hits + 1,
          inningRuns: {
            ...live.scoreboard[live.offenseTeamId].inningRuns,
            [live.inning]:
              (live.scoreboard[live.offenseTeamId].inningRuns[live.inning] ?? 0) +
              result.runsScored,
          },
        },
      };

      const event = createEventPayload(live, {
        eventType: type,
        baseStateBefore: result.before,
        baseStateAfter: result.after,
        runsScored: result.runsScored,
        rbi: result.rbi,
      }, batter.playerId);

      const newLineups = {
        ...live.lineups,
        [live.offenseTeamId]: moveToNextBatter(offenseLineup),
      };

      const updatedLive: LiveGameState = {
        ...live,
        bases: result.after,
        strikes: 0,
        lineups: newLineups,
        scoreboard: updatedScoreboard,
      };

      return {
        ...state,
        live: updatedLive,
        ...appendEvent(state, event),
      };
    }),
  logStrike: () =>
    set((state) => {
      const live = state.live;
      if (!live) {
        return state;
      }

      if (live.strikes < 2) {
        return {
          ...state,
          live: { ...live, strikes: live.strikes + 1 },
        };
      }

      const lineup = live.lineups[live.offenseTeamId];
      const batter = getCurrentBatter(lineup);
      const event = createEventPayload(
        live,
        {
          eventType: 'strikeout',
        },
        batter.playerId,
      );

      let updatedLive: LiveGameState = {
        ...live,
        strikes: 0,
        outs: live.outs + 1,
        lineups: {
          ...live.lineups,
          [live.offenseTeamId]: moveToNextBatter(lineup),
        },
      };

      if (updatedLive.outs >= 3) {
        updatedLive = rotateSides(updatedLive);
      }

      return {
        ...state,
        live: updatedLive,
        ...appendEvent(state, event),
      };
    }),
  logError: (defenderId) =>
    set((state) => {
      const live = state.live;
      if (!live) return state;

      const lineup = live.lineups[live.offenseTeamId];
      const batter = getCurrentBatter(lineup);
      const event = createEventPayload(
        live,
        {
          eventType: 'error',
          defenderId,
        },
        batter.playerId,
      );

      const updatedScoreboard = {
        ...live.scoreboard,
        [live.defenseTeamId]: {
          ...live.scoreboard[live.defenseTeamId],
          errors: live.scoreboard[live.defenseTeamId].errors + 1,
        },
      };

      if (live.strikes < 2) {
        return {
          ...state,
          live: {
            ...live,
            strikes: live.strikes + 1,
            scoreboard: updatedScoreboard,
          },
          ...appendEvent(state, event),
        };
      }

      let updatedLive: LiveGameState = {
        ...live,
        strikes: 0,
        outs: live.outs + 1,
        scoreboard: updatedScoreboard,
        lineups: {
          ...live.lineups,
          [live.offenseTeamId]: moveToNextBatter(lineup),
        },
      };

      if (updatedLive.outs >= 3) {
        updatedLive = rotateSides(updatedLive);
      }

      return {
        ...state,
        live: updatedLive,
        ...appendEvent(state, event),
      };
    }),
  logCaughtOut: (defenderId) =>
    set((state) => {
      const live = state.live;
      if (!live) return state;

      const lineup = live.lineups[live.offenseTeamId];
      const batter = getCurrentBatter(lineup);
      const event = createEventPayload(
        live,
        {
          eventType: 'caught_out',
          defenderId,
        },
        batter.playerId,
      );

      let updatedLive: LiveGameState = {
        ...live,
        outs: live.outs + 1,
        strikes: 0,
        lineups: {
          ...live.lineups,
          [live.offenseTeamId]: moveToNextBatter(lineup),
        },
      };

      if (updatedLive.outs >= 3) {
        updatedLive = rotateSides(updatedLive);
      }

      return {
        ...state,
        live: updatedLive,
        ...appendEvent(state, event),
      };
    }),
  logSteal: (runnerId, defenderId, success) =>
    set((state) => {
      const live = state.live;
      if (!live) return state;
      const result = resolveSteal(live.bases, runnerId, success);
      let updatedLive: LiveGameState = {
        ...live,
        bases: result.after,
      };
      let updatedScoreboard = live.scoreboard;

      if (success && result.runsScored) {
        updatedScoreboard = {
          ...live.scoreboard,
          [live.offenseTeamId]: {
            ...live.scoreboard[live.offenseTeamId],
            runs: live.scoreboard[live.offenseTeamId].runs + result.runsScored,
            inningRuns: {
              ...live.scoreboard[live.offenseTeamId].inningRuns,
              [live.inning]:
                (live.scoreboard[live.offenseTeamId].inningRuns[live.inning] ?? 0) +
                result.runsScored,
            },
          },
        };
        updatedLive = {
          ...updatedLive,
          scoreboard: updatedScoreboard,
        };
      }

      if (!success) {
        updatedLive = {
          ...updatedLive,
          outs: updatedLive.outs + 1,
        };
      }

      if (updatedLive.outs >= 3) {
        updatedLive = rotateSides(updatedLive);
      }

      const lineup = live.lineups[live.offenseTeamId];
      const batter = getCurrentBatter(lineup);
      const event = createEventPayload(
        live,
        {
          eventType: success ? 'steal_success' : 'steal_fail',
          defenderId,
          runnerId,
          baseStateBefore: result.before,
          baseStateAfter: result.after,
          runsScored: success ? result.runsScored : 0,
          rbi: success ? result.runsScored : 0,
        },
        batter.playerId,
      );

      return {
        ...state,
        live: updatedLive,
        ...appendEvent(state, event),
      };
    }),
  completeGame: () =>
    set((state) => {
      if (!state.live) {
        return state;
      }
      const scoreRecord = Object.entries(state.live.scoreboard).reduce<Record<string, number>>(
        (acc, [teamId, entry]) => {
          acc[teamId] = entry.runs;
          return acc;
        },
        {},
      );
      const completedGame: CompletedGameRecord = {
        id: state.live.gameId,
        type: state.live.type,
        leagueId: state.live.leagueId,
        teamLabels: state.live.teamLabels,
        score: scoreRecord,
        playedAt: new Date().toISOString(),
        teamOrder: state.live.teamOrder,
      };
      return {
        ...state,
        mode: 'complete',
        live: { ...state.live, isComplete: true },
        completedGames: [completedGame, ...state.completedGames].slice(0, 50),
      };
    }),
  reset: () =>
    set({
      mode: 'idle',
      live: undefined,
      events: [],
      recentPlays: [],
    }),
}));
