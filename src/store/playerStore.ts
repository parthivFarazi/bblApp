import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { playerIdentities } from '@/data/sampleData';
import { PlayerIdentity } from '@/types';

type PlayerStoreState = {
  players: Record<string, PlayerIdentity>;
  addPlayer: (player: PlayerIdentity) => void;
  upsertPlayers: (players: PlayerIdentity[]) => void;
};

const initialDirectory = playerIdentities.reduce<Record<string, PlayerIdentity>>(
  (acc, player) => {
    acc[player.id] = player;
    return acc;
  },
  {},
);

export const usePlayerStore = create<PlayerStoreState>()(
  persist(
    (set) => ({
      players: initialDirectory,
      addPlayer: (player) =>
        set((state) => {
          if (player.isGuest) {
            return state;
          }
          return {
            players: {
              ...state.players,
              [player.id]: player,
            },
          };
        }),
      upsertPlayers: (list) =>
        set((state) => {
          const players = { ...state.players };
          list.forEach((player) => {
            if (!player.isGuest) {
              players[player.id] = player;
            }
          });
          return { players };
        }),
    }),
    {
      name: 'player-directory-v2',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
