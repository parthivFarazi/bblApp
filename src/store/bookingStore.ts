import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type TableBooking = {
  id: string;
  startTime: string; // ISO
  durationMinutes: number;
  teamA: string;
  teamB: string;
  captainName: string;
  createdAt: string;
};

type BookingStoreState = {
  bookings: TableBooking[];
  addBooking: (booking: TableBooking) => void;
  clear: () => void;
};

export const useBookingStore = create<BookingStoreState>()(
  persist(
    (set) => ({
      bookings: [],
      addBooking: (booking) =>
        set((state) => ({
          bookings: [booking, ...state.bookings].slice(0, 500),
        })),
      clear: () => set({ bookings: [] }),
    }),
    {
      name: 'table-bookings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
