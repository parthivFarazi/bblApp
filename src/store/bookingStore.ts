import { create } from 'zustand';

import { supabase } from '@/services/supabase';

export type TableBooking = {
  id: string;
  startTime: string; // ISO
  durationMinutes: number;
  teamA: string;
  teamB: string;
  captainName: string;
  createdAt: string;
};

type CreateBookingInput = Pick<
  TableBooking,
  'startTime' | 'durationMinutes' | 'teamA' | 'teamB' | 'captainName'
>;

type BookingResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      code?: string;
    };

type BookingRow = {
  id: string;
  start_time: string;
  duration_minutes: number;
  team_a: string;
  team_b: string;
  captain_name: string;
  created_at: string;
  status: 'booked' | 'cancelled';
};

type BookingStoreState = {
  bookings: TableBooking[];
  isLoading: boolean;
  lastError: string | null;
  fetchBookings: () => Promise<void>;
  addBooking: (booking: CreateBookingInput) => Promise<BookingResult>;
  clearLocal: () => void;
};

const BOOKING_BLOCK_MINUTES = 120;

const mapBookingRow = (row: BookingRow): TableBooking => ({
  id: row.id,
  startTime: row.start_time,
  durationMinutes: BOOKING_BLOCK_MINUTES,
  teamA: row.team_a,
  teamB: row.team_b,
  captainName: row.captain_name,
  createdAt: row.created_at,
});

const sortByStartTime = (bookings: TableBooking[]) =>
  bookings
    .slice()
    .sort(
      (left, right) =>
        new Date(left.startTime).getTime() - new Date(right.startTime).getTime(),
    );

export const useBookingStore = create<BookingStoreState>((set) => ({
  bookings: [],
  isLoading: false,
  lastError: null,
  fetchBookings: async () => {
    set({ isLoading: true, lastError: null });
    const { data, error } = await supabase
      .from('table_bookings')
      .select(
        'id, start_time, duration_minutes, team_a, team_b, captain_name, created_at, status',
      )
      .eq('status', 'booked')
      .order('start_time', { ascending: true });

    if (error) {
      set({ isLoading: false, lastError: error.message });
      return;
    }

    const rows = (data ?? []) as BookingRow[];
    set({
      bookings: rows.map(mapBookingRow),
      isLoading: false,
      lastError: null,
    });
  },
  addBooking: async (booking) => {
    const { data, error } = await supabase
      .from('table_bookings')
      .insert({
        start_time: booking.startTime,
        duration_minutes: BOOKING_BLOCK_MINUTES,
        team_a: booking.teamA,
        team_b: booking.teamB,
        captain_name: booking.captainName,
      })
      .select(
        'id, start_time, duration_minutes, team_a, team_b, captain_name, created_at, status',
      )
      .single();

    if (error) {
      if (error.code === '23P01') {
        return {
          ok: false,
          message: 'That time slot was just booked on another device. Please pick another slot.',
          code: error.code,
        };
      }
      return { ok: false, message: error.message, code: error.code };
    }

    const row = data as BookingRow;
    set((state) => ({
      bookings: sortByStartTime([mapBookingRow(row), ...state.bookings]),
      lastError: null,
    }));
    return { ok: true };
  },
  clearLocal: () => set({ bookings: [], lastError: null }),
}));
