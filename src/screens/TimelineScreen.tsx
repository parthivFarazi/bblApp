import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { leagueTeams, sampleGames } from '@/data/sampleData';
import { useStatsStore } from '@/store/statsStore';
import { GameMode } from '@/types';
import { StatsStackParamList } from '@/navigation/StatsNavigator';

const teamLookup = leagueTeams.reduce<Record<string, string>>((acc, team) => {
  acc[team.id] = team.name;
  return acc;
}, {});

export const TimelineScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<StatsStackParamList>>();
  const recordedDetails = useStatsStore((state) => state.recordedDetails);

  const recordedEntries: TimelineEntry[] = Object.values(recordedDetails).map((detail) => {
    const awayId = detail.teamOrder[0];
    const homeId = detail.teamOrder[1] ?? detail.teamOrder[0];
    return {
      id: detail.id,
      source: 'recorded' as const,
      type: detail.game.type,
      playedAt: detail.recordedAt,
      awayName: detail.teamLabels[awayId] ?? 'Visitors',
      homeName: detail.teamLabels[homeId] ?? 'Home',
      awayScore: detail.scoreboard[awayId]?.runs ?? 0,
      homeScore: detail.scoreboard[homeId]?.runs ?? 0,
    };
  });

  const historicalEntries: TimelineEntry[] = sampleGames.map((game) => ({
    id: game.id,
    source: 'sample' as const,
    type: game.type,
    playedAt: game.startTime,
    awayName: teamLookup[game.awayTeamId] ?? 'Visitors',
    homeName: teamLookup[game.homeTeamId] ?? 'Home',
    awayScore: game.finalScore?.away ?? 0,
    homeScore: game.finalScore?.home ?? 0,
  }));

  const games = [...recordedEntries, ...historicalEntries].sort(
    (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime(),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Game Log</Text>
        <View style={styles.list}>
          {games.map((game) => (
            <Pressable
              key={`${game.id}-${game.source}`}
              style={styles.item}
              onPress={() => navigation.navigate('HistoryDetail', { gameId: game.id, source: game.source })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.date}>{format(new Date(game.playedAt), 'MMM d, h:mm a')}</Text>
                <Text style={styles.matchup}>
                  {game.awayName} @ {game.homeName}
                </Text>
                <Text style={styles.meta}>{game.type === 'league' ? 'League' : 'Friendly'}</Text>
              </View>
              <View style={styles.scoreBox}>
                <Text style={styles.scoreLine}>
                  {game.awayScore.toString().padStart(2, ' ')} -{' '}
                  {game.homeScore.toString().padStart(2, ' ')}
                </Text>
                <Text style={styles.scoreMeta}>Runs</Text>
              </View>
            </Pressable>
          ))}
        </View>
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
    padding: 16,
    gap: 12,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
  },
  list: {
    gap: 12,
  },
  item: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#0F172A',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
  },
  date: {
    color: '#94A3B8',
    fontSize: 12,
  },
  matchup: {
    color: '#F8FAFC',
    fontWeight: '600',
    marginTop: 4,
  },
  meta: {
    color: '#38BDF8',
    fontSize: 12,
    marginTop: 4,
  },
  scoreBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  scoreLine: {
    color: '#FDE047',
    fontWeight: '700',
    fontSize: 18,
  },
  scoreMeta: {
    color: '#94A3B8',
    fontSize: 12,
  },
});

type TimelineEntry = {
  id: string;
  type: GameMode;
  source: 'recorded' | 'sample';
  playedAt: string;
  awayName: string;
  homeName: string;
  awayScore: number;
  homeScore: number;
};
