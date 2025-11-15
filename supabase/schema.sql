-- DUBBL Supabase schema excerpt based on the product brief.

create table if not exists public.brothers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  pledge_class text,
  du_nickname text,
  created_at timestamptz not null default now()
);

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season_year int not null,
  commissioner_id uuid references public.brothers (id),
  created_at timestamptz not null default now()
);

create table if not exists public.league_teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  name text not null,
  slug text not null,
  accent_color text,
  created_at timestamptz not null default now()
);

create table if not exists public.league_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.league_teams (id) on delete cascade,
  brother_id uuid not null references public.brothers (id),
  batting_order int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (team_id, brother_id)
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues (id),
  home_team_id uuid not null references public.league_teams (id),
  away_team_id uuid not null references public.league_teams (id),
  type text not null check (type in ('friendly', 'league')),
  planned_innings int not null default 7,
  start_time timestamptz not null,
  completed_at timestamptz,
  final_score_home int,
  final_score_away int,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  team_id uuid not null references public.league_teams (id),
  brother_id uuid references public.brothers (id),
  guest_name text,
  batting_order int not null,
  is_active boolean not null default true
);

create table if not exists public.game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  batter_id uuid not null references public.game_players (id),
  defender_id uuid references public.game_players (id),
  runner_id uuid references public.game_players (id),
  inning int not null,
  half text not null check (half in ('top', 'bottom')),
  event_type text not null check (
    event_type in (
      'single',
      'double',
      'triple',
      'homerun',
      'strike',
      'error',
      'strikeout',
      'caught_out',
      'steal_success',
      'steal_fail'
    )
  ),
  base_state_before jsonb not null,
  base_state_after jsonb not null,
  runs_scored int not null default 0,
  rbi int not null default 0,
  created_at timestamptz not null default now()
);
