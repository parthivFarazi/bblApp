import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';

import { StatsStackParamList } from '@/navigation/StatsNavigator';
import { useStatsStore } from '@/store/statsStore';
import { sampleEvents, sampleGames, playerIdentities, leagueTeams } from '@/data/sampleData';
import { buildIndividualLeaderboard } from '@/utils/stats';
import { Game, GameEvent, PlayerIdentity } from '@/types';

type Props = NativeStackScreenProps<StatsStackParamList, 'HistoryDetail'>;

const teamLookup = leagueTeams.reduce<Record<string, string>>((acc, team) => {
  acc[team.id] = team.name;
  return acc;
}, {});

export const GameHistoryDetailScreen = ({ route, navigation }: Props) => {
  const { gameId, source } = route.params;
  const recordedDetails = useStatsStore((state) => state.recordedDetails);

  const detail = useMemo(() => {
    if (source === 'recorded') {
      return recordedDetails[gameId];
    }
    const sampleGame = sampleGames.find((game) => game.id === gameId);
    if (!sampleGame) return undefined;
    return {
      id: sampleGame.id,
      game: sampleGame,
      teamLabels: {
        [sampleGame.awayTeamId]: teamLookup[sampleGame.awayTeamId] ?? 'Visitors',
        [sampleGame.homeTeamId]: teamLookup[sampleGame.homeTeamId] ?? 'Home',
      },
      scoreboard: {
        [sampleGame.awayTeamId]: {
          runs: sampleGame.finalScore?.away ?? 0,
          hits: 0,
          errors: 0,
          inningRuns: {},
        },
        [sampleGame.homeTeamId]: {
          runs: sampleGame.finalScore?.home ?? 0,
          hits: 0,
          errors: 0,
          inningRuns: {},
        },
      },
      events: sampleEvents.filter((event) => event.gameId === sampleGame.id),
      players: playerIdentities,
      recordedAt: sampleGame.startTime,
      teamOrder: [sampleGame.awayTeamId, sampleGame.homeTeamId],
    };
  }, [gameId, source, recordedDetails]);

  if (!detail) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Game not found</Text>
          <Pressable style={styles.cta} onPress={() => navigation.goBack()}>
            <Text style={styles.ctaLabel}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { game, teamLabels, scoreboard, events, players, teamOrder } = detail;
  const leaders = buildIndividualLeaderboard({
    events,
    games: [game],
    players,
    scope: 'overall',
  }).slice(0, 6);

  const innings = useMemo(() => {
    const inningSet = new Set<number>();
    teamOrder.forEach((teamId) => {
      const runs = scoreboard[teamId]?.inningRuns ?? {};
      Object.keys(runs).forEach((inning) => inningSet.add(Number(inning)));
    });
    return Array.from(inningSet).sort((a, b) => a - b);
  }, [scoreboard, teamOrder]);

  const getTeamName = (teamId: string, index: number) =>
    teamLabels[teamId] ?? (index === 0 ? 'Visitors' : 'Home');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backLabel}>← Back to History</Text>
        </Pressable>

        <Text style={styles.kicker}>
          {game.type === 'league' ? 'League Game' : 'Friendly Game'} •{' '}
          {format(new Date(detail.recordedAt), 'MMM d, yyyy h:mm a')}
        </Text>
        <Text style={styles.title}>Final Score</Text>
        <View style={styles.card}>
          {teamOrder.map((teamId, index) => (
            <View key={teamId} style={styles.scoreRow}>
              <View>
                <Text style={styles.scoreTeam}>{getTeamName(teamId, index)}</Text>
                <Text style={styles.scoreMeta}>
                  Hits {scoreboard[teamId]?.hits ?? 0} • Errors {scoreboard[teamId]?.errors ?? 0}
                </Text>
              </View>
              <Text style={styles.scoreValue}>{scoreboard[teamId]?.runs ?? 0}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Inning Breakdown</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.cell, styles.teamCell]}>Team</Text>
            {innings.map((inning) => (
              <Text key={inning} style={styles.cell}>
                {inning}
              </Text>
            ))}
            <Text style={styles.cell}>R</Text>
          </View>
          {teamOrder.map((teamId, index) => (
            <View key={teamId} style={styles.tableRow}>
              <Text style={[styles.cell, styles.teamCell]}>{getTeamName(teamId, index)}</Text>
              {innings.map((inning) => (
                <Text key={inning} style={styles.cell}>
                  {scoreboard[teamId]?.inningRuns?.[inning] ?? 0}
                </Text>
              ))}
              <Text style={styles.cell}>{scoreboard[teamId]?.runs ?? 0}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Player Highlights</Text>
        <View style={styles.card}>
          {leaders.map((leader) => (
            <View key={leader.playerId} style={styles.leaderRow}>
              <View>
                <Text style={styles.leaderName}>{leader.displayName}</Text>
                <Text style={styles.leaderMeta}>
                  {leader.stats.hits} H • AVG {leader.stats.battingAverage.toFixed(3)} • SLG{' '}
                  {leader.stats.slugging.toFixed(3)}
                </Text>
              </View>
              <Text style={styles.leaderRBI}>{leader.stats.rbi} RBI</Text>
            </View>
          ))}
          {!leaders.length && (
            <Text style={styles.emptyCopy}>No player stats recorded for this game.</Text>
          )}
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
    padding: 20,
    gap: 16,
  },
  backButton: {
    paddingVertical: 8,
  },
  backLabel: {
    color: '#60A5FA',
    fontWeight: '600',
  },
  kicker: {
    color: '#93C5FD',
    fontWeight: '600',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreTeam: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  scoreMeta: {
    color: '#94A3B8',
    fontSize: 12,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FDE047',
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  table: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
  },
  cell: {
    flex: 1,
    padding: 10,
    color: '#E2E8F0',
    textAlign: 'center',
  },
  teamCell: {
    flex: 2,
    textAlign: 'left',
    fontWeight: '600',
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leaderName: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  leaderMeta: {
    color: '#94A3B8',
    fontSize: 12,
  },
  leaderRBI: {
    color: '#34D399',
    fontWeight: '700',
    fontSize: 18,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyCopy: {
    color: '#94A3B8',
  },
  cta: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  ctaLabel: {
    color: '#fff',
    fontWeight: '600',
  },
});
