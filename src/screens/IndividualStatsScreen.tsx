import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  availableYears,
  playerIdentities,
  sampleEvents,
  sampleGames,
} from '@/data/sampleData';
import { useStatsStore } from '@/store/statsStore';
import { useLeagueStore } from '@/store/leagueStore';
import { buildIndividualLeaderboard } from '@/utils/stats';
import { IndividualStatsRow, StatScope } from '@/types';

const leaderboardColumns: Array<{
  key: keyof IndividualStatsRow['stats'];
  label: string;
  precision?: number;
}> = [
  { key: 'gamesPlayed', label: 'GP' },
  { key: 'atBats', label: 'AB' },
  { key: 'hits', label: 'H' },
  { key: 'singles', label: '1B' },
  { key: 'doubles', label: '2B' },
  { key: 'triples', label: '3B' },
  { key: 'homeruns', label: 'HR' },
  { key: 'battingAverage', label: 'AVG', precision: 3 },
  { key: 'slugging', label: 'SLG', precision: 3 },
  { key: 'rbi', label: 'RBI' },
  { key: 'strikeouts', label: 'K' },
  { key: 'catches', label: 'Catches' },
  { key: 'errors', label: 'Errors' },
  { key: 'stealsAttempted', label: 'Steal Att' },
  { key: 'stealsWon', label: 'Steal Won' },
  { key: 'stealsLost', label: 'Steal Lost' },
  { key: 'basesStolen', label: 'Bases Stolen' },
  { key: 'basesDefended', label: 'Bases Defended' },
];

const sortOptions: Array<keyof IndividualStatsRow['stats']> = leaderboardColumns.map(
  (col) => col.key,
);

export const IndividualStatsScreen = () => {
  const [scope, setScope] = useState<StatScope>('overall');
  const [selectedYear, setSelectedYear] = useState(availableYears[0] ?? new Date().getFullYear());
  const [selectedLeague, setSelectedLeague] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<keyof IndividualStatsRow['stats']>('slugging');
  const recordedEvents = useStatsStore((state) => state.recordedEvents);
  const recordedGames = useStatsStore((state) => state.recordedGames);
  const playerDirectory = useStatsStore((state) => state.playerDirectory);

  const mergedEvents = useMemo(() => [...sampleEvents, ...recordedEvents], [recordedEvents]);
  const mergedGames = useMemo(() => [...sampleGames, ...recordedGames], [recordedGames]);
  const recordedPlayers = useMemo(
    () => Object.values(playerDirectory),
    [playerDirectory],
  );
  const mergedPlayers = useMemo(() => {
    const map = new Map<string, (typeof playerIdentities)[number]>();
    playerIdentities.forEach((player) => map.set(player.id, player));
    recordedPlayers.forEach((player) => map.set(player.id, player));
    return Array.from(map.values());
  }, [recordedPlayers]);
  const yearOptions = useMemo(() => {
    const set = new Set<number>(availableYears);
    mergedGames.forEach((game) => {
      set.add(new Date(game.startTime).getFullYear());
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [mergedGames]);
  const savedLeagues = useLeagueStore((state) => state.leagues);
  const leagueOptions = useMemo(() => {
    const map = new Map<string, string>();
    savedLeagues.forEach((league) => {
      map.set(league.id, `${league.name} (${league.year})`);
    });
    mergedGames.forEach((game) => {
      if (game.type === 'league' && game.leagueId) {
        if (!map.has(game.leagueId)) {
          map.set(game.leagueId, game.leagueId);
        }
      }
    });
    return Array.from(map.entries());
  }, [mergedGames, savedLeagues]);

  const leaderboard = useMemo(
    () =>
      buildIndividualLeaderboard({
        events: mergedEvents,
        games: mergedGames,
        players: mergedPlayers,
        scope,
        year: selectedYear,
        leagueId: selectedLeague,
        sortBy,
      }),
    [scope, selectedLeague, selectedYear, sortBy, mergedEvents, mergedGames, mergedPlayers],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Individual Leaderboard</Text>
        <View style={styles.segment}>
          {(['overall', 'year', 'league'] as StatScope[]).map((option) => (
            <Pressable
              key={option}
              style={[styles.segmentOption, scope === option && styles.segmentSelected]}
              onPress={() => setScope(option)}
            >
              <Text style={[styles.segmentLabel, scope === option && styles.segmentLabelSelected]}>
                {option.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        {scope === 'year' && (
          <View style={styles.filterRow}>
            {yearOptions.map((year) => (
              <Pressable
                key={year}
                style={[styles.filterChip, selectedYear === year && styles.filterChipActive]}
                onPress={() => setSelectedYear(year)}
              >
                <Text
                  style={[
                    styles.filterLabel,
                    selectedYear === year && styles.filterLabelActive,
                  ]}
                >
                  {year}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {scope === 'league' && (
          <View style={styles.filterRow}>
            <Pressable
              style={[styles.filterChip, !selectedLeague && styles.filterChipActive]}
              onPress={() => setSelectedLeague(undefined)}
            >
              <Text style={[styles.filterLabel, !selectedLeague && styles.filterLabelActive]}>
                All
              </Text>
            </Pressable>
            {leagueOptions.map(([id, label]) => (
              <Pressable
                key={id}
                style={[styles.filterChip, selectedLeague === id && styles.filterChipActive]}
                onPress={() => setSelectedLeague(id)}
              >
                <Text
                  style={[
                    styles.filterLabel,
                    selectedLeague === id && styles.filterLabelActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.subtitle}>Sort by</Text>
        <View style={styles.filterRow}>
          {sortOptions.map((option) => (
            <Pressable
              key={option}
              style={[styles.filterChip, sortBy === option && styles.filterChipActive]}
              onPress={() => setSortBy(option)}
            >
              <Text
                style={[styles.filterLabel, sortBy === option && styles.filterLabelActive]}
              >
                {option.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView horizontal style={styles.tableScroll} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.playerCell]}>Player</Text>
              {leaderboardColumns.map((column) => (
                <Pressable
                  key={column.key}
                  style={[
                    styles.cell,
                    sortBy === column.key && styles.activeHeader,
                  ]}
                  onPress={() => setSortBy(column.key)}
                >
                  <Text style={styles.headerLabel}>{column.label}</Text>
                </Pressable>
              ))}
            </View>
            {leaderboard.map((row) => (
              <View key={row.playerId} style={styles.tableRow}>
                <Text style={[styles.cell, styles.playerCell]}>{row.displayName}</Text>
                {leaderboardColumns.map((column) => (
                  <Text key={column.key} style={styles.cell}>
                    {formatStatValue(row.stats[column.key], column.precision)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
};

const formatStatValue = (value: number, precision?: number) => {
  if (precision !== undefined) {
    return value.toFixed(precision);
  }
  return value.toString();
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#020617',
  },
  container: {
    padding: 16,
    gap: 16,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmentOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: '#1D4ED8',
  },
  segmentLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  segmentLabelSelected: {
    color: '#F8FAFC',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  filterChipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#1E3A8A',
  },
  filterLabel: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  filterLabelActive: {
    color: '#F8FAFC',
  },
  tableScroll: {
    marginTop: 12,
  },
  table: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0B1220',
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  cell: {
    minWidth: 90,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: '#E2E8F0',
    fontSize: 12,
    textAlign: 'center',
  },
  playerCell: {
    minWidth: 160,
    textAlign: 'left',
    fontWeight: '600',
  },
  headerLabel: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  activeHeader: {
    backgroundColor: '#1E3A8A',
  },
});
