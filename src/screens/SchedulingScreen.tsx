import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { addDays, addMinutes, format, isSameDay, isSameMinute, startOfDay } from 'date-fns';

import { AppStackParamList } from '@/navigation/appRoutes';
import { supabase } from '@/services/supabase';
import { TableBooking, useBookingStore } from '@/store/bookingStore';
import { useSessionStore } from '@/store/sessionStore';

type Props = NativeStackScreenProps<AppStackParamList, 'Scheduling'>;

export const SchedulingScreen: FC<Props> = ({ navigation }) => {
  const role = useSessionStore((state) => state.role);
  const isBrother = role === 'brother';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backLabel}>← Home</Text>
          </Pressable>
          <Text style={styles.kicker}>Scheduling</Text>
          <Text style={styles.title}>Table Reservations</Text>
          <Text style={styles.copy}>
            {isBrother
              ? 'Reserve a 2-hour block any time of day in 30-minute increments.'
              : 'View upcoming reservations. DU brothers can reserve tables from this screen.'}
          </Text>
        </View>

        <BookingCalendar isBrother={isBrother} />
      </ScrollView>
    </SafeAreaView>
  );
};

const SLOT_MINUTES = 30;
const BLOCK_MINUTES = 120;
const DAYS_TO_SHOW = 10;
const START_HOUR = 0;
const END_HOUR = 24;
const REFRESH_INTERVAL_MS = 10000;

const showToast = (message: string) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert(message);
};

const roundUpToHalfHour = (date: Date) => {
  const minutes = date.getMinutes();
  const roundedMinutes = minutes <= 30 ? 30 : 60;
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  if (roundedMinutes === 60) {
    rounded.setHours(date.getHours() + 1, 0, 0, 0);
  } else {
    rounded.setMinutes(30, 0, 0);
  }
  return rounded;
};

const buildDaySlots = (day: Date, now: Date) => {
  const start = new Date(day);
  start.setHours(START_HOUR, 0, 0, 0);
  const end = new Date(day);
  end.setHours(END_HOUR, 0, 0, 0);

  const slots: Date[] = [];
  const earliest = isSameDay(day, now) ? roundUpToHalfHour(now) : start;
  let cursor = start;

  while (cursor.getTime() + BLOCK_MINUTES * 60000 <= end.getTime()) {
    if (cursor.getTime() >= earliest.getTime()) {
      slots.push(new Date(cursor));
    }
    cursor = addMinutes(cursor, SLOT_MINUTES);
  }
  return slots;
};

const findOverlappingBooking = (
  start: Date,
  bookings: TableBooking[],
) => {
  const startMs = start.getTime();
  const endMs = startMs + BLOCK_MINUTES * 60000;
  return bookings.find((booking) => {
    const bookingStart = new Date(booking.startTime).getTime();
    const bookingEnd = bookingStart + booking.durationMinutes * 60000;
    return startMs < bookingEnd && endMs > bookingStart;
  });
};

const findBookingStartingAt = (start: Date, bookings: TableBooking[]) =>
  bookings.find((booking) => isSameMinute(new Date(booking.startTime), start));

const BookingCalendar = ({ isBrother }: { isBrother: boolean }) => {
  const bookings = useBookingStore((state) => state.bookings);
  const lastError = useBookingStore((state) => state.lastError);
  const fetchBookings = useBookingStore((state) => state.fetchBookings);
  const addBooking = useBookingStore((state) => state.addBooking);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [captainName, setCaptainName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const now = new Date();
  const days = useMemo(
    () => Array.from({ length: DAYS_TO_SHOW }, (_, index) => addDays(startOfDay(now), index)),
    [now],
  );
  const selectedDay = days[selectedDayIndex] ?? days[0];
  const daySlots = useMemo(() => buildDaySlots(selectedDay, now), [selectedDay, now]);

  const dayBookings = useMemo(
    () => bookings.filter((booking) => isSameDay(new Date(booking.startTime), selectedDay)),
    [bookings, selectedDay],
  );
  const visibleSlots = useMemo(
    () =>
      daySlots.filter((slot) => {
        const bookingAtStart = findBookingStartingAt(slot, dayBookings);
        if (bookingAtStart) return true;
        return !findOverlappingBooking(slot, dayBookings);
      }),
    [daySlots, dayBookings],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchBookings();
    }, [fetchBookings]),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchBookings();
    }, REFRESH_INTERVAL_MS);

    const channel = supabase
      .channel('table-bookings-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'table_bookings' },
        () => {
          void fetchBookings();
        },
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [fetchBookings]);

  const handleSelectSlot = (slot: Date) => {
    if (!isBrother) return;
    if (findOverlappingBooking(slot, dayBookings)) return;
    setSelectedSlot(slot);
    setTeamA('');
    setTeamB('');
    setCaptainName('');
    setModalVisible(true);
  };

  const handleBook = async () => {
    if (isSubmitting || !selectedSlot) return;
    const trimmedA = teamA.trim();
    const trimmedB = teamB.trim();
    const trimmedCaptain = captainName.trim();
    if (!trimmedA || !trimmedB || !trimmedCaptain) return;
    if (findOverlappingBooking(selectedSlot, dayBookings)) {
      setModalVisible(false);
      showToast('That time is already booked.');
      return;
    }
    setIsSubmitting(true);
    const result = await addBooking({
      startTime: selectedSlot.toISOString(),
      durationMinutes: BLOCK_MINUTES,
      teamA: trimmedA,
      teamB: trimmedB,
      captainName: trimmedCaptain,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      showToast(result.message);
      void fetchBookings();
      return;
    }

    setModalVisible(false);
    showToast('Booking confirmed.');
  };

  return (
    <View style={styles.calendarCard}>
      <Text style={styles.cardLabel}>Table Calendar</Text>
      <Text style={styles.cardCopy}>
        Reserve a 2-hour block any time of day in 30-minute increments.{' '}
        {isBrother ? 'Brothers only.' : 'Login required.'}
      </Text>
      {lastError ? <Text style={styles.errorCopy}>Sync error: {lastError}</Text> : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayTabs}
      >
        {days.map((day, index) => (
          <Pressable
            key={day.toISOString()}
            style={[styles.dayTab, index === selectedDayIndex && styles.dayTabActive]}
            onPress={() => setSelectedDayIndex(index)}
          >
            <Text
              style={[styles.dayTabLabel, index === selectedDayIndex && styles.dayTabLabelActive]}
            >
              {index === 0 ? 'Today' : format(day, 'EEE')}
            </Text>
            <Text
              style={[styles.dayTabDate, index === selectedDayIndex && styles.dayTabLabelActive]}
            >
              {format(day, 'MMM d')}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.slotList}>
        {visibleSlots.map((slot) => {
          const bookingAtStart = findBookingStartingAt(slot, dayBookings);
          const overlappingBooking =
            bookingAtStart ?? findOverlappingBooking(slot, dayBookings);
          const isBlocked = !!overlappingBooking;
          const startLabel = format(slot, 'h:mm a');
          const slotDurationMinutes = bookingAtStart?.durationMinutes ?? BLOCK_MINUTES;
          const endLabel = format(addMinutes(slot, slotDurationMinutes), 'h:mm a');
          const actionLabel = bookingAtStart
            ? 'Booked'
            : isBlocked
            ? 'Unavailable'
            : 'Reserve';
          return (
            <Pressable
              key={slot.toISOString()}
              style={[
                styles.slotRow,
                bookingAtStart && styles.slotBooked,
                !bookingAtStart && isBlocked && styles.slotUnavailable,
                !isBrother && styles.slotDisabled,
              ]}
              onPress={() => handleSelectSlot(slot)}
              disabled={!isBrother || isBlocked}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.slotTime}>
                  {startLabel} – {endLabel}
                </Text>
                {bookingAtStart ? (
                  <Text style={styles.slotMeta}>
                    {bookingAtStart.teamA} vs {bookingAtStart.teamB} • Captain{' '}
                    {bookingAtStart.captainName}
                  </Text>
                ) : isBlocked ? (
                  <Text style={styles.slotMeta}>Unavailable</Text>
                ) : (
                  <Text style={styles.slotMeta}>Available</Text>
                )}
              </View>
              <Text
                style={[
                  styles.slotAction,
                  isBlocked && styles.slotActionDisabled,
                ]}
              >
                {actionLabel}
              </Text>
            </Pressable>
          );
        })}
        {!visibleSlots.length && (
          <Text style={styles.calendarEmpty}>No remaining slots today.</Text>
        )}
      </View>

      <Modal
        transparent
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reserve Table</Text>
            <Text style={styles.modalSubtitle}>
              {selectedSlot
                ? `${format(selectedSlot, 'EEEE, MMM d')} • ${format(selectedSlot, 'h:mm a')} – ${format(addMinutes(selectedSlot, BLOCK_MINUTES), 'h:mm a')}`
                : ''}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Team A name"
              placeholderTextColor="#475569"
              value={teamA}
              onChangeText={setTeamA}
            />
            <TextInput
              style={styles.input}
              placeholder="Team B name"
              placeholderTextColor="#475569"
              value={teamB}
              onChangeText={setTeamB}
            />
            <TextInput
              style={styles.input}
              placeholder="Captain name"
              placeholderTextColor="#475569"
              value={captainName}
              onChangeText={setCaptainName}
            />
            <Pressable
              style={[
                styles.primaryButton,
                (!teamA.trim() || !teamB.trim() || !captainName.trim() || isSubmitting) &&
                  styles.primaryButtonDisabled,
              ]}
              disabled={!teamA.trim() || !teamB.trim() || !captainName.trim() || isSubmitting}
              onPress={handleBook}
            >
              <Text style={styles.primaryLabel}>
                {isSubmitting ? 'Confirming…' : 'Confirm Booking'}
              </Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => setModalVisible(false)}>
              <Text style={styles.secondaryLabel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#020617',
  },
  container: {
    padding: 24,
    gap: 20,
  },
  header: {
    gap: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  backLabel: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  kicker: {
    color: '#38BDF8',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: '700',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '700',
  },
  copy: {
    color: '#94A3B8',
    lineHeight: 20,
  },
  cardLabel: {
    color: '#E2E8F0',
    fontSize: 18,
    fontWeight: '600',
  },
  cardCopy: {
    color: '#94A3B8',
    lineHeight: 20,
  },
  errorCopy: {
    color: '#FCA5A5',
    fontSize: 12,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  input: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  calendarCard: {
    backgroundColor: '#0F172A',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 12,
  },
  dayTabs: {
    gap: 10,
    paddingVertical: 4,
  },
  dayTab: {
    backgroundColor: '#0B1220',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 72,
  },
  dayTabActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1E40AF',
  },
  dayTabLabel: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 12,
  },
  dayTabLabelActive: {
    color: '#F8FAFC',
  },
  dayTabDate: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  slotList: {
    gap: 10,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0B1220',
  },
  slotBooked: {
    borderColor: '#F59E0B',
    backgroundColor: '#1F1A10',
  },
  slotUnavailable: {
    borderColor: '#334155',
    backgroundColor: '#0F172A',
  },
  slotDisabled: {
    opacity: 0.6,
  },
  slotTime: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
  slotMeta: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  slotAction: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  slotActionDisabled: {
    color: '#64748B',
  },
  calendarEmpty: {
    color: '#64748B',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  modalTitle: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 16,
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  secondary: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryLabel: {
    color: '#94A3B8',
    fontWeight: '600',
  },
});
