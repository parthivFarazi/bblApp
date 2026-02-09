import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  availableYears,
} from '@/data/sampleData';
import { useStatsStore } from '@/store/statsStore';
import { useLeagueStore } from '@/store/leagueStore';
import { buildIndividualLeaderboard } from '@/utils/stats';
import { Game, GameEvent, IndividualStatsRow, PlayerIdentity, StatScope } from '@/types';
import { fetchAllTeams, fetchGamesWithEvents, fetchLeagues, fetchPlayers } from '@/services/backend';

const STAT_COLUMN_WIDTH = 70; // Uniform width for all stat columns

const leaderboardColumns: Array<{
  key: keyof IndividualStatsRow['stats'];
  label: string; // full label for dropdown
  short: string; // compact header
  precision?: number;
  width: number;
}> = [
  { key: 'gamesPlayed', label: 'Games Played', short: 'GP', width: STAT_COLUMN_WIDTH },
  { key: 'atBats', label: 'At Bats', short: 'AB', width: STAT_COLUMN_WIDTH },
  { key: 'hits', label: 'Hits', short: 'H', width: STAT_COLUMN_WIDTH },
  { key: 'singles', label: 'Singles', short: '1B', width: STAT_COLUMN_WIDTH },
  { key: 'doubles', label: 'Doubles', short: '2B', width: STAT_COLUMN_WIDTH },
  { key: 'triples', label: 'Triples', short: '3B', width: STAT_COLUMN_WIDTH },
  { key: 'homeruns', label: 'Homeruns', short: 'HR', width: STAT_COLUMN_WIDTH },
  { key: 'battingAverage', label: 'Batting Average', short: 'AVG', precision: 3, width: STAT_COLUMN_WIDTH },
  { key: 'slugging', label: 'Slugging', short: 'SLG', precision: 3, width: STAT_COLUMN_WIDTH },
  { key: 'rbi', label: 'Runs Batted In', short: 'RBI', width: STAT_COLUMN_WIDTH },
  { key: 'strikeouts', label: 'Strikeouts', short: 'K', width: STAT_COLUMN_WIDTH },
  { key: 'catches', label: 'Catches', short: 'C', width: STAT_COLUMN_WIDTH },
  { key: 'errors', label: 'Errors', short: 'E', width: STAT_COLUMN_WIDTH },
  { key: 'stealsAttempted', label: 'Steals Attempted', short: 'SA', width: STAT_COLUMN_WIDTH },
  { key: 'stealsWon', label: 'Steals Won', short: 'SW', width: STAT_COLUMN_WIDTH },
  { key: 'stealsLost', label: 'Steals Lost', short: 'SL', width: STAT_COLUMN_WIDTH },
  { key: 'basesStolen', label: 'Bases Stolen', short: 'BS', width: STAT_COLUMN_WIDTH },
  { key: 'basesDefended', label: 'Bases Defended', short: 'BD', width: STAT_COLUMN_WIDTH },
  { key: 'basesDefendedSuccessful', label: 'Bases Defended (Successful)', short: 'BD+', width: STAT_COLUMN_WIDTH },
];

const sortOptions: Array<keyof IndividualStatsRow['stats']> = leaderboardColumns.map(
  (col) => col.key,
);

export const IndividualStatsScreen = () => {
  const [scope, setScope] = useState<StatScope>('overall');
  const [selectedYear, setSelectedYear] = useState(availableYears[0] ?? new Date().getFullYear());
  const [selectedLeague, setSelectedLeague] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<keyof IndividualStatsRow['stats']>('slugging');
  const [openSelect, setOpenSelect] = useState<
    { type: 'year' | 'league' | 'sort'; options: Array<{ value: string; label: string }> } | null
  >(null);
  const hydrateStats = useStatsStore((state) => state.hydrate);
  const setLeagues = useLeagueStore((state) => state.setLeagues);

  // Use local state for fetched data so leaderboard computation doesn't
  // depend on the Zustand store hydration round-trip.
  const [mergedEvents, setMergedEvents] = useState<GameEvent[]>([]);
  const [mergedGames, setMergedGames] = useState<Game[]>([]);
  const [mergedPlayers, setMergedPlayers] = useState<PlayerIdentity[]>([]);
  const yearOptions = useMemo(() => {
    const set = new Set<number>(availableYears);
    mergedGames.forEach((game) => {
      set.add(new Date(game.startTime).getFullYear());
    });
    return Array.from(set).sort((a, b) => b - a);
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

  useEffect(() => {
    const loadRemote = async () => {
      try {
        const [{ games, events, gamePlayers }, teams, leagues, players] = await Promise.all([
          fetchGamesWithEvents(),
          fetchAllTeams(),
          fetchLeagues(),
          fetchPlayers(),
        ]);

        const playerById = new Map((players ?? []).map((player: any) => [player.id, player]));
        const playerDirectoryFromGames = (players ?? []).reduce<Record<string, any>>((acc, player: any) => {
          if (!player?.id) return acc;
          const displayName =
            player.guest_name ||
            player.brothers?.display_name ||
            player.id;
          acc[player.id] = {
            id: player.id,
            displayName,
            brotherId: player.brother_id ?? undefined,
            isGuest: player.is_guest ?? false,
            teamId: undefined,
          };
          return acc;
        }, {});

        gamePlayers.forEach((row) => {
          const player = (row as any).players ?? playerById.get((row as any).player_id);
          if (!player?.id) return;
          const displayName =
            player.guest_name ||
            player.brothers?.display_name ||
            player.id;
          const baseIdentity = {
            id: player.id,
            displayName,
            brotherId: player.brother_id ?? undefined,
            isGuest: player.is_guest ?? false,
            teamId: row.team_id,
          };
          playerDirectoryFromGames[player.id] = {
            ...(playerDirectoryFromGames[player.id] ?? {}),
            ...baseIdentity,
            teamId: row.team_id,
          };
          if ((row as any).id) {
            playerDirectoryFromGames[(row as any).id] = {
              ...playerDirectoryFromGames[player.id],
              teamId: row.team_id,
            };
          }
        });

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

        // Use remote data directly — pagination ensures all events are fetched.
        setMergedGames(mappedGames);
        setMergedEvents(mappedEvents);
        setMergedPlayers(Object.values(playerDirectoryFromGames));

        if (leagues?.length) {
          setLeagues(leagues.map((row) => ({ id: row.id, name: row.name, year: row.year })));
        }
      } catch (error) {
        console.error('Failed to load remote stats', error);
      }
    };
    loadRemote();
  }, [hydrateStats, setLeagues]);

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
          display={leaderboardColumns.find((col) => col.key === sortBy)?.label ?? String(sortBy)}
          options={sortOptions.map((option) => {
            const label = leaderboardColumns.find((col) => col.key === option)?.label ?? option;
            return { value: String(option), label };
          })}
          onOpen={(options) => setOpenSelect({ type: 'sort', options })}
        />

        <View style={styles.tableWrapper}>
          <View style={styles.fixedColumn}>
            <View style={[styles.tableHeader, styles.fixedHeader]}>
              <Text style={[styles.cell, styles.playerCell]}>Player</Text>
            </View>
            {leaderboard.map((row, index) => (
              <View
                key={row.playerId}
                style={[
                  styles.tableRow,
                  styles.fixedRow,
                  index % 2 === 0 && styles.rowAlt,
                ]}
              >
                <Text style={[styles.cell, styles.playerCell]}>{row.displayName}</Text>
              </View>
            ))}
          </View>
          <ScrollView
            horizontal
            style={styles.tableScroll}
            contentContainerStyle={styles.tableContent}
            showsHorizontalScrollIndicator={true}
          >
            <View style={styles.scrollableTable}>
              <View style={styles.tableHeader}>
                {leaderboardColumns.map((column, colIndex) => (
                <Pressable
                  key={column.key}
                  style={[
                    styles.cell,
                    styles.numericCell,
                    { width: column.width },
                    sortBy === column.key && styles.activeHeader,
                    colIndex === leaderboardColumns.length - 1 && styles.lastCell,
                  ]}
                  onPress={() => setSortBy(column.key)}
                >
                  <Text style={styles.headerLabel}>{column.short}</Text>
                </Pressable>
              ))}
              </View>
              {leaderboard.map((row, index) => (
                <View
                  key={row.playerId}
                  style={[styles.tableRow, index % 2 === 0 && styles.rowAlt]}
                >
                  {leaderboardColumns.map((column, colIndex) => (
                    <Text
                      key={column.key}
                      style={[
                        styles.cell,
                        styles.numericCell,
                        { width: column.width },
                        colIndex === leaderboardColumns.length - 1 && styles.lastCell,
                      ]}
                    >
                      {formatStatValue(row.stats[column.key], column.precision)}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

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
              setSortBy(value as keyof IndividualStatsRow['stats']);
            }
            setOpenSelect(null);
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const formatStatValue = (value: number | undefined, precision?: number) => {
  const numericValue = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  if (precision !== undefined) {
    return numericValue.toFixed(precision);
  }
  return numericValue.toString();
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
  tableWrapper: {
    flexDirection: 'row',
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0B1220',
    overflow: 'hidden',
  },
  fixedColumn: {
    backgroundColor: '#0B1220',
    borderRightWidth: 2,
    borderRightColor: '#1F2937',
    zIndex: 10,
  },
  fixedHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  fixedRow: {
    borderTopWidth: 1,
    borderTopColor: '#111827',
  },
  tableScroll: {
    flex: 1,
  },
  tableContent: {
    flexGrow: 1,
  },
  scrollableTable: {
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
    paddingLeft: 8,
  },
  lastCell: {
    borderRightWidth: 0,
  },
  playerCell: {
    width: 160,
    height: 48,
    paddingLeft: 14,
    paddingRight: 10,
    textAlign: 'left',
    fontWeight: '700',
    borderRightWidth: 0,
  },
  headerLabel: {
    color: '#CBD5E1',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  activeHeader: {
    backgroundColor: '#1E3A8A',
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
});
