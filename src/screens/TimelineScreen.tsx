import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { leagueTeams, sampleGames } from '@/data/sampleData';
import { useStatsStore } from '@/store/statsStore';
import { GameMode } from '@/types';
import { StatsStackParamList } from '@/navigation/StatsNavigator';
import { fetchAllTeams, fetchGamesWithEvents, fetchPlayers } from '@/services/backend';

const teamLookup = leagueTeams.reduce<Record<string, string>>((acc, team) => {
  acc[team.id] = team.name;
  return acc;
}, {});

export const TimelineScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<StatsStackParamList>>();
  const recordedDetails = useStatsStore((state) => state.recordedDetails);
  const recordedGames = useStatsStore((state) => state.recordedGames);
  const teamLabels = useStatsStore((state) => state.teamLabels);
  const hydrateStats = useStatsStore((state) => state.hydrate);

  useEffect(() => {
    const loadRemote = async () => {
      try {
        const [{ games, events, gamePlayers }, teams, players] = await Promise.all([
          fetchGamesWithEvents(),
          fetchAllTeams(),
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

        const teamLabelsRemote = teams.reduce<Record<string, string>>((acc, team) => {
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
          teamLabels: teamLabelsRemote,
        });
      } catch (error) {
        console.error('Failed to load remote history', error);
      }
    };
    loadRemote();
  }, [hydrateStats]);

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

  const fallbackRecordedEntries: TimelineEntry[] = recordedGames.map((game) => {
    const awayId = game.awayTeamId;
    const homeId = game.homeTeamId;
    return {
      id: game.id,
      source: 'recorded' as const,
      type: game.type,
      playedAt: game.startTime,
      awayName: teamLabels[awayId] ?? 'Visitors',
      homeName: teamLabels[homeId] ?? 'Home',
      awayScore: game.finalScore?.away ?? 0,
      homeScore: game.finalScore?.home ?? 0,
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

  const games = [...(recordedEntries.length ? recordedEntries : fallbackRecordedEntries), ...historicalEntries].sort(
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
                  {game.awayName} vs {game.homeName}
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
