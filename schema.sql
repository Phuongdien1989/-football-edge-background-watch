-- Football Edge V2 raw evidence capture v0.3
-- Separate/additive database. Never writes legacy production tables.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS raw_api_requests (
  request_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  api_version TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  params_json TEXT NOT NULL,
  request_started_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  http_status INTEGER NOT NULL,
  source TEXT NOT NULL,
  capture_schema_version TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  daily_limit INTEGER,
  daily_remaining INTEGER,
  minute_limit INTEGER,
  minute_remaining INTEGER,
  api_results INTEGER,
  api_errors_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_raw_api_requests_received ON raw_api_requests(received_at);

CREATE TABLE IF NOT EXISTS raw_fixture_captures (
  capture_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  fixture_id INTEGER NOT NULL,
  match_clock INTEGER,
  status_short TEXT,
  received_at TEXT NOT NULL,
  fixture_payload_hash TEXT NOT NULL,
  fixture_json TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  stats_team_count INTEGER NOT NULL DEFAULT 0,
  stats_value_count INTEGER NOT NULL DEFAULT 0,
  has_events INTEGER NOT NULL DEFAULT 0,
  has_stats INTEGER NOT NULL DEFAULT 0,
  has_lineups INTEGER NOT NULL DEFAULT 0,
  has_players INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(request_id) REFERENCES raw_api_requests(request_id)
);
CREATE INDEX IF NOT EXISTS idx_raw_fixture_capture_fx_time ON raw_fixture_captures(fixture_id, received_at);
CREATE INDEX IF NOT EXISTS idx_raw_fixture_capture_received ON raw_fixture_captures(received_at);

CREATE TABLE IF NOT EXISTS capture_cycles (
  cycle_id TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  live_count INTEGER NOT NULL DEFAULT 0,
  detail_requests INTEGER NOT NULL DEFAULT 0,
  total_requests INTEGER NOT NULL DEFAULT 0,
  detail_fixture_count INTEGER NOT NULL DEFAULT 0,
  fixtures_with_stats INTEGER NOT NULL DEFAULT 0,
  fixtures_with_events INTEGER NOT NULL DEFAULT 0,
  daily_limit INTEGER,
  daily_remaining INTEGER,
  minute_limit INTEGER,
  minute_remaining INTEGER,
  stop_reason TEXT,
  error_message TEXT,
  worker_version TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_capture_cycles_started ON capture_cycles(started_at);

CREATE TABLE IF NOT EXISTS collector_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
