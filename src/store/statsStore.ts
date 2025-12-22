import { create } from 'zustand';

import { Game, GameEvent, PlayerIdentity, ScoreboardState } from '@/types';
import { usePlayerStore } from '@/store/playerStore';

interface RecordedGameDetail {
  id: string;
  game: Game;
  teamLabels: Record<string, string>;
  scoreboard: ScoreboardState;
  events: GameEvent[];
  players: PlayerIdentity[];
  recordedAt: string;
  teamOrder: string[];
}

interface RecordPayload {
  game: Game;
  events: GameEvent[];
  players: PlayerIdentity[];
  teamLabels: Record<string, string>;
  scoreboard: ScoreboardState;
  recordedAt: string;
  teamOrder: string[];
}

interface StatsState {
  recordedGames: Game[];
  recordedEvents: GameEvent[];
  playerDirectory: Record<string, PlayerIdentity>;
  teamLabels: Record<string, string>;
  recordedDetails: Record<string, RecordedGameDetail>;
  recordGame: (payload: RecordPayload) => void;
  hydrate: (payload: {
    games: Game[];
    events: GameEvent[];
    playerDirectory: Record<string, PlayerIdentity>;
    teamLabels: Record<string, string>;
  }) => void;
  clear: () => void;
}

export const useStatsStore = create<StatsState>((set) => ({
    recordedGames: [],
    recordedEvents: [],
    playerDirectory: {},
    teamLabels: {},
    recordedDetails: {},
  recordGame: ({ game, events, players, teamLabels, scoreboard, recordedAt, teamOrder }) =>
    set((state) => {
      const brotherPlayers = players.filter((player) => !player.isGuest);
      if (brotherPlayers.length) {
        usePlayerStore.getState().upsertPlayers(brotherPlayers);
      }
      const nextPlayers = { ...state.playerDirectory };
      players.forEach((player) => {
        nextPlayers[player.id] = player;
      });
      return {
        recordedGames: [...state.recordedGames, game],
        recordedEvents: [...state.recordedEvents, ...events],
        playerDirectory: nextPlayers,
        teamLabels: { ...state.teamLabels, ...teamLabels },
        recordedDetails: {
          ...state.recordedDetails,
          [game.id]: {
            id: game.id,
            game,
            teamLabels,
            scoreboard,
            events,
            players,
            recordedAt,
            teamOrder,
          },
        },
      };
    }),
  hydrate: ({ games, events, playerDirectory, teamLabels }) =>
    set(() => ({
      recordedGames: games,
      recordedEvents: events,
      playerDirectory,
      teamLabels,
      recordedDetails: {},
    })),
  clear: () =>
    set({
      recordedGames: [],
      recordedEvents: [],
      playerDirectory: {},
      teamLabels: {},
      recordedDetails: {},
    }),
}));
