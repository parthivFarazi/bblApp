import { FC } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppStackParamList } from '@/navigation/appRoutes';
import { useSessionStore } from '@/store/sessionStore';

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

        <Pressable style={styles.signOut} onPress={clear}>
          <Text style={styles.signOutLabel}>Change Role</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
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

