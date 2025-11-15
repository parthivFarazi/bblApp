import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type LeaguePreset = {
  id: string;
  name: string;
  year: number;
};

type LeagueStoreState = {
  leagues: LeaguePreset[];
  addLeague: (league: LeaguePreset) => void;
};

export const useLeagueStore = create<LeagueStoreState>()(
  persist(
    (set, get) => ({
      leagues: [],
      addLeague: (league) => {
        const existing = get().leagues.find((item) => item.id === league.id);
        if (existing) {
          set((state) => ({
            leagues: state.leagues.map((item) =>
              item.id === league.id ? { ...item, name: league.name, year: league.year } : item,
            ),
          }));
        } else {
          set((state) => ({
            leagues: [...state.leagues, league],
          }));
        }
      },
    }),
    {
      name: 'league-directory',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
