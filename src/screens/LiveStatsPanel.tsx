import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGameStore } from '@/store/gameStore';
import { buildIndividualLeaderboard } from '@/utils/stats';
import { Game, IndividualStatsRow } from '@/types';

const STAT_COLUMNS: { key: keyof IndividualStatsRow['stats']; label: string; precision?: number }[] = [
  { key: 'atBats', label: 'AB' },
  { key: 'hits', label: 'H' },
  { key: 'singles', label: '1B' },
  { key: 'doubles', label: '2B' },
  { key: 'triples', label: '3B' },
  { key: 'homeruns', label: 'HR' },
  { key: 'rbi', label: 'RBI' },
  { key: 'strikeouts', label: 'K' },
  { key: 'battingAverage', label: 'AVG', precision: 3 },
  { key: 'slugging', label: 'SLG', precision: 3 },
  { key: 'catches', label: 'C' },
  { key: 'errors', label: 'E' },
  { key: 'stealsAttempted', label: 'SA' },
  { key: 'stealsWon', label: 'SW' },
  { key: 'stealsLost', label: 'SL' },
  { key: 'basesDefended', label: 'BD' },
  { key: 'basesDefendedSuccessful', label: 'BD+' },
];

const COL_WIDTH = 56;
const NAME_WIDTH = 130;

const formatStat = (value: number, precision?: number) => {
  if (precision !== undefined) return value.toFixed(precision);
  return String(value);
};

export const LiveStatsPanel = () => {
  const live = useGameStore((state) => state.live);
  const events = useGameStore((state) => state.events);

  const teamIds = useMemo(
    () => (live?.teamOrder.length ? live.teamOrder : Object.keys(live?.teamLabels ?? {})),
    [live],
  );

  const playedInnings = useMemo(() => {
    if (!live) return 1;
    return Math.max(
      1,
      live.inning,
      ...Object.values(live.scoreboard).flatMap((entry) =>
        Object.keys(entry.inningRuns).map(Number),
      ),
    );
  }, [live]);

  const innings = useMemo(
    () => Array.from({ length: playedInnings }, (_, i) => i + 1),
    [playedInnings],
  );

  const leaders = useMemo(() => {
    if (!live) return [];
    const players = Object.values(live.lineups).flatMap((lineup) =>
      lineup.lineup.map((slot) => slot.identity),
    );
    const summaryGame: Game = {
      id: live.gameId,
      type: live.type,
      leagueId: live.leagueId,
      homeTeamId: teamIds[0],
      awayTeamId: teamIds[1] ?? teamIds[0],
      plannedInnings: playedInnings,
      startTime: new Date().toISOString(),
      finalScore: {
        home: live.scoreboard[teamIds[0]]?.runs ?? 0,
        away: live.scoreboard[teamIds[1] ?? teamIds[0]]?.runs ?? 0,
      },
    };
    return buildIndividualLeaderboard({
      events,
      games: [summaryGame],
      players,
      scope: 'overall',
    });
  }, [events, live, teamIds, playedInnings]);

  if (!live) return null;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Live Stats</Text>

      {/* Inning Breakdown */}
      <Text style={styles.sectionLabel}>Inning Breakdown</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tableScroll}
        contentContainerStyle={styles.tableScrollContent}
      >
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, styles.teamCell]}>Team</Text>
            {innings.map((inn) => (
              <Text key={inn} style={[styles.tableCell, styles.inningCell]}>
                {inn}
              </Text>
            ))}
            <Text style={[styles.tableCell, styles.inningCell, styles.totalCell]}>R</Text>
          </View>
          {/* Team rows */}
          {teamIds.map((teamId, idx) => (
            <View key={teamId} style={[styles.tableRow, idx % 2 === 0 && styles.rowAlt]}>
              <Text style={[styles.tableCell, styles.teamCell]} numberOfLines={1}>
                {live.teamLabels[teamId]}
              </Text>
              {innings.map((inn) => (
                <Text key={inn} style={[styles.tableCell, styles.inningCell]}>
                  {live.scoreboard[teamId]?.inningRuns[inn] ?? 0}
                </Text>
              ))}
              <Text style={[styles.tableCell, styles.inningCell, styles.totalCell]}>
                {live.scoreboard[teamId]?.runs ?? 0}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Individual Player Stats */}
      <Text style={styles.sectionLabel}>Player Stats</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        style={styles.tableScroll}
        contentContainerStyle={styles.tableScrollContent}
      >
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, styles.nameCell]}>Player</Text>
            {STAT_COLUMNS.map((col) => (
              <Text key={col.key} style={[styles.tableCell, styles.statCell]}>
                {col.label}
              </Text>
            ))}
          </View>
          {/* Player rows */}
          {leaders.map((row, idx) => (
            <View key={row.playerId} style={[styles.tableRow, idx % 2 === 0 && styles.rowAlt]}>
              <Text style={[styles.tableCell, styles.nameCell]} numberOfLines={1}>
                {row.displayName}
              </Text>
              {STAT_COLUMNS.map((col) => (
                <Text key={col.key} style={[styles.tableCell, styles.statCell]}>
                  {formatStat(row.stats[col.key], col.precision)}
                </Text>
              ))}
            </View>
          ))}
          {leaders.length === 0 && (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No events recorded yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#050D1E',
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  title: {
    color: '#F2D680',
    fontSize: 22,
    fontWeight: '700',
  },
  sectionLabel: {
    color: '#F2D680',
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: 4,
  },
  tableScroll: {
    marginTop: 4,
  },
  tableScrollContent: {
    flexGrow: 1,
  },
  table: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1D3F73',
    backgroundColor: '#0B1834',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0E2046',
    borderBottomWidth: 1,
    borderBottomColor: '#1D3F73',
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#0B1834',
    borderTopWidth: 1,
    borderTopColor: '#0E2046',
  },
  rowAlt: {
    backgroundColor: '#091530',
  },
  tableCell: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    color: '#E2E8F0',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    borderRightWidth: 1,
    borderRightColor: '#1D3F73',
  },
  teamCell: {
    width: 120,
    fontWeight: '600',
    paddingLeft: 12,
    color: '#F2D680',
  },
  inningCell: {
    width: 40,
    textAlign: 'center',
  },
  totalCell: {
    fontWeight: '700',
    color: '#CFB53B',
    borderRightWidth: 0,
  },
  nameCell: {
    width: NAME_WIDTH,
    fontWeight: '600',
    paddingLeft: 12,
  },
  statCell: {
    width: COL_WIDTH,
    textAlign: 'right',
    paddingRight: 8,
  },
  emptyRow: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontStyle: 'italic',
  },
});
