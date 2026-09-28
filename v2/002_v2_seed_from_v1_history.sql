-- FOOTBALL V2
-- Migration 002: seed V2 master data from V1.23.3 history tables.
-- ADDITIVE ONLY. DOES NOT UPDATE OR DELETE V1 TABLES.
-- Safe to re-run: INSERT OR IGNORE preserves newer V2 rows.

PRAGMA defer_foreign_keys = ON;

-- 1) Leagues from fixture_history.
INSERT OR IGNORE INTO v2_leagues
(league_id, name, country, league_type, active, source, updated_at_utc)
SELECT
  league_id,
  COALESCE(MAX(NULLIF(league,'')), 'League ' || league_id),
  MAX(NULLIF(country,'')),
  NULL,
  1,
  'V1_HISTORY_BACKFILL',
  CURRENT_TIMESTAMP
FROM fixture_history
WHERE league_id IS NOT NULL
GROUP BY league_id;

-- 2) Seasons. Only rows with a usable league + season.
INSERT OR IGNORE INTO v2_seasons
(league_id, season_year, start_date, end_date, current, coverage_json, updated_at_utc)
SELECT DISTINCT
  league_id,
  season,
  NULL,
  NULL,
  0,
  NULL,
  CURRENT_TIMESTAMP
FROM fixture_history
WHERE league_id IS NOT NULL
  AND season IS NOT NULL;

-- 3) Teams. V1 logo is deliberately not copied into public V2 master data.
INSERT OR IGNORE INTO v2_teams
(team_id, name, code, country, founded, national, source, updated_at_utc)
SELECT
  team_id,
  name,
  NULL,
  country,
  NULL,
  NULL,
  'V1_HISTORY_BACKFILL',
  CURRENT_TIMESTAMP
FROM teams
WHERE team_id IS NOT NULL
  AND name IS NOT NULL
  AND TRIM(name) <> '';

-- 4) Fixtures.
-- V1 fixture_history.kickoff = API-Football fixture.timestamp (Unix seconds).
-- V1 first_seen_at/last_seen_at = Date.now() (Unix milliseconds).
-- Rows missing required relational keys remain in V1 and are intentionally skipped.
INSERT OR IGNORE INTO v2_fixtures
(
  fixture_id,
  league_id,
  season_year,
  home_team_id,
  away_team_id,
  kickoff_ts,
  kickoff_utc,
  round_name,
  timezone,
  venue_name,
  venue_city,
  referee,
  status_short,
  status_long,
  elapsed,
  extra_minute,
  score_home,
  score_away,
  ht_home,
  ht_away,
  ft_home,
  ft_away,
  last_source_update_ms,
  last_ingested_at_ms,
  source_hash,
  fixture_payload_json,
  created_at_utc,
  updated_at_utc
)
SELECT
  h.fixture_id,
  h.league_id,
  h.season,
  h.home_team_id,
  h.away_team_id,
  h.kickoff,
  datetime(h.kickoff, 'unixepoch'),
  h.round,
  'UTC',
  NULL,
  NULL,
  NULL,
  h.status,
  h.status_long,
  h.minute,
  NULL,
  h.score_home,
  h.score_away,
  h.halftime_home,
  h.halftime_away,
  h.fulltime_home,
  h.fulltime_away,
  h.last_seen_at,
  h.last_seen_at,
  NULL,
  h.payload_json,
  datetime(COALESCE(h.first_seen_at,h.last_seen_at)/1000, 'unixepoch'),
  datetime(h.last_seen_at/1000, 'unixepoch')
FROM fixture_history h
JOIN v2_leagues l
  ON l.league_id = h.league_id
JOIN v2_seasons s
  ON s.league_id = h.league_id
 AND s.season_year = h.season
JOIN v2_teams th
  ON th.team_id = h.home_team_id
JOIN v2_teams ta
  ON ta.team_id = h.away_team_id
WHERE h.fixture_id IS NOT NULL
  AND h.league_id IS NOT NULL
  AND h.season IS NOT NULL
  AND h.home_team_id IS NOT NULL
  AND h.away_team_id IS NOT NULL
  AND h.home_team_id <> h.away_team_id
  AND h.kickoff IS NOT NULL;

PRAGMA defer_foreign_keys = OFF;

-- AUDIT QUERIES (run after migration)
-- SELECT COUNT(*) AS v1_teams FROM teams;
-- SELECT COUNT(*) AS v2_teams FROM v2_teams;
-- SELECT COUNT(*) AS v1_fixtures FROM fixture_history;
-- SELECT COUNT(*) AS v2_fixtures FROM v2_fixtures;
-- SELECT COUNT(*) AS skipped_missing_keys
-- FROM fixture_history
-- WHERE league_id IS NULL OR season IS NULL OR home_team_id IS NULL
--    OR away_team_id IS NULL OR kickoff IS NULL OR home_team_id=away_team_id;
