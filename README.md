# DUBBL Mobile App (Expo)

This project translates the Delta Upsilon Pong Baseball League (DUBBL) product brief into an Expo + React Native implementation focused on live gameplay tracking, stat aggregation, and Supabase-ready data modeling.

## What's included

- **Expo + React Native TypeScript app** wired with React Navigation (stack, tabs, and top tabs) plus Zustand for local game state.
- **Live Game flow** covering setup, live scoring controls (hits, strikes, steals, errors, outs), base-state tracking, and an auto-generated summary screen.
- **Stats Center** populated by the supplied requirements: sortable individual leaderboards, team dashboards (year/league filters), and a historical game log.
- **Supabase schema + client** stubs aligned with the documented tables to speed up backend wiring.
- **Utility layer** for baseball-specific logic (base advancement, steals) and stats aggregation used by both live game summaries and historical leaderboards.

## Install on your device (Expo Go)

1) Install Expo Go from the App Store/Play Store.
2) Open this link in Expo Go (or scan the QR from the Expo update page):
   - https://expo.dev/accounts/parthivfarazi/projects/pong-baseball-league/updates/5ce55842-5341-4613-b0a2-080a9f0917bb
3) The app loads over the air; no App Store/TestFlight required. Supabase is already wired.

Future updates will be delivered automatically over the same link.

## Local development

Clone the repo, then:

```bash
cd DUBBLApp
npm install
npm run start   # then choose iOS / Android / Web
```

The project expects the Expo CLI (bundled via `create-expo-app`). All dependencies are vendored in `package-lock.json`.

### Environment variables

Create an `.env` or export these before running:

```
EXPO_PUBLIC_SUPABASE_URL=https://jjlkqilpjdjslxunmbup.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqbGtxaWxwamRqc2x4dW5tYnVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMjczODAsImV4cCI6MjA3ODcwMzM4MH0.L6LpGdJxa9cNjHSTxZuoRDZcpa7Ir07wsAfTMo3835I
```

`src/services/supabase.ts` will warn (and return `null`) until both values are set.

## Project structure

```
DUBBLApp/
├─ App.tsx                 # Navigation root + auth gate
├─ src/
│  ├─ components/          # (room for future shared UI)
│  ├─ data/sampleData.ts   # Bros, teams, events per the docs
│  ├─ navigation/          # Bottom tabs, stacks, and stats tabs
│  ├─ screens/             # Welcome, Live game flow, Stats, Timeline
│  ├─ services/supabase.ts # Supabase client factory
│  ├─ store/
│  │  ├─ gameStore.ts      # Zustand live game + event logger
│  │  └─ sessionStore.ts   # Lightweight role selection
│  ├─ types/index.ts       # Shared domain models from the brief
│  └─ utils/
│     ├─ baseball.ts       # Base paths, steals, inning transitions
│     └─ stats.ts          # Event → stat aggregation helpers
└─ supabase/schema.sql     # SQL definition for all required tables
```

## Live game experience

- **Setup**: friendly vs league mode selector, lineup preview, innings picker. League rosters will be hydrated from Supabase once available; the friendly flow uses curated sample players and is fully functional today.
- **Live scoring**: scoreboard with runs/hits/errors, inning indicator, strike/out dots, base diamond, and action grid (1B/2B/3B/HR, strike, error, caught out, steal win/loss, end game). Every action records a `game_event` shaped exactly as defined in the doc.
- **Summary**: final score, inning-by-inning breakdown, highlighted batter lines built via the same stat utilities powering the Stat Center.

## Stat Center

- **Individual tab**: sortable columns (SLG/AVG/H/HR/RBI) scoped across `overall`, `year`, or `league`. Filters hydrate from `sampleData`.
- **Team tab**: aggregates SLG, AVG, HR, average runs, games played and misc metrics with the same scope controls.
- **History tab**: chronological log of friendly + league games, ready to deep-link into Supabase-powered box scores.

All stats derive from a single event log through `utils/stats.ts`, matching the Event → Stat matrix outlined in the documentation.

## Supabase schema

`supabase/schema.sql` mirrors the required tables:

- `brothers`, `leagues`, `league_teams`, `league_team_members`
- `games`, `game_players`, `game_events`

Each table includes relationships, enum checks, and sensible defaults so you can paste directly into the Supabase SQL editor or migrate with your tool of choice.

## Next steps

1. **Roster selection UI** – replace the friendly lineup preview with a player picker + drag/drop ordering (use `react-native-draggable-flatlist` or `@expo/react-native-action-sheet` for quick wins).
2. **Supabase sync** – hydrate leagues/teams/lineups from Supabase using RLS policies tied to DU accounts and persist live events in realtime.
3. **Role-aware auth** – swap the lightweight session store for Supabase Auth (Magic Links) so DU Brothers unlock the Stat Center while guests stay sandboxed.
4. **Advanced scorer tools** – defender picker modal, steal flip-cup timers, and penalty confirmations per the rules doc.
5. **Testing & QA** – add Jest + React Native Testing Library suites for reducers/logic plus Detox smoke tests for the Live Game and Stats stacks.

With those pieces in place the app will fully satisfy the "Live Game + Stat Center" requirements while remaining OTA-update ready via Expo EAS.
