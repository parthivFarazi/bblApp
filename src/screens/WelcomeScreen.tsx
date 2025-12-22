import { FC } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppStackParamList } from '@/navigation/appRoutes';
import { useSessionStore } from '@/store/sessionStore';

type Props = NativeStackScreenProps<AppStackParamList, 'Welcome'>;

export const WelcomeScreen: FC<Props> = ({ navigation }) => {
  const setRole = useSessionStore((state) => state.setRole);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.tagline}>Delta Upsilon Pong Baseball League</Text>
        <Text style={styles.title}>Score Every Pitch</Text>
        <Text style={styles.subtitle}>
          Guests can hop directly into a live game, while DU brothers can unlock the Stats Center
          with the shared passcode.
        </Text>

        <View style={styles.cardGroup}>
          <Pressable style={styles.card} onPress={() => setRole('guest')}>
            <Text style={styles.cardLabel}>I’m a Guest</Text>
            <Text style={styles.cardCopy}>
              Launch a friendly game with custom team names and guest players. Stats won’t be saved
              to DU history.
            </Text>
          </Pressable>

          <Pressable style={styles.card} onPress={() => navigation.navigate('DuPassword')}>
            <Text style={styles.cardLabel}>Delta Upsilon Login</Text>
            <Text style={styles.cardCopy}>
              Enter the DU password to access members-only features like league setup and the Stat
              Center.
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#030712',
  },
  container: {
    flex: 1,
    padding: 24,
    gap: 20,
  },
  tagline: {
    color: '#38BDF8',
    letterSpacing: 1,
    fontWeight: '600',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 16,
    lineHeight: 22,
  },
  cardGroup: {
    marginTop: 24,
    gap: 16,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
    gap: 12,
  },
  cardLabel: {
    color: '#E2E8F0',
    fontSize: 18,
    fontWeight: '700',
  },
  cardCopy: {
    color: '#94A3B8',
    lineHeight: 20,
  },
});
