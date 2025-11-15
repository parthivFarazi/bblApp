import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  availableYears,
  leagueTeams,
  playerIdentities,
  sampleEvents,
  sampleGames,
} from '@/data/sampleData';
import { useStatsStore } from '@/store/statsStore';
import { useLeagueStore } from '@/store/leagueStore';
import { buildTeamLeaderboard } from '@/utils/stats';
import { StatScope, TeamStatsRow } from '@/types';

export const TeamStatsScreen = () => {
  const [scope, setScope] = useState<StatScope>('overall');
  const [selectedYear, setSelectedYear] = useState(availableYears[0] ?? new Date().getFullYear());
  const [selectedLeague, setSelectedLeague] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<keyof TeamStatsRow['stats']>('slugging');

  const recordedEvents = useStatsStore((state) => state.recordedEvents);
  const recordedGames = useStatsStore((state) => state.recordedGames);
  const playerDirectory = useStatsStore((state) => state.playerDirectory);
  const dynamicTeamLabels = useStatsStore((state) => state.teamLabels);

  const mergedEvents = useMemo(() => [...sampleEvents, ...recordedEvents], [recordedEvents]);
  const mergedGames = useMemo(() => [...sampleGames, ...recordedGames], [recordedGames]);
  const recordedPlayers = useMemo(() => Object.values(playerDirectory), [playerDirectory]);
  const mergedPlayers = useMemo(() => {
    const map = new Map<string, (typeof playerIdentities)[number]>();
    playerIdentities.forEach((player) => map.set(player.id, player));
    recordedPlayers.forEach((player) => map.set(player.id, player));
    return Array.from(map.values());
  }, [recordedPlayers]);

  const teamLabelLookup = useMemo(() => {
    const base = leagueTeams.reduce<Record<string, string>>((acc, team) => {
      acc[team.id] = team.name;
      return acc;
    }, {});
    return { ...base, ...dynamicTeamLabels };
  }, [dynamicTeamLabels]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>(availableYears);
    mergedGames.forEach((game) => years.add(new Date(game.startTime).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [mergedGames]);

  const savedLeagues = useLeagueStore((state) => state.leagues);
  const leagueOptions = useMemo(() => {
    const map = new Map<string, string>();
    savedLeagues.forEach((league) => {
      map.set(league.id, `${league.name} (${league.year})`);
    });
    mergedGames.forEach((game) => {
      if (game.type === 'league' && game.leagueId && !map.has(game.leagueId)) {
        map.set(game.leagueId, game.leagueId);
      }
    });
    return Array.from(map.entries());
  }, [mergedGames, savedLeagues]);

  const relevantTeamIds = useMemo(() => {
    const ids = new Set<string>();
    mergedGames.forEach((game) => {
      const year = new Date(game.startTime).getFullYear();
      const include =
        scope === 'league'
          ? game.type === 'league' && (!selectedLeague || game.leagueId === selectedLeague)
          : scope === 'year'
          ? year === selectedYear
          : true;
      if (include) {
        ids.add(game.homeTeamId);
        ids.add(game.awayTeamId);
      }
    });
    if (!ids.size) {
      Object.keys(teamLabelLookup).forEach((id) => ids.add(id));
    }
    return Array.from(ids);
  }, [mergedGames, scope, selectedLeague, selectedYear, teamLabelLookup]);

  const rows = useMemo(
    () =>
      buildTeamLeaderboard({
        teamIds: relevantTeamIds,
        teamLabelLookup,
        scope,
        games: mergedGames,
        events: mergedEvents,
        players: mergedPlayers,
        leagueId: selectedLeague,
        year: selectedYear,
      }),
    [
      relevantTeamIds,
      scope,
      selectedLeague,
      selectedYear,
      mergedEvents,
      mergedGames,
      mergedPlayers,
      teamLabelLookup,
    ],
  );

  const columns = useMemo(() => {
    const defense = [
      { key: 'catches', label: 'Catches' },
      { key: 'errors', label: 'Errors' },
    ] as ColumnDefinition[];
    const offense: ColumnDefinition[] = [
      { key: 'atBats', label: 'At Bats' },
      { key: 'hits', label: 'Hits' },
      { key: 'singles', label: 'Singles' },
      { key: 'doubles', label: 'Doubles' },
      { key: 'triples', label: 'Triples' },
      { key: 'homeruns', label: 'Homeruns' },
      { key: 'strikeouts', label: 'Strikeouts' },
      { key: 'battingAverage', label: 'AVG', precision: 3 },
      { key: 'slugging', label: 'SLG', precision: 3 },
    ];
    const misc: ColumnDefinition[] = [
      { key: 'stealsAttempted', label: 'Steals Attempted' },
      { key: 'stealsWon', label: 'Steals Won' },
      { key: 'stealsLost', label: 'Steals Lost' },
      { key: 'basesDefended', label: 'Bases Defended' },
    ];
    const leagueExtras: ColumnDefinition[] =
      scope === 'league'
        ? [
            { key: 'gamesPlayed', label: 'Games Played' },
            { key: 'averageScore', label: 'Avg Score', precision: 1 },
          ]
        : [];
    return [...leagueExtras, ...defense, ...offense, ...misc];
  }, [scope]);

  const filteredRows = useMemo(() => {
    const scopedRows =
      scope === 'league' ? rows.filter((row) => row.stats.gamesPlayed > 0) : rows;
    return scopedRows.sort((a, b) => (b.stats[sortBy] ?? 0) - (a.stats[sortBy] ?? 0));
  }, [rows, sortBy, scope]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Team Stats</Text>
        <View style={styles.segment}>
          {(['overall', 'year', 'league'] as StatScope[]).map((option) => (
            <Pressable
              key={option}
              style={[styles.segmentOption, scope === option && styles.segmentSelected]}
              onPress={() => setScope(option)}
            >
              <Text style={[styles.segmentLabel, scope === option && styles.segmentLabelActive]}>
                {option.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        {scope === 'year' && (
          <View style={styles.filters}>
            {yearOptions.map((year) => (
              <Pressable
                key={year}
                style={[styles.chip, selectedYear === year && styles.chipActive]}
                onPress={() => setSelectedYear(year)}
              >
                <Text style={[styles.chipLabel, selectedYear === year && styles.chipLabelActive]}>
                  {year}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {scope === 'league' && (
          <View style={styles.filters}>
            <Pressable
              style={[styles.chip, !selectedLeague && styles.chipActive]}
              onPress={() => setSelectedLeague(undefined)}
            >
              <Text style={[styles.chipLabel, !selectedLeague && styles.chipLabelActive]}>
                All
              </Text>
            </Pressable>
            {leagueOptions.map(([leagueId, label]) => (
              <Pressable
                key={leagueId}
                style={[styles.chip, selectedLeague === leagueId && styles.chipActive]}
                onPress={() => setSelectedLeague(leagueId)}
              >
                <Text
                  style={[styles.chipLabel, selectedLeague === leagueId && styles.chipLabelActive]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <ScrollView horizontal style={styles.tableScroll} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.table}>
            <View style={styles.headerRow}>
              <Text style={[styles.cell, styles.teamCell]}>Team</Text>
              {columns.map((column) => (
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
            {filteredRows.map((row) => (
              <View key={row.teamId} style={styles.dataRow}>
                <Text style={[styles.cell, styles.teamCell]}>{row.label}</Text>
                {columns.map((column) => (
                  <Text key={column.key} style={styles.cell}>
                    {formatTeamStat(row.stats[column.key], column.precision)}
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

type ColumnDefinition = {
  key: keyof TeamStatsRow['stats'];
  label: string;
  precision?: number;
};

const formatTeamStat = (value: number, precision?: number) => {
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
  segment: {
    flexDirection: 'row',
    borderRadius: 16,
    backgroundColor: '#0F172A',
    padding: 4,
    gap: 4,
  },
  segmentOption: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: '#1D4ED8',
  },
  segmentLabel: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  segmentLabelActive: {
    color: '#F8FAFC',
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0F172A',
  },
  chipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#1E3A8A',
  },
  chipLabel: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  chipLabelActive: {
    color: '#F8FAFC',
  },
  tableScroll: {
    marginTop: 12,
  },
  table: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
  },
  dataRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
  },
  cell: {
    flex: 1,
    padding: 12,
    textAlign: 'center',
    color: '#E2E8F0',
    fontSize: 12,
  },
  teamCell: {
    flex: 2,
    textAlign: 'left',
    fontWeight: '600',
  },
  activeHeader: {
    backgroundColor: '#172554',
  },
  headerLabel: {
    color: '#E2E8F0',
    fontWeight: '600',
  },
});
