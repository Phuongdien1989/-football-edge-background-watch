PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS fe_schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO fe_schema_meta (key,value,updated_at)
VALUES ('schema_version','V1.23.1',unixepoch()*1000)
ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;

CREATE TABLE IF NOT EXISTS fixtures (
  fixture_id INTEGER PRIMARY KEY,
  league TEXT,
  home TEXT,
  away TEXT,
  kickoff INTEGER,
  status TEXT,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fixtures_last_seen ON fixtures(last_seen_at DESC);

CREATE TABLE IF NOT EXISTS entry_decisions (
  id TEXT PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  engine TEXT NOT NULL,
  policy_status TEXT,
  policy_reason TEXT,
  captured_at INTEGER NOT NULL,
  minute INTEGER,
  score_home INTEGER,
  score_away INTEGER,
  market_type TEXT,
  selection TEXT,
  line REAL,
  price REAL,
  odds_format TEXT,
  price_zone TEXT,
  behavior_state TEXT,
  signal_state TEXT,
  data_level TEXT,
  market_level TEXT,
  edge_level TEXT,
  model_prob REAL,
  break_even REAL,
  market_prob REAL,
  edge REAL,
  model_ev REAL,
  candidate_supported INTEGER NOT NULL DEFAULT 0,
  auto_settle_supported INTEGER NOT NULL DEFAULT 0,
  resolution TEXT,
  outcome TEXT,
  unit_pl REAL,
  resolved_at INTEGER,
  payload_json TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (fixture_id) REFERENCES fixtures(fixture_id)
);
CREATE INDEX IF NOT EXISTS idx_entry_fixture_time ON entry_decisions(fixture_id,captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_policy_time ON entry_decisions(policy_status,captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_engine_time ON entry_decisions(engine,captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_price_zone ON entry_decisions(price_zone,captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_behavior ON entry_decisions(behavior_state,captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_resolution ON entry_decisions(resolution,resolved_at DESC);

CREATE TABLE IF NOT EXISTS entry_outcomes (
  decision_id TEXT PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  engine TEXT,
  outcome TEXT,
  unit_pl REAL,
  final_score_home INTEGER,
  final_score_away INTEGER,
  resolved_at INTEGER NOT NULL,
  payload_json TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (decision_id) REFERENCES entry_decisions(id) ON DELETE CASCADE,
  FOREIGN KEY (fixture_id) REFERENCES fixtures(fixture_id)
);
CREATE INDEX IF NOT EXISTS idx_entry_outcomes_fixture ON entry_outcomes(fixture_id,resolved_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_outcomes_engine ON entry_outcomes(engine,resolved_at DESC);

-- Reserved future tables. V1.23.0 does not write these yet.
CREATE TABLE IF NOT EXISTS engine_signals (
  id TEXT PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  engine TEXT NOT NULL,
  captured_at INTEGER NOT NULL,
  minute INTEGER,
  state TEXT,
  score REAL,
  dq REAL,
  payload_json TEXT,
  FOREIGN KEY (fixture_id) REFERENCES fixtures(fixture_id)
);
CREATE INDEX IF NOT EXISTS idx_engine_signals_fixture ON engine_signals(fixture_id,engine,captured_at DESC);

CREATE TABLE IF NOT EXISTS market_snapshots (
  id TEXT PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  captured_at INTEGER NOT NULL,
  market_type TEXT,
  selection TEXT,
  line REAL,
  price REAL,
  source TEXT,
  payload_json TEXT,
  FOREIGN KEY (fixture_id) REFERENCES fixtures(fixture_id)
);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_fixture ON market_snapshots(fixture_id,captured_at DESC);

CREATE TABLE IF NOT EXISTS qsig_results (
  id TEXT PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  engine TEXT,
  signal_at INTEGER,
  resolved_at INTEGER,
  outcome TEXT,
  payload_json TEXT,
  FOREIGN KEY (fixture_id) REFERENCES fixtures(fixture_id)
);
CREATE INDEX IF NOT EXISTS idx_qsig_fixture ON qsig_results(fixture_id,signal_at DESC);

CREATE TABLE IF NOT EXISTS validation_results (
  id TEXT PRIMARY KEY,
  fixture_id INTEGER,
  validation_type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  result_key TEXT,
  payload_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_validation_type_time ON validation_results(validation_type,created_at DESC);


-- V1.23.1 Smart Live Snapshot Persistence
CREATE TABLE IF NOT EXISTS live_snapshots (
  id TEXT PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  engine TEXT,
  snapshot_kind TEXT,
  persistence_reason TEXT,
  captured_at INTEGER NOT NULL,
  minute INTEGER,
  status TEXT,
  score_home INTEGER,
  score_away INTEGER,
  top_rank INTEGER,
  signal_state TEXT,
  signal_score REAL,
  dq REAL,
  policy_status TEXT,
  behavior_state TEXT,
  market_type TEXT,
  selection TEXT,
  line REAL,
  price REAL,
  fingerprint TEXT,
  payload_json TEXT,
  FOREIGN KEY (fixture_id) REFERENCES fixtures(fixture_id)
);
CREATE INDEX IF NOT EXISTS idx_live_snapshots_fixture_time ON live_snapshots(fixture_id,captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_snapshots_engine_time ON live_snapshots(engine,captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_snapshots_reason_time ON live_snapshots(persistence_reason,captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_snapshots_policy_time ON live_snapshots(policy_status,captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_snapshots_top_time ON live_snapshots(top_rank,captured_at DESC);
