import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';

import { StatsStackParamList } from '@/navigation/StatsNavigator';
import { PlayerStatsTable } from '@/components/PlayerStatsTable';
import { useStatsStore } from '@/store/statsStore';
import { sampleEvents, sampleGames, playerIdentities, leagueTeams } from '@/data/sampleData';
import { buildIndividualLeaderboard } from '@/utils/stats';
import { GameEvent, IndividualStatsRow, PlayerIdentity, ScoreboardState } from '@/types';
import { supabase } from '@/services/supabase';

type Props = NativeStackScreenProps<StatsStackParamList, 'HistoryDetail'>;

const HIT_TYPES = new Set(['single', 'double', 'triple', 'homerun']);

/** Reconstruct hits, errors, and per-inning runs from game events. */
const buildScoreboardFromEvents = (
  events: GameEvent[],
  awayId: string,
  homeId: string,
): ScoreboardState => {
  const sb: ScoreboardState = {
    [awayId]: { runs: 0, hits: 0, errors: 0, inningRuns: {} },
    [homeId]: { runs: 0, hits: 0, errors: 0, inningRuns: {} },
  };

  events.forEach((event) => {
    // In the DB, home_team_id is always the team that bats in the top half.
    const battingTeam = event.half === 'top' ? homeId : awayId;
    const defendingTeam = event.half === 'top' ? awayId : homeId;

    if (HIT_TYPES.has(event.eventType)) {
      sb[battingTeam].hits += 1;
    }

    if (event.eventType === 'error') {
      sb[defendingTeam].errors += 1;
    }

    if (event.runsScored > 0) {
      const prev = sb[battingTeam].inningRuns[event.inning] ?? 0;
      sb[battingTeam].inningRuns[event.inning] = prev + event.runsScored;
      sb[battingTeam].runs += event.runsScored;
    }
  });

  return sb;
};

const teamLookup = leagueTeams.reduce<Record<string, string>>((acc, team) => {
  acc[team.id] = team.name;
  return acc;
}, {});

export const GameHistoryDetailScreen = ({ route, navigation }: Props) => {
  const { gameId, source } = route.params;
  const [sortBy, setSortBy] = useState<keyof IndividualStatsRow['stats']>('slugging');
  const [remoteEvents, setRemoteEvents] = useState<GameEvent[]>([]);
  const [remotePlayers, setRemotePlayers] = useState<PlayerIdentity[]>([]);
  const recordedDetails = useStatsStore((state) => state.recordedDetails);
  const recordedGames = useStatsStore((state) => state.recordedGames);
  const recordedEvents = useStatsStore((state) => state.recordedEvents);
  const recordedPlayers = useStatsStore((state) => state.playerDirectory);
  const recordedTeamLabels = useStatsStore((state) => state.teamLabels);

  // Fetch events and players directly from Supabase for this game
  useEffect(() => {
    if (source !== 'recorded') return;
    // Skip if we already have in-memory detail with events
    if (recordedDetails[gameId]?.events?.length) return;

    const fetchRemote = async () => {
      try {
        const [{ data: events }, { data: gamePlayers }] = await Promise.all([
          supabase
            .from('game_events')
            .select('id, game_id, event_type, batter_id, defender_id, runner_id, inning, half, base_state_before, base_state_after, runs_scored, rbi, timestamp, notes')
            .eq('game_id', gameId),
          supabase
            .from('game_players')
            .select('id, game_id, team_id, player_id, players(id, is_guest, guest_name, brother_id, brothers:brother_id(display_name))')
            .eq('game_id', gameId),
        ]);

        if (events?.length) {
          setRemoteEvents(
            events.map((e: any) => ({
              id: e.id,
              gameId: e.game_id,
              eventType: e.event_type,
              batterId: e.batter_id ?? undefined,
              defenderId: e.defender_id ?? undefined,
              runnerId: e.runner_id ?? undefined,
              inning: e.inning,
              half: e.half,
              baseStateBefore: e.base_state_before,
              baseStateAfter: e.base_state_after,
              runsScored: e.runs_scored ?? 0,
              rbi: e.rbi ?? 0,
              timestamp: e.timestamp ?? Date.now(),
              notes: e.notes ?? undefined,
            })),
          );
        }

        if (gamePlayers?.length) {
          const players: PlayerIdentity[] = [];
          gamePlayers.forEach((row: any) => {
            const player = row.players;
            if (!player?.id) return;
            players.push({
              id: player.id,
              displayName:
                player.guest_name ||
                player.brothers?.display_name ||
                player.id,
              brotherId: player.brother_id ?? undefined,
              isGuest: player.is_guest ?? false,
              teamId: row.team_id,
            });
          });
          setRemotePlayers(players);
        }
      } catch (err) {
        console.error('Failed to fetch game detail from Supabase', err);
      }
    };
    fetchRemote();
  }, [gameId, source, recordedDetails]);

  const detail = useMemo(() => {
    if (source === 'recorded') {
      if (recordedDetails[gameId]) {
        return recordedDetails[gameId];
      }
      const game = recordedGames.find((g) => g.id === gameId);
      if (!game) return undefined;
      const awayId = game.awayTeamId;
      const homeId = game.homeTeamId;
      const teamLabels = {
        [awayId]: recordedTeamLabels[awayId] ?? 'Visitors',
        [homeId]: recordedTeamLabels[homeId] ?? 'Home',
      };
      // Use local events first, fall back to directly-fetched remote events
      const localEvents = recordedEvents.filter((e) => e.gameId === gameId);
      const events = localEvents.length > 0 ? localEvents : remoteEvents;
      const scoreboard = buildScoreboardFromEvents(events, awayId, homeId);
      // Prefer stored final scores when available
      if (game.finalScore) {
        scoreboard[awayId].runs = game.finalScore.away;
        scoreboard[homeId].runs = game.finalScore.home;
      }
      // Use local players first, fall back to directly-fetched remote players
      const localPlayers = Object.values(recordedPlayers);
      const players = localPlayers.length > 0 ? localPlayers : remotePlayers;
      return {
        id: game.id,
        game,
        teamLabels,
        scoreboard,
        events,
        players,
        recordedAt: game.startTime,
        teamOrder: [awayId, homeId],
      };
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
      scoreboard: (() => {
        const evts = sampleEvents.filter((event) => event.gameId === sampleGame.id);
        const sb = buildScoreboardFromEvents(evts, sampleGame.awayTeamId, sampleGame.homeTeamId);
        if (sampleGame.finalScore) {
          sb[sampleGame.awayTeamId].runs = sampleGame.finalScore.away;
          sb[sampleGame.homeTeamId].runs = sampleGame.finalScore.home;
        }
        return sb;
      })(),
      events: sampleEvents.filter((event) => event.gameId === sampleGame.id),
      players: playerIdentities,
      recordedAt: sampleGame.startTime,
      teamOrder: [sampleGame.awayTeamId, sampleGame.homeTeamId],
    };
  }, [gameId, source, recordedDetails, recordedGames, recordedEvents, recordedPlayers, recordedTeamLabels, remoteEvents, remotePlayers]);

  const leaderboard = useMemo(() => {
    if (!detail) return [];
    return buildIndividualLeaderboard({
      events: detail.events,
      games: [detail.game],
      players: detail.players,
      scope: 'overall',
      sortBy,
    });
  }, [detail, sortBy]);

  const innings = useMemo(() => {
    if (!detail) return [];
    const inningSet = new Set<number>();
    detail.teamOrder.forEach((teamId) => {
      const runs = detail.scoreboard[teamId]?.inningRuns ?? {};
      Object.keys(runs).forEach((inning) => inningSet.add(Number(inning)));
    });
    const maxInning = Math.max(
      1,
      detail.game.plannedInnings ?? 0,
      ...Array.from(inningSet),
    );
    return Array.from({ length: maxInning }, (_, index) => index + 1);
  }, [detail]);

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

  const { game, teamLabels, scoreboard, teamOrder } = detail;

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
        <ScrollView
          horizontal
          style={styles.tableScroll}
          contentContainerStyle={styles.tableContent}
          showsHorizontalScrollIndicator={false}
        >
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.teamCell]}>Team</Text>
              {innings.map((inning) => (
                <Text key={inning} style={[styles.cell, styles.numericCell]}>
                  {inning}
                </Text>
              ))}
              <Text style={[styles.cell, styles.numericCell]}>R</Text>
            </View>
            {teamOrder.map((teamId, index) => (
              <View
                key={teamId}
                style={[styles.tableRow, index % 2 === 0 && styles.rowAlt]}
              >
                <Text style={[styles.cell, styles.teamCell]}>{getTeamName(teamId, index)}</Text>
                {innings.map((inning) => (
                  <Text key={inning} style={[styles.cell, styles.numericCell]}>
                    {scoreboard[teamId]?.inningRuns?.[inning] ?? 0}
                  </Text>
                ))}
                <Text style={[styles.cell, styles.numericCell]}>{scoreboard[teamId]?.runs ?? 0}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.sectionTitle}>Player Stats</Text>
        {leaderboard.length ? (
          <PlayerStatsTable rows={leaderboard} sortBy={sortBy} onSort={setSortBy} />
        ) : (
          <Text style={styles.emptyCopy}>No player stats recorded for this game.</Text>
        )}
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
    backgroundColor: '#0B1220',
    overflow: 'hidden',
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
    width: 60,
    paddingVertical: 12,
    paddingHorizontal: 8,
    color: '#E2E8F0',
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
  teamCell: {
    width: 140,
    paddingLeft: 14,
    paddingRight: 8,
    textAlign: 'left',
    fontWeight: '600',
  },
  tableScroll: {
    marginTop: 8,
  },
  tableContent: {
    flexGrow: 1,
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
