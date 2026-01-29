import { FC, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { addDays, addMinutes, format, isSameDay, startOfDay } from 'date-fns';

import { AppStackParamList } from '@/navigation/appRoutes';
import { useSessionStore } from '@/store/sessionStore';
import { useBookingStore } from '@/store/bookingStore';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'>;

export const HomeScreen: FC<Props> = ({ navigation }) => {
  const role = useSessionStore((state) => state.role);
  const clear = useSessionStore((state) => state.clear);

  const isBrother = role === 'brother';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>DUBBL Control Room</Text>
          <Text style={styles.title}>{isBrother ? 'DU Home' : 'Guest Home'}</Text>
          <Text style={styles.copy}>
            Launch a new live game, or if you are a DU brother, drill into the Stat Center.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Live Game</Text>
          <Text style={styles.cardCopy}>
            Score friendlies or league nights with the full strike / out automation and base logic.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => navigation.navigate('LiveGameFlow')}
          >
            <Text style={styles.primaryLabel}>Play Live Game</Text>
          </Pressable>
        </View>

        {isBrother ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Stat Center</Text>
            <Text style={styles.cardCopy}>
              Browse individual and team leaderboards by year, league, or the full DU archive.
            </Text>
            <Pressable
              style={styles.primaryButtonAlt}
              onPress={() => navigation.navigate('StatsHub')}
            >
              <Text style={styles.primaryLabel}>Open Stats Center</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cardMuted}>
            <Text style={styles.cardLabel}>Stats Center</Text>
            <Text style={styles.cardCopy}>
              Only DU brothers can access the Stat Center. Ask a brother for the DU password to log
              in.
            </Text>
          </View>
        )}

        <BookingCalendar isBrother={isBrother} />

        <Pressable style={styles.signOut} onPress={clear}>
          <Text style={styles.signOutLabel}>Change Role</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const SLOT_MINUTES = 30;
const BLOCK_MINUTES = 120;
const DAYS_TO_SHOW = 10;
const START_HOUR = 10;
const END_HOUR = 22;

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
  bookings: ReturnType<typeof useBookingStore>['bookings'],
) => {
  const startMs = start.getTime();
  const endMs = startMs + BLOCK_MINUTES * 60000;
  return bookings.find((booking) => {
    const bookingStart = new Date(booking.startTime).getTime();
    const bookingEnd = bookingStart + booking.durationMinutes * 60000;
    return startMs < bookingEnd && endMs > bookingStart;
  });
};

const BookingCalendar = ({ isBrother }: { isBrother: boolean }) => {
  const bookings = useBookingStore((state) => state.bookings);
  const addBooking = useBookingStore((state) => state.addBooking);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [captainName, setCaptainName] = useState('');

  const now = new Date();
  const days = useMemo(
    () => Array.from({ length: DAYS_TO_SHOW }, (_, index) => addDays(startOfDay(now), index)),
    [now],
  );
  const selectedDay = days[selectedDayIndex] ?? days[0];
  const daySlots = useMemo(() => buildDaySlots(selectedDay, now), [selectedDay, now]);

  const dayBookings = useMemo(
    () =>
      bookings.filter((booking) => isSameDay(new Date(booking.startTime), selectedDay)),
    [bookings, selectedDay],
  );

  const handleSelectSlot = (slot: Date) => {
    if (!isBrother) return;
    if (findOverlappingBooking(slot, bookings)) return;
    setSelectedSlot(slot);
    setTeamA('');
    setTeamB('');
    setCaptainName('');
    setModalVisible(true);
  };

  const handleBook = () => {
    if (!selectedSlot) return;
    const trimmedA = teamA.trim();
    const trimmedB = teamB.trim();
    const trimmedCaptain = captainName.trim();
    if (!trimmedA || !trimmedB || !trimmedCaptain) return;
    if (findOverlappingBooking(selectedSlot, bookings)) {
      setModalVisible(false);
      return;
    }
    addBooking({
      id: `booking-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      startTime: selectedSlot.toISOString(),
      durationMinutes: BLOCK_MINUTES,
      teamA: trimmedA,
      teamB: trimmedB,
      captainName: trimmedCaptain,
      createdAt: new Date().toISOString(),
    });
    setModalVisible(false);
  };

  return (
    <View style={styles.calendarCard}>
      <Text style={styles.cardLabel}>Table Calendar</Text>
      <Text style={styles.cardCopy}>
        Reserve a 2-hour block in 30-minute increments. {isBrother ? 'Brothers only.' : 'Login required.'}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabs}>
        {days.map((day, index) => (
          <Pressable
            key={day.toISOString()}
            style={[styles.dayTab, index === selectedDayIndex && styles.dayTabActive]}
            onPress={() => setSelectedDayIndex(index)}
          >
            <Text style={[styles.dayTabLabel, index === selectedDayIndex && styles.dayTabLabelActive]}>
              {index === 0 ? 'Today' : format(day, 'EEE')}
            </Text>
            <Text style={[styles.dayTabDate, index === selectedDayIndex && styles.dayTabLabelActive]}>
              {format(day, 'MMM d')}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.slotList}>
        {daySlots.map((slot) => {
          const booking = findOverlappingBooking(slot, dayBookings);
          const startLabel = format(slot, 'h:mm a');
          const endLabel = format(addMinutes(slot, BLOCK_MINUTES), 'h:mm a');
          return (
            <Pressable
              key={slot.toISOString()}
              style={[
                styles.slotRow,
                booking && styles.slotBooked,
                !isBrother && styles.slotDisabled,
              ]}
              onPress={() => handleSelectSlot(slot)}
              disabled={!isBrother || !!booking}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.slotTime}>
                  {startLabel} – {endLabel}
                </Text>
                {booking ? (
                  <Text style={styles.slotMeta}>
                    {booking.teamA} vs {booking.teamB} • Captain {booking.captainName}
                  </Text>
                ) : (
                  <Text style={styles.slotMeta}>Available</Text>
                )}
              </View>
              <Text style={styles.slotAction}>{booking ? 'Booked' : 'Reserve'}</Text>
            </Pressable>
          );
        })}
        {!daySlots.length && (
          <Text style={styles.calendarEmpty}>No remaining slots today.</Text>
        )}
      </View>

      <Modal transparent visible={modalVisible} animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reserve Table</Text>
            <Text style={styles.modalSubtitle}>
              {selectedSlot ? `${format(selectedSlot, 'EEEE, MMM d')} • ${format(selectedSlot, 'h:mm a')} – ${format(addMinutes(selectedSlot, BLOCK_MINUTES), 'h:mm a')}` : ''}
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
              style={[styles.primaryButton, (!teamA.trim() || !teamB.trim() || !captainName.trim()) && styles.primaryButtonDisabled]}
              disabled={!teamA.trim() || !teamB.trim() || !captainName.trim()}
              onPress={handleBook}
            >
              <Text style={styles.primaryLabel}>Confirm Booking</Text>
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
  kicker: {
    color: '#818CF8',
    fontWeight: '600',
    letterSpacing: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 32,
    fontWeight: '700',
  },
  copy: {
    color: '#94A3B8',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#0F172A',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 12,
  },
  cardMuted: {
    backgroundColor: '#111827',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
    gap: 12,
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
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonAlt: {
    backgroundColor: '#1D4ED8',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
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
  signOut: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  signOutLabel: {
    color: '#94A3B8',
    fontWeight: '600',
  },
});
