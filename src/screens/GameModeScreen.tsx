import { FC } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useGameStore } from '@/store/gameStore';
import { LiveGameStackParamList } from '@/navigation/LiveGameNavigator';

type Props = NativeStackScreenProps<LiveGameStackParamList, 'GameMode'>;

export const GameModeScreen: FC<Props> = ({ navigation }) => {
  const live = useGameStore((state) => state.live);

  const handleResume = () => {
    if (!live) return;
    navigation.navigate('LiveGame');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Live Game Setup</Text>
          <Text style={styles.title}>Choose Game Type</Text>
          <Text style={styles.copy}>
            Friendly games are great for guests and demos. League games enforce official DU rosters
            and seasons.
          </Text>
        </View>

        <View style={styles.cardGroup}>
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('FriendlySetup')}
          >
            <Text style={styles.cardLabel}>Friendly Game</Text>
            <Text style={styles.cardCopy}>
              Name custom teams, mix brothers and guests, and start keeping score immediately.
            </Text>
            <Text style={styles.cardAction}>Build Friendly Lineup →</Text>
          </Pressable>

          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('LeagueSetup')}
          >
            <Text style={styles.cardLabel}>League Game</Text>
            <Text style={styles.cardCopy}>
              Pull in official league rosters, pick the season matchup, and lock batting orders.
            </Text>
            <Text style={styles.cardAction}>Select League Teams →</Text>
          </Pressable>
        </View>

        {live && !live.isComplete && (
          <View style={styles.resumeCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.resumeLabel}>Resume Active Game</Text>
              <Text style={styles.resumeCopy}>
                {live.teamLabels[live.offenseTeamId]} vs {live.teamLabels[live.defenseTeamId]}
              </Text>
            </View>
            <Pressable style={styles.resumeButton} onPress={handleResume}>
              <Text style={styles.resumeButtonLabel}>Resume</Text>
            </Pressable>
          </View>
        )}

        <Pressable style={styles.exit} onPress={() => navigation.getParent()?.goBack()}>
          <Text style={styles.exitLabel}>← Back to Home</Text>
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
    color: '#38BDF8',
    fontWeight: '600',
    letterSpacing: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 30,
    fontWeight: '700',
  },
  copy: {
    color: '#94A3B8',
    lineHeight: 20,
  },
  cardGroup: {
    gap: 16,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 20,
    gap: 12,
  },
  cardLabel: {
    color: '#E2E8F0',
    fontSize: 20,
    fontWeight: '700',
  },
  cardCopy: {
    color: '#94A3B8',
    lineHeight: 20,
  },
  cardAction: {
    color: '#60A5FA',
    fontWeight: '600',
  },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
  },
  resumeLabel: {
    color: '#FCD34D',
    fontWeight: '600',
  },
  resumeCopy: {
    color: '#CBD5F5',
  },
  resumeButton: {
    backgroundColor: '#F97316',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  resumeButtonLabel: {
    color: '#030712',
    fontWeight: '700',
  },
  exit: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  exitLabel: {
    color: '#94A3B8',
    fontWeight: '600',
  },
});

