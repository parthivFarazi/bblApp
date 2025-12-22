import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type TeamProfile = {
  id: string;
  name: string;
  leagueId?: string;
};

type TeamStoreState = {
  teams: Record<string, TeamProfile>;
  ensureTeam: (name: string, leagueId?: string) => string;
  setTeams: (teams: Record<string, TeamProfile>) => void;
  upsertTeam: (team: TeamProfile) => void;
};

const slugify = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const useTeamStore = create<TeamStoreState>()(
  persist(
    (set, get) => ({
      teams: {},
      setTeams: (teams) => set(() => ({ teams })),
      upsertTeam: (team) =>
        set((state) => ({
          teams: {
            ...state.teams,
            [team.id]: team,
          },
        })),
      ensureTeam: (name, leagueId) => {
        const cleaned = name.trim();
        const slug = slugify(cleaned || 'team');
        const key = leagueId ? `${leagueId}::${slug}` : slug;
        const existing = get().teams[key];
        if (existing) {
          if (existing.name !== cleaned) {
            set((state) => ({
              teams: {
                ...state.teams,
                [key]: { ...existing, name: cleaned || existing.name },
              },
            }));
          }
          return existing.id;
        }
        const profile = {
          id: key,
          name: cleaned || 'Team',
          leagueId,
        };
        set((state) => ({
          teams: {
            ...state.teams,
            [key]: profile,
          },
        }));
        return key;
      },
    }),
    {
      name: 'team-directory',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
