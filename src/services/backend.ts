import { supabase } from './supabase';
import { GameEvent, LiveGameState, PlayerIdentity } from '@/types';

const slugify = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
const isUuid = (value?: string) =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const normalizeName = (value?: string) => (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

export const fetchLeagues = async () => {
  const { data, error } = await supabase
    .from('leagues')
    .select('id, name, year')
    .order('year', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const createLeague = async (name: string, year: number) => {
  const { data, error } = await supabase
    .from('leagues')
    .insert({ name, year })
    .select('id, name, year')
    .single();
  if (error) throw error;
  return data;
};

export const fetchTeamsForLeague = async (leagueId: string) => {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, slug, league_id')
    .eq('league_id', leagueId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
};

export const fetchAllTeams = async () => {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, league_id');
  if (error) throw error;
  return data ?? [];
};

export const upsertTeam = async (name: string, leagueId?: string) => {
  const slug = slugify(name || 'team');
  const payload: Record<string, any> = {
    name: name || 'Team',
    slug,
  };
  if (leagueId) payload.league_id = leagueId;

  const { data, error } = await supabase
    .from('teams')
    .upsert(payload, { onConflict: 'league_id,slug' })
    .select('id, name, slug, league_id')
    .single();
  if (error) throw error;
  return data;
};

export const fetchBrothers = async () => {
  const { data, error } = await supabase
    .from('brothers')
    .select('id, first_name, last_name, display_name')
    .order('last_name', { ascending: true });
  if (error) throw error;
  return data ?? [];
};

export const fetchPlayers = async () => {
  const { data, error } = await supabase
    .from('players')
    .select('id, is_guest, guest_name, brother_id, brothers:brother_id(display_name)');
  if (error) throw error;
  return data ?? [];
};

export const createBrother = async (firstName: string, lastName: string) => {
  const { data, error } = await supabase
    .from('brothers')
    .insert({ first_name: firstName, last_name: lastName, display_name: `${firstName} ${lastName}` })
    .select('id, first_name, last_name, display_name')
    .single();
  if (error) throw error;
  return data;
};

/**
 * Paginate through ALL rows of a Supabase table, bypassing the server-side
 * PGRST_MAX_ROWS limit (default 1000) which `.limit()` alone cannot override.
 */
const fetchAllRows = async <T = any>(
  table: string,
  select: string,
  pageSize = 1000,
): Promise<T[]> => {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break; // last page
    from += pageSize;
  }
  return all;
};

export const fetchGamesWithEvents = async () => {
  const [games, events, gamePlayers] = await Promise.all([
    fetchAllRows(
      'games',
      'id, type, league_id, home_team_id, away_team_id, planned_innings, start_time, completed_at, final_score_home, final_score_away, notes',
    ),
    fetchAllRows(
      'game_events',
      'id, game_id, event_type, batter_id, defender_id, runner_id, inning, half, base_state_before, base_state_after, runs_scored, rbi, timestamp, notes',
    ),
    fetchAllRows(
      'game_players',
      'id, game_id, team_id, player_id, batting_order, is_active, players(id, is_guest, guest_name, brother_id, brothers:brother_id(display_name))',
    ),
  ]);
  return { games, events, gamePlayers };
};

export const persistGameToSupabase = async (live: LiveGameState, events: GameEvent[]) => {
  try {
    const { data: existingBrothers } = await supabase
      .from('brothers')
      .select('id, first_name, last_name, display_name');

    const brotherLookup = new Map<string, string>();
    const existingBrotherIds = new Set<string>();
    existingBrothers?.forEach((row) => {
      if (row.id) existingBrotherIds.add(row.id);
      const normDisplay = normalizeName(row.display_name);
      const normFull = normalizeName(`${row.first_name ?? ''} ${row.last_name ?? ''}`);
      if (normDisplay) brotherLookup.set(normDisplay, row.id);
      if (normFull) brotherLookup.set(normFull, row.id);
    });

    const allIdentities: PlayerIdentity[] = Object.values(live.lineups).flatMap((lineup) =>
      lineup.lineup.map((slot) => slot.identity),
    );

    const playerIdMap = new Map<string, string>();

    const brotherRows: Array<{ id: string; first_name: string; last_name: string; display_name: string }> = [];
    const seenBrothers = new Set<string>();

    const playerRows = allIdentities.map((identity) => {
      const remoteId = isUuid(identity.id) ? identity.id : uuid();
      playerIdMap.set(identity.id, remoteId);

      if (identity.isGuest) {
        return {
          id: remoteId,
          guest_name: identity.displayName,
          is_guest: true,
        };
      }

      let brotherId = identity.brotherId;
      const displayName = identity.displayName ?? 'Brother Unknown';
      const [first, ...rest] = displayName.split(' ');
      const last = rest.join(' ') || 'Brother';
      const normKey = normalizeName(displayName) || normalizeName(`${first} ${last}`);

      if (!isUuid(brotherId) || (isUuid(brotherId) && !existingBrotherIds.has(brotherId))) {
        const found = normKey ? brotherLookup.get(normKey) : undefined;
        brotherId = found ?? brotherId;
      }

      if (!isUuid(brotherId)) {
        brotherId = uuid();
      }

      if (!seenBrothers.has(brotherId)) {
        seenBrothers.add(brotherId);
        brotherLookup.set(normKey, brotherId);
        brotherRows.push({
          id: brotherId,
          first_name: first || 'Brother',
          last_name: last || 'Brother',
          display_name: displayName,
        });
      }

      return {
        id: remoteId,
        brother_id: brotherId,
        is_guest: false,
      };
    });

    if (brotherRows.length) {
      const { error: brotherError } = await supabase.from('brothers').upsert(brotherRows, { onConflict: 'id' });
      if (brotherError) throw brotherError;
    }

    if (playerRows.length) {
      const { error: playerError } = await supabase
        .from('players')
        .upsert(playerRows, { onConflict: 'id' });
      if (playerError) throw playerError;
    }

    const teamIds = live.teamOrder.length ? live.teamOrder : Object.keys(live.teamLabels);
    const ensureTeamUuid = (id: string) => (isUuid(id) ? id : uuid());
    const originalHomeId = teamIds[0];
    const originalAwayId = teamIds[1] ?? teamIds[0];
    const homeTeamId = ensureTeamUuid(originalHomeId);
    const awayTeamId = ensureTeamUuid(originalAwayId);

    const teamLabelMap = new Map<string, string>();
    teamLabelMap.set(homeTeamId, live.teamLabels[originalHomeId] ?? 'Home Team');
    teamLabelMap.set(awayTeamId, live.teamLabels[originalAwayId] ?? 'Away Team');

    const teamRows = [
      {
        id: homeTeamId,
        name: teamLabelMap.get(homeTeamId) ?? 'Home Team',
        slug: slugify(teamLabelMap.get(homeTeamId) ?? 'home-team'),
        league_id: live.leagueId ?? null,
      },
      {
        id: awayTeamId,
        name: teamLabelMap.get(awayTeamId) ?? 'Away Team',
        slug: slugify(teamLabelMap.get(awayTeamId) ?? 'away-team'),
        league_id: live.leagueId ?? null,
      },
    ];

    const { error: teamError } = await supabase.from('teams').upsert(teamRows, { onConflict: 'id' });
    if (teamError) throw teamError;

    const { data: gameRow, error: gameError } = await supabase
      .from('games')
      .insert({
        type: live.type,
        league_id: live.leagueId ?? null,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        planned_innings: live.plannedInnings,
        start_time: new Date().toISOString(),
        final_score_home: live.scoreboard[homeTeamId]?.runs ?? 0,
        final_score_away: live.scoreboard[awayTeamId]?.runs ?? 0,
      })
      .select('id')
      .single();
    if (gameError) throw gameError;

    const lineupRows = Object.values(live.lineups)
      .flatMap((lineup) =>
        lineup.lineup.map((slot) => {
          const remotePlayerId = playerIdMap.get(slot.playerId);
          if (!remotePlayerId) return null;
          const remoteTeamId = isUuid(lineup.teamId)
            ? lineup.teamId
            : lineup.teamId === originalAwayId
            ? awayTeamId
            : homeTeamId;
          return {
            game_id: gameRow.id,
            team_id: remoteTeamId,
            player_id: remotePlayerId,
            batting_order: slot.battingOrder,
            is_active: true,
          };
        }),
      )
      .filter(Boolean) as Array<Record<string, any>>;

    if (lineupRows.length) {
      const { error } = await supabase.from('game_players').insert(lineupRows);
      if (error) throw error;
    }

    if (events.length) {
      const eventRows = events.map((event) => ({
        game_id: gameRow.id,
        event_type: event.eventType,
        batter_id: event.batterId ? playerIdMap.get(event.batterId) ?? null : null,
        defender_id: event.defenderId ? playerIdMap.get(event.defenderId) ?? null : null,
        runner_id: event.runnerId ? playerIdMap.get(event.runnerId) ?? null : null,
        inning: event.inning,
        half: event.half,
        base_state_before: event.baseStateBefore,
        base_state_after: event.baseStateAfter,
        runs_scored: event.runsScored,
        rbi: event.rbi,
        timestamp: event.timestamp,
        notes: event.notes ?? null,
      }));
      const { error } = await supabase.from('game_events').insert(eventRows);
      if (error) throw error;
    }
  } catch (error) {
    console.error('Failed to persist game to Supabase', error);
  }
};
