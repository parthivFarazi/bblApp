import { useEffect, useRef } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';

import { LiveGameStackParamList } from '@/navigation/LiveGameNavigator';
import { useGameStore } from '@/store/gameStore';
import { useStatsStore } from '@/store/statsStore';
import { buildIndividualLeaderboard } from '@/utils/stats';
import { Game } from '@/types';
import { persistGameToSupabase } from '@/services/backend';

type Props = NativeStackScreenProps<LiveGameStackParamList, 'Summary'>;

export const GameSummaryScreen = ({ navigation }: Props) => {
  const live = useGameStore((state) => state.live);
  const events = useGameStore((state) => state.events);
  const reset = useGameStore((state) => state.reset);
  const recordGame = useStatsStore((state) => state.recordGame);
  const recordedRef = useRef(false);
  const remoteRecordedRef = useRef(false);

  if (!live) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No completed game</Text>
          <Pressable style={styles.cta} onPress={() => navigation.replace('GameMode')}>
            <Text style={styles.ctaLabel}>New Game</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const teamIds = live.teamOrder.length ? live.teamOrder : Object.keys(live.teamLabels);
  const homeTeamId = teamIds[0];
  const awayTeamId = teamIds[1] ?? teamIds[0];
  const playedInnings = Math.max(
    1,
    live.inning,
    ...Object.values(live.scoreboard).flatMap((entry) =>
      Object.keys(entry.inningRuns).map((inning) => Number(inning)),
    ),
  );
  const innings = Array.from({ length: playedInnings }, (_, index) => index + 1);
  const players = Object.values(live.lineups).flatMap((lineup) =>
    lineup.lineup.map((slot) => slot.identity),
  );
  const summaryGame: Game = {
    id: live.gameId,
    type: live.type,
    leagueId: live.leagueId,
    homeTeamId,
    awayTeamId,
    plannedInnings: playedInnings,
    startTime: new Date().toISOString(),
    finalScore: {
      home: live.scoreboard[homeTeamId]?.runs ?? 0,
      away: live.scoreboard[awayTeamId]?.runs ?? 0,
    },
  };
  const leaders = buildIndividualLeaderboard({
    events,
    games: [summaryGame],
    players,
    scope: 'overall',
  }).slice(0, 4);

  const persistGame = async () => {
    if (recordedRef.current) {
      return;
    }
    const scoreboardSnapshot = JSON.parse(JSON.stringify(live.scoreboard));
    recordGame({
      game: summaryGame,
      events,
      players,
      teamLabels: live.teamLabels,
      scoreboard: scoreboardSnapshot,
      recordedAt: new Date().toISOString(),
      teamOrder: live.teamOrder,
    });
    recordedRef.current = true;
    if (!remoteRecordedRef.current) {
      try {
        await persistGameToSupabase(live, events);
        remoteRecordedRef.current = true;
      } catch (error) {
        console.error('Failed to sync game to Supabase', error);
        Alert.alert(
          'Sync Warning',
          'Game saved locally but failed to upload to the server. Stats may not appear in Stats Center until the next successful sync.',
        );
      }
    }
  };

  useEffect(() => {
    persistGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = async () => {
    await persistGame();
    reset();
    navigation.reset({
      index: 0,
      routes: [{ name: 'GameMode' }],
    });
  };

  const handleBackHome = async () => {
    await persistGame();
    navigation.getParent()?.goBack();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Final Score</Text>
        <View style={styles.card}>
          {teamIds.map((teamId) => (
            <View key={teamId} style={styles.scoreRow}>
              <Text style={styles.scoreTeam}>{live.teamLabels[teamId]}</Text>
              <Text style={styles.scoreValue}>{live.scoreboard[teamId].runs}</Text>
            </View>
          ))}
          <Text style={styles.meta}>
            {live.type === 'friendly' ? 'Friendly' : 'League'} •{' '}
            {format(new Date(), 'MMM d, h:mm a')}
          </Text>
        </View>

        <Text style={styles.title}>Inning Breakdown</Text>
        <ScrollView
          horizontal
          style={styles.tableScroll}
          contentContainerStyle={styles.tableContent}
          showsHorizontalScrollIndicator={false}
        >
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, styles.cellLabel]}>Team</Text>
              {innings.map((inning) => (
                <Text key={inning} style={[styles.tableCell, styles.numericCell]}>
                  {inning}
                </Text>
              ))}
              <Text style={[styles.tableCell, styles.numericCell]}>R</Text>
            </View>
            {teamIds.map((teamId, index) => (
              <View
                key={teamId}
                style={[styles.tableRow, index % 2 === 0 && styles.rowAlt]}
              >
                <Text style={[styles.tableCell, styles.cellLabel]}>
                  {live.teamLabels[teamId]}
                </Text>
                {innings.map((inning) => (
                  <Text key={inning} style={[styles.tableCell, styles.numericCell]}>
                    {live.scoreboard[teamId].inningRuns[inning] ?? 0}
                  </Text>
                ))}
                <Text style={[styles.tableCell, styles.numericCell]}>{live.scoreboard[teamId].runs}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.title}>Player Highlights</Text>
        <View style={styles.card}>
          {leaders.map((leader) => (
            <View key={leader.playerId} style={styles.leaderRow}>
              <View>
                <Text style={styles.leaderName}>{leader.displayName}</Text>
                <Text style={styles.leaderMeta}>
                  {leader.stats.hits} H • AVG {leader.stats.battingAverage.toFixed(3)} • RBI{' '}
                  {leader.stats.rbi}
                </Text>
              </View>
              <Text style={styles.leaderRBI}>{leader.stats.slugging.toFixed(3)} SLG</Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.cta} onPress={handleReset}>
          <Text style={styles.ctaLabel}>Start New Game</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={handleBackHome}>
          <Text style={styles.secondaryLabel}>Back to Home</Text>
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
    padding: 20,
    gap: 16,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '600',
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
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '600',
  },
  scoreValue: {
    color: '#FDE047',
    fontSize: 28,
    fontWeight: '700',
  },
  meta: {
    color: '#94A3B8',
  },
  table: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0B1220',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#111827',
  },
  rowAlt: {
    backgroundColor: '#0D1527',
  },
  tableCell: {
    width: 60,
    paddingVertical: 12,
    paddingHorizontal: 8,
    color: '#F8FAFC',
    borderRightWidth: 1,
    borderRightColor: '#1F2937',
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
    flexGrow: 0,
  },
  numericCell: {
    textAlign: 'right',
    paddingRight: 12,
    paddingLeft: 8,
  },
  cellLabel: {
    width: 140,
    textAlign: 'left',
    fontWeight: '600',
    paddingLeft: 14,
    paddingRight: 8,
  },
  tableScroll: {
    marginTop: 8,
  },
  tableContent: {
    flexGrow: 1,
  },
  leaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leaderName: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  leaderMeta: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  leaderRBI: {
    color: '#38BDF8',
    fontSize: 18,
    fontWeight: '700',
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
    fontWeight: '600',
  },
  cta: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  ctaLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    paddingVertical: 14,
  },
  secondaryLabel: {
    color: '#94A3B8',
    fontWeight: '600',
  },
});
