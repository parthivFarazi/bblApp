import { create } from 'zustand';

import { UserRole } from '@/types';

interface SessionState {
  role: UserRole | null;
  setRole: (role: UserRole) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  role: null,
  setRole: (role) => set({ role }),
  clear: () => set({ role: null }),
}));
