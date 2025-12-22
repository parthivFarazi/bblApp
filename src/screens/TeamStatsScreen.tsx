import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Modal } from 'react-native';
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
import { fetchAllTeams, fetchGamesWithEvents } from '@/services/backend';

const STAT_COLUMN_WIDTH = 70; // Uniform width for all stat columns

export const TeamStatsScreen = () => {
  const [scope, setScope] = useState<StatScope>('overall');
  const [selectedYear, setSelectedYear] = useState(availableYears[0] ?? new Date().getFullYear());
  const [selectedLeague, setSelectedLeague] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<keyof TeamStatsRow['stats']>('slugging');
  const [openSelect, setOpenSelect] = useState<
    { type: 'year' | 'league' | 'sort'; options: Array<{ value: string; label: string }> } | null
  >(null);

  const recordedEvents = useStatsStore((state) => state.recordedEvents);
  const recordedGames = useStatsStore((state) => state.recordedGames);
  const playerDirectory = useStatsStore((state) => state.playerDirectory);
  const dynamicTeamLabels = useStatsStore((state) => state.teamLabels);
  const hydrateStats = useStatsStore((state) => state.hydrate);

  const mergedEvents = useMemo(() => [...recordedEvents], [recordedEvents]);
  const mergedGames = useMemo(() => [...recordedGames], [recordedGames]);
  const recordedPlayers = useMemo(() => Object.values(playerDirectory), [playerDirectory]);
  const mergedPlayers = useMemo(() => recordedPlayers, [recordedPlayers]);

  const teamLabelLookup = useMemo(() => {
    const base = leagueTeams.reduce<Record<string, string>>((acc, team) => {
      acc[team.id] = team.name;
      return acc;
    }, {});
    return { ...base, ...dynamicTeamLabels };
  }, [dynamicTeamLabels]);

  useEffect(() => {
    const loadRemote = async () => {
      try {
        const [{ games, events, gamePlayers }, teams] = await Promise.all([
          fetchGamesWithEvents(),
          fetchAllTeams(),
        ]);

        const playerDirectoryFromGames = gamePlayers.reduce<Record<string, any>>((acc, row) => {
          const player = (row as any).players;
          if (!player) return acc;
          const displayName =
            player.guest_name ||
            player.brothers?.display_name ||
            player.id;
          acc[player.id] = {
            id: player.id,
            displayName,
            brotherId: player.brother_id ?? undefined,
            isGuest: player.is_guest ?? false,
            teamId: row.team_id,
          };
          return acc;
        }, {});

        const teamLabels = teams.reduce<Record<string, string>>((acc, team) => {
          acc[team.id] = team.name;
          return acc;
        }, {});

        const mappedGames = games.map((game) => ({
          id: game.id,
          type: game.type,
          leagueId: game.league_id ?? undefined,
          homeTeamId: game.home_team_id,
          awayTeamId: game.away_team_id,
          plannedInnings: game.planned_innings ?? 1,
          startTime: game.start_time,
          completedAt: game.completed_at ?? undefined,
          finalScore: {
            home: game.final_score_home ?? 0,
            away: game.final_score_away ?? 0,
          },
        })) as any;

        const mappedEvents = events.map((event) => ({
          id: event.id,
          gameId: event.game_id,
          eventType: event.event_type,
          batterId: event.batter_id ?? undefined,
          defenderId: event.defender_id ?? undefined,
          runnerId: event.runner_id ?? undefined,
          inning: event.inning,
          half: event.half,
          baseStateBefore: event.base_state_before,
          baseStateAfter: event.base_state_after,
          runsScored: event.runs_scored ?? 0,
          rbi: event.rbi ?? 0,
          timestamp: event.timestamp ?? Date.now(),
          notes: event.notes ?? undefined,
        })) as any;

        hydrateStats({
          games: mappedGames,
          events: mappedEvents,
          playerDirectory: playerDirectoryFromGames,
          teamLabels,
        });
      } catch (error) {
        console.error('Failed to load remote stats', error);
      }
    };
    loadRemote();
  }, [hydrateStats]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>(availableYears);
    mergedGames.forEach((game) => years.add(new Date(game.startTime).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [mergedGames]);

  const savedLeagues = useLeagueStore((state) => state.leagues);
  const leagueOptions = useMemo(() => {
    const map = new Map<
      string,
      {
        label: string;
        sortValue: number;
      }
    >();

    savedLeagues.forEach((league) => {
      const sortValue = new Date(league.year, 0, 1).getTime();
      map.set(league.id, { label: `${league.name} (${league.year})`, sortValue });
    });

    mergedGames.forEach((game) => {
      if (game.type !== 'league' || !game.leagueId) return;
      const latestPlayed = new Date(game.startTime).getTime();
      const existing = map.get(game.leagueId);
      if (!existing || latestPlayed > existing.sortValue) {
        map.set(game.leagueId, { label: existing?.label ?? game.leagueId, sortValue: latestPlayed });
      }
    });

    return Array.from(map.entries()).sort((a, b) => b[1].sortValue - a[1].sortValue);
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
      { key: 'catches', label: 'Catches', short: 'C', width: STAT_COLUMN_WIDTH },
      { key: 'errors', label: 'Errors', short: 'E', width: STAT_COLUMN_WIDTH },
    ] as ColumnDefinition[];
    const offense: ColumnDefinition[] = [
      { key: 'atBats', label: 'At Bats', short: 'AB', width: STAT_COLUMN_WIDTH },
      { key: 'hits', label: 'Hits', short: 'H', width: STAT_COLUMN_WIDTH },
      { key: 'singles', label: 'Singles', short: '1B', width: STAT_COLUMN_WIDTH },
      { key: 'doubles', label: 'Doubles', short: '2B', width: STAT_COLUMN_WIDTH },
      { key: 'triples', label: 'Triples', short: '3B', width: STAT_COLUMN_WIDTH },
      { key: 'homeruns', label: 'Homeruns', short: 'HR', width: STAT_COLUMN_WIDTH },
      { key: 'strikeouts', label: 'Strikeouts', short: 'K', width: STAT_COLUMN_WIDTH },
      { key: 'battingAverage', label: 'Batting Average', short: 'AVG', precision: 3, width: STAT_COLUMN_WIDTH },
      { key: 'slugging', label: 'Slugging', short: 'SLG', precision: 3, width: STAT_COLUMN_WIDTH },
    ];
    const misc: ColumnDefinition[] = [
      { key: 'stealsAttempted', label: 'Steals Attempted', short: 'SA', width: STAT_COLUMN_WIDTH },
      { key: 'stealsWon', label: 'Steals Won', short: 'SW', width: STAT_COLUMN_WIDTH },
      { key: 'stealsLost', label: 'Steals Lost', short: 'SL', width: STAT_COLUMN_WIDTH },
      { key: 'basesDefended', label: 'Bases Defended', short: 'BD', width: STAT_COLUMN_WIDTH },
      { key: 'basesDefendedSuccessful', label: 'Bases Defended (Successful)', short: 'BD+', width: STAT_COLUMN_WIDTH },
    ];
    const baseColumns: ColumnDefinition[] = [
      { key: 'gamesPlayed', label: 'Games Played', short: 'GP', width: STAT_COLUMN_WIDTH },
      ...(scope === 'league'
        ? [{ key: 'averageScore' as const, label: 'Average Score', short: 'AVG', precision: 1, width: STAT_COLUMN_WIDTH }]
        : []),
    ];
    return [...baseColumns, ...offense, ...defense, ...misc];
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
          <Select
            label="Year"
            value={String(selectedYear)}
            display={String(selectedYear)}
            options={yearOptions.map((year) => ({ value: String(year), label: String(year) }))}
            onOpen={(options) => setOpenSelect({ type: 'year', options })}
          />
        )}

        {scope === 'league' && (
          <Select
            label="League"
            value={selectedLeague ?? 'all'}
            display={
              selectedLeague
                ? leagueOptions.find(([id]) => id === selectedLeague)?.[1].label ?? 'League'
                : 'All Leagues'
            }
            options={[
              { value: 'all', label: 'All Leagues' },
              ...leagueOptions.map(([id, entry]) => ({ value: id, label: entry.label })),
            ]}
            onOpen={(options) => setOpenSelect({ type: 'league', options })}
          />
        )}

        <Select
          label="Sort by"
          value={String(sortBy)}
          display={columns.find((col) => col.key === sortBy)?.label ?? String(sortBy)}
          options={columns.map((column) => ({
            value: String(column.key),
            label: column.label,
          }))}
          onOpen={(options) => setOpenSelect({ type: 'sort', options })}
        />

        <ScrollView
          horizontal
          style={styles.tableScroll}
          contentContainerStyle={styles.tableContent}
          showsHorizontalScrollIndicator
        >
          <View style={styles.table}>
            <View style={styles.headerRow}>
              <Text style={[styles.cell, styles.teamCell]}>Team</Text>
              {columns.map((column, colIndex) => (
                <Pressable
                  key={column.key}
                  style={[
                    styles.cell,
                    styles.numericCell,
                    { width: column.width ?? STAT_COLUMN_WIDTH },
                    sortBy === column.key && styles.activeHeader,
                    colIndex === columns.length - 1 && styles.lastCell,
                  ]}
                  onPress={() => setSortBy(column.key)}
                >
                  <Text style={styles.headerLabel}>{column.short}</Text>
                </Pressable>
              ))}
            </View>
            {filteredRows.map((row, index) => (
              <View
                key={row.teamId}
                style={[styles.dataRow, index % 2 === 0 && styles.rowAlt]}
              >
                <Text style={[styles.cell, styles.teamCell]}>{row.label}</Text>
                {columns.map((column, colIndex) => (
                  <Text
                    key={column.key}
                    style={[
                      styles.cell,
                      styles.numericCell,
                      { width: column.width ?? STAT_COLUMN_WIDTH },
                      colIndex === columns.length - 1 && styles.lastCell,
                    ]}
                  >
                    {formatTeamStat(row.stats[column.key], column.precision)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      <OptionModal
        select={openSelect}
        onClose={() => setOpenSelect(null)}
        onSelect={(value) => {
          if (!openSelect) return;
          if (openSelect.type === 'year') {
            setSelectedYear(Number(value));
          } else if (openSelect.type === 'league') {
            setSelectedLeague(value === 'all' ? undefined : value);
          } else if (openSelect.type === 'sort') {
            setSortBy(value as keyof TeamStatsRow['stats']);
          }
          setOpenSelect(null);
        }}
      />
    </SafeAreaView>
  );
};

type ColumnDefinition = {
  key: keyof TeamStatsRow['stats'];
  label: string; // full label for dropdown
  short: string; // compact label for header/table
  precision?: number;
  width?: number;
};

const formatTeamStat = (value: number, precision?: number) => {
  const numeric = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  if (precision !== undefined) {
    return numeric.toFixed(precision);
  }
  return numeric.toString();
};

type SelectProps = {
  label: string;
  value: string;
  display: string;
  options: Array<{ value: string; label: string }>;
  onOpen: (options: Array<{ value: string; label: string }>) => void;
};

const Select = ({ label, display, onOpen, options }: SelectProps) => (
  <View style={styles.select}>
    <Text style={styles.selectLabel}>{label}</Text>
    <Pressable
      style={styles.selectControl}
      onPress={() => onOpen(options)}
    >
      <Text style={styles.selectValue}>{display}</Text>
      <Text style={styles.selectCaret}>▾</Text>
    </Pressable>
  </View>
);

const OptionModal = ({
  select,
  onClose,
  onSelect,
}: {
  select: { type: 'year' | 'league' | 'sort'; options: Array<{ value: string; label: string }> } | null;
  onClose: () => void;
  onSelect: (value: string) => void;
}) => (
  <Modal visible={!!select} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>Select {select?.type}</Text>
        <ScrollView style={{ maxHeight: 320 }}>
          {select?.options.map((option) => (
            <Pressable
              key={option.value}
              style={styles.optionRow}
              onPress={() => onSelect(option.value)}
            >
              <Text style={styles.optionLabel}>{option.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#020617',
  },
  container: {
    padding: 16,
    gap: 16,
  },
  scrollContent: {
    paddingBottom: 120,
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
  select: {
    gap: 6,
  },
  selectLabel: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  selectControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectValue: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  selectCaret: {
    color: '#64748B',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#0B1220',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'capitalize',
  },
  optionRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  optionLabel: {
    color: '#E2E8F0',
    fontWeight: '600',
  },
  tableScroll: {
    marginTop: 12,
  },
  tableContent: {
    flexGrow: 1,
    alignItems: 'flex-start',
  },
  table: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0B1220',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  dataRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#111827',
  },
  rowAlt: {
    backgroundColor: '#0D1527',
  },
  cell: {
    minWidth: 60,
    height: 48,
    paddingVertical: 12,
    paddingHorizontal: 10,
    color: '#E2E8F0',
    fontSize: 12,
    borderRightWidth: 1,
    borderRightColor: '#1F2937',
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
    flexGrow: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numericCell: {
    textAlign: 'right',
    paddingRight: 12,
    paddingLeft: 10,
  },
  lastCell: {
    borderRightWidth: 0,
  },
  teamCell: {
    width: 160,
    height: 48,
    paddingLeft: 14,
    paddingRight: 10,
    textAlign: 'left',
    fontWeight: '600',
    borderRightWidth: 0,
  },
  activeHeader: {
    backgroundColor: '#172554',
  },
  headerLabel: {
    color: '#CBD5E1',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
