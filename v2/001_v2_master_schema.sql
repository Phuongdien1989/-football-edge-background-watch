-- FOOTBALL V2 MASTER DATABASE
-- Migration: 001_v2_master_schema.sql
-- Spec: FOOTBALL V2 FOUNDATION v0.2
-- Strategy: additive / isolated namespace. DO NOT ALTER V1 TABLES.

PRAGMA defer_foreign_keys = ON;

CREATE TABLE IF NOT EXISTS v2_schema_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    schema_version TEXT NOT NULL,
    spec_version TEXT NOT NULL,
    applied_at_utc TEXT NOT NULL,
    notes TEXT
);

INSERT OR IGNORE INTO v2_schema_meta
(id, schema_version, spec_version, applied_at_utc, notes)
VALUES
(1, '2.0.0-foundation', '0.2', CURRENT_TIMESTAMP,
 'FOOTBALL V2 isolated schema; V1 remains frozen benchmark.');

CREATE TABLE IF NOT EXISTS v2_leagues (
    league_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT,
    league_type TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    source TEXT NOT NULL DEFAULT 'API_FOOTBALL',
    updated_at_utc TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v2_seasons (
    league_id INTEGER NOT NULL,
    season_year INTEGER NOT NULL,
    start_date TEXT,
    end_date TEXT,
    current INTEGER NOT NULL DEFAULT 0 CHECK (current IN (0,1)),
    coverage_json TEXT,
    updated_at_utc TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (league_id, season_year),
    FOREIGN KEY (league_id) REFERENCES v2_leagues(league_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS v2_teams (
    team_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    country TEXT,
    founded INTEGER,
    national INTEGER CHECK (national IN (0,1) OR national IS NULL),
    source TEXT NOT NULL DEFAULT 'API_FOOTBALL',
    updated_at_utc TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS v2_fixtures (
    fixture_id INTEGER PRIMARY KEY,
    league_id INTEGER NOT NULL,
    season_year INTEGER NOT NULL,
    home_team_id INTEGER NOT NULL,
    away_team_id INTEGER NOT NULL,
    kickoff_ts INTEGER NOT NULL,
    kickoff_utc TEXT NOT NULL,
    round_name TEXT,
    timezone TEXT,
    venue_name TEXT,
    venue_city TEXT,
    referee TEXT,
    status_short TEXT,
    status_long TEXT,
    elapsed INTEGER,
    extra_minute INTEGER,
    score_home INTEGER,
    score_away INTEGER,
    ht_home INTEGER,
    ht_away INTEGER,
    ft_home INTEGER,
    ft_away INTEGER,
    last_source_update_ms INTEGER,
    last_ingested_at_ms INTEGER,
    source_hash TEXT,
    fixture_payload_json TEXT,
    created_at_utc TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at_utc TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (home_team_id <> away_team_id),
    FOREIGN KEY (league_id, season_year)
        REFERENCES v2_seasons(league_id, season_year) ON DELETE RESTRICT,
    FOREIGN KEY (home_team_id) REFERENCES v2_teams(team_id) ON DELETE RESTRICT,
    FOREIGN KEY (away_team_id) REFERENCES v2_teams(team_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_v2_fixtures_kickoff
ON v2_fixtures(kickoff_ts);
CREATE INDEX IF NOT EXISTS idx_v2_fixtures_status_kickoff
ON v2_fixtures(status_short, kickoff_ts);
CREATE INDEX IF NOT EXISTS idx_v2_fixtures_league_season
ON v2_fixtures(league_id, season_year, kickoff_ts);

CREATE TABLE IF NOT EXISTS v2_ingest_runs (
    run_id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    mode TEXT NOT NULL,
    started_at_ms INTEGER NOT NULL,
    finished_at_ms INTEGER,
    request_fingerprint TEXT,
    http_status INTEGER,
    api_calls INTEGER NOT NULL DEFAULT 0,
    rows_seen INTEGER NOT NULL DEFAULT 0,
    rows_written INTEGER NOT NULL DEFAULT 0,
    rows_skipped INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    error_json TEXT,
    worker_version TEXT,
    created_at_utc TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_v2_ingest_runs_time
ON v2_ingest_runs(started_at_ms DESC);

CREATE TABLE IF NOT EXISTS v2_source_health (
    health_id INTEGER PRIMARY KEY AUTOINCREMENT,
    observed_at_ms INTEGER NOT NULL,
    source TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    success INTEGER NOT NULL CHECK (success IN (0,1)),
    http_status INTEGER,
    latency_ms INTEGER,
    payload_age_sec INTEGER,
    rows_returned INTEGER,
    message TEXT
);
CREATE INDEX IF NOT EXISTS idx_v2_source_health_time
ON v2_source_health(source, endpoint, observed_at_ms DESC);

CREATE TABLE IF NOT EXISTS v2_live_snapshots (
    snapshot_id TEXT PRIMARY KEY,
    fixture_id INTEGER NOT NULL,
    capture_bucket INTEGER NOT NULL,
    capture_interval_sec INTEGER NOT NULL,
    capture_reason TEXT NOT NULL,
    observed_at_ms INTEGER NOT NULL,
    observed_at_utc TEXT NOT NULL,
    source_updated_at_ms INTEGER,
    minute INTEGER,
    extra_minute INTEGER,
    period TEXT,
    status_short TEXT NOT NULL,
    score_home INTEGER NOT NULL DEFAULT 0,
    score_away INTEGER NOT NULL DEFAULT 0,
    ht_home INTEGER,
    ht_away INTEGER,
    events_count INTEGER,
    stats_available INTEGER NOT NULL DEFAULT 0 CHECK (stats_available IN (0,1)),
    lineup_available INTEGER NOT NULL DEFAULT 0 CHECK (lineup_available IN (0,1)),
    source_hash TEXT NOT NULL,
    event_hash TEXT,
    stats_hash TEXT,
    raw_payload_ref TEXT,
    ingest_run_id TEXT,
    created_at_utc TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (fixture_id, capture_bucket),
    FOREIGN KEY (fixture_id) REFERENCES v2_fixtures(fixture_id) ON DELETE RESTRICT,
    FOREIGN KEY (ingest_run_id) REFERENCES v2_ingest_runs(run_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_v2_live_snapshots_fixture_time
ON v2_live_snapshots(fixture_id, observed_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_v2_live_snapshots_status_time
ON v2_live_snapshots(status_short, observed_at_ms DESC);

CREATE TABLE IF NOT EXISTS v2_live_team_stats (
    snapshot_id TEXT NOT NULL,
    fixture_id INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('HOME','AWAY')),
    shots_on_goal REAL,
    shots_off_goal REAL,
    total_shots REAL,
    blocked_shots REAL,
    shots_inside_box REAL,
    shots_outside_box REAL,
    fouls REAL,
    corner_kicks REAL,
    offsides REAL,
    possession_pct REAL,
    yellow_cards REAL,
    red_cards REAL,
    goalkeeper_saves REAL,
    total_passes REAL,
    passes_accurate REAL,
    passes_pct REAL,
    expected_goals REAL,
    stat_fields_present INTEGER NOT NULL DEFAULT 0,
    stat_fields_expected INTEGER NOT NULL DEFAULT 0,
    extras_json TEXT,
    PRIMARY KEY (snapshot_id, team_id),
    FOREIGN KEY (snapshot_id) REFERENCES v2_live_snapshots(snapshot_id) ON DELETE RESTRICT,
    FOREIGN KEY (fixture_id) REFERENCES v2_fixtures(fixture_id) ON DELETE RESTRICT,
    FOREIGN KEY (team_id) REFERENCES v2_teams(team_id) ON DELETE RESTRICT,
    CHECK (possession_pct IS NULL OR (possession_pct >= 0 AND possession_pct <= 100)),
    CHECK (passes_pct IS NULL OR (passes_pct >= 0 AND passes_pct <= 100))
);
CREATE INDEX IF NOT EXISTS idx_v2_live_team_stats_fixture_team
ON v2_live_team_stats(fixture_id, team_id, snapshot_id);

CREATE TABLE IF NOT EXISTS v2_fixture_events (
    event_key TEXT PRIMARY KEY,
    fixture_id INTEGER NOT NULL,
    event_order INTEGER,
    minute INTEGER,
    extra_minute INTEGER,
    team_id INTEGER,
    player_id INTEGER,
    assist_id INTEGER,
    event_type TEXT NOT NULL,
    detail TEXT,
    comments TEXT,
    score_home_after INTEGER,
    score_away_after INTEGER,
    first_observed_at_ms INTEGER NOT NULL,
    last_observed_at_ms INTEGER NOT NULL,
    source_hash TEXT NOT NULL,
    payload_json TEXT,
    FOREIGN KEY (fixture_id) REFERENCES v2_fixtures(fixture_id) ON DELETE RESTRICT,
    FOREIGN KEY (team_id) REFERENCES v2_teams(team_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_v2_fixture_events_fixture_time
ON v2_fixture_events(fixture_id, minute, extra_minute, event_order);

CREATE TABLE IF NOT EXISTS v2_lineup_snapshots (
    lineup_id TEXT PRIMARY KEY,
    fixture_id INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    captured_at_ms INTEGER NOT NULL,
    formation TEXT,
    coach_id INTEGER,
    starting_xi_json TEXT,
    substitutes_json TEXT,
    source_hash TEXT NOT NULL,
    FOREIGN KEY (fixture_id) REFERENCES v2_fixtures(fixture_id) ON DELETE RESTRICT,
    FOREIGN KEY (team_id) REFERENCES v2_teams(team_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_v2_lineups_fixture_team
ON v2_lineup_snapshots(fixture_id, team_id, captured_at_ms DESC);

CREATE TABLE IF NOT EXISTS v2_data_quality_snapshots (
    snapshot_id TEXT PRIMARY KEY,
    fixture_id INTEGER NOT NULL,
    observed_at_ms INTEGER NOT NULL,
    coverage REAL NOT NULL CHECK (coverage >= 0 AND coverage <= 100),
    integrity REAL NOT NULL CHECK (integrity >= 0 AND integrity <= 100),
    freshness REAL NOT NULL CHECK (freshness >= 0 AND freshness <= 100),
    dq_score REAL NOT NULL CHECK (dq_score >= 0 AND dq_score <= 100),
    source_age_sec INTEGER,
    stats_age_sec INTEGER,
    events_age_sec INTEGER,
    gate_status TEXT NOT NULL CHECK (
        gate_status IN ('PASS','LIMITED','INSUFFICIENT','BLOCK')
    ),
    missing_fields_json TEXT,
    integrity_flags_json TEXT,
    freshness_flags_json TEXT,
    anomaly_json TEXT,
    dq_version TEXT NOT NULL,
    created_at_utc TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (snapshot_id) REFERENCES v2_live_snapshots(snapshot_id) ON DELETE RESTRICT,
    FOREIGN KEY (fixture_id) REFERENCES v2_fixtures(fixture_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_v2_dq_fixture_time
ON v2_data_quality_snapshots(fixture_id, observed_at_ms DESC);

CREATE TABLE IF NOT EXISTS v2_model_versions (
    model_version TEXT PRIMARY KEY,
    component TEXT NOT NULL,
    version_label TEXT NOT NULL,
    status TEXT NOT NULL CHECK (
        status IN ('SHADOW','CANDIDATE','ACTIVE','RETIRED')
    ),
    code_hash TEXT,
    config_json TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    activated_at_ms INTEGER,
    retired_at_ms INTEGER,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_v2_model_versions_component_status
ON v2_model_versions(component, status);

CREATE TABLE IF NOT EXISTS v2_team_profile_snapshots (
    profile_id TEXT PRIMARY KEY,
    team_id INTEGER NOT NULL,
    league_id INTEGER NOT NULL,
    season_year INTEGER NOT NULL,
    as_of_ms INTEGER NOT NULL,
    sample_n INTEGER NOT NULL DEFAULT 0,
    attack_strength REAL,
    defense_strength REAL,
    control_strength REAL,
    h1_strength REAL,
    h2_strength REAL,
    home_strength REAL,
    away_strength REAL,
    recent_strength REAL,
    feature_json TEXT NOT NULL,
    model_version TEXT NOT NULL,
    FOREIGN KEY (team_id) REFERENCES v2_teams(team_id) ON DELETE RESTRICT,
    FOREIGN KEY (league_id, season_year)
        REFERENCES v2_seasons(league_id, season_year) ON DELETE RESTRICT,
    FOREIGN KEY (model_version) REFERENCES v2_model_versions(model_version) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_v2_team_profiles_lookup
ON v2_team_profile_snapshots(team_id, league_id, season_year, as_of_ms DESC);

CREATE TABLE IF NOT EXISTS v2_match_baselines (
    baseline_id TEXT PRIMARY KEY,
    fixture_id INTEGER NOT NULL,
    model_version TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    data_cutoff_ms INTEGER NOT NULL,
    home_profile_id TEXT,
    away_profile_id TEXT,
    expected_home_control REAL,
    expected_away_control REAL,
    expected_home_attack REAL,
    expected_away_attack REAL,
    expected_match_tempo REAL,
    baseline_label TEXT,
    feature_json TEXT NOT NULL,
    why_json TEXT NOT NULL,
    FOREIGN KEY (fixture_id) REFERENCES v2_fixtures(fixture_id) ON DELETE RESTRICT,
    FOREIGN KEY (model_version) REFERENCES v2_model_versions(model_version) ON DELETE RESTRICT,
    FOREIGN KEY (home_profile_id) REFERENCES v2_team_profile_snapshots(profile_id) ON DELETE RESTRICT,
    FOREIGN KEY (away_profile_id) REFERENCES v2_team_profile_snapshots(profile_id) ON DELETE RESTRICT,
    UNIQUE (fixture_id, model_version, data_cutoff_ms)
);
CREATE INDEX IF NOT EXISTS idx_v2_match_baselines_fixture
ON v2_match_baselines(fixture_id, created_at_ms DESC);

CREATE TABLE IF NOT EXISTS v2_state_snapshots (
    state_id TEXT PRIMARY KEY,
    snapshot_id TEXT NOT NULL,
    fixture_id INTEGER NOT NULL,
    model_version TEXT NOT NULL,
    baseline_id TEXT,
    computed_at_ms INTEGER NOT NULL,
    attack_pressure_home REAL,
    attack_pressure_away REAL,
    match_tempo REAL,
    momentum_home REAL,
    match_advantage_home REAL,
    goal_threat_home REAL,
    goal_threat_away REAL,
    goal_environment REAL,
    attack_pressure_home_label TEXT,
    attack_pressure_away_label TEXT,
    match_tempo_label TEXT,
    momentum_label TEXT,
    match_advantage_label TEXT,
    goal_threat_home_label TEXT,
    goal_threat_away_label TEXT,
    goal_environment_label TEXT,
    state_velocity REAL,
    change_flags_json TEXT,
    quality_gate_status TEXT NOT NULL CHECK (
        quality_gate_status IN ('PASS','LIMITED','INSUFFICIENT','BLOCK')
    ),
    feature_json TEXT NOT NULL,
    why_json TEXT NOT NULL,
    created_at_utc TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (snapshot_id) REFERENCES v2_live_snapshots(snapshot_id) ON DELETE RESTRICT,
    FOREIGN KEY (fixture_id) REFERENCES v2_fixtures(fixture_id) ON DELETE RESTRICT,
    FOREIGN KEY (model_version) REFERENCES v2_model_versions(model_version) ON DELETE RESTRICT,
    FOREIGN KEY (baseline_id) REFERENCES v2_match_baselines(baseline_id) ON DELETE RESTRICT,
    UNIQUE (snapshot_id, model_version)
);
CREATE INDEX IF NOT EXISTS idx_v2_states_fixture_time
ON v2_state_snapshots(fixture_id, computed_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_v2_states_model_time
ON v2_state_snapshots(model_version, computed_at_ms DESC);

CREATE TABLE IF NOT EXISTS v2_state_outcomes (
    state_id TEXT PRIMARY KEY,
    fixture_id INTEGER NOT NULL,
    resolved_5m INTEGER NOT NULL DEFAULT 0 CHECK (resolved_5m IN (0,1)),
    goal_5m_any INTEGER CHECK (goal_5m_any IN (0,1) OR goal_5m_any IS NULL),
    goal_5m_home INTEGER CHECK (goal_5m_home IN (0,1) OR goal_5m_home IS NULL),
    goal_5m_away INTEGER CHECK (goal_5m_away IN (0,1) OR goal_5m_away IS NULL),
    resolved_10m INTEGER NOT NULL DEFAULT 0 CHECK (resolved_10m IN (0,1)),
    goal_10m_any INTEGER CHECK (goal_10m_any IN (0,1) OR goal_10m_any IS NULL),
    goal_10m_home INTEGER CHECK (goal_10m_home IN (0,1) OR goal_10m_home IS NULL),
    goal_10m_away INTEGER CHECK (goal_10m_away IN (0,1) OR goal_10m_away IS NULL),
    resolved_15m INTEGER NOT NULL DEFAULT 0 CHECK (resolved_15m IN (0,1)),
    goal_15m_any INTEGER CHECK (goal_15m_any IN (0,1) OR goal_15m_any IS NULL),
    goal_15m_home INTEGER CHECK (goal_15m_home IN (0,1) OR goal_15m_home IS NULL),
    goal_15m_away INTEGER CHECK (goal_15m_away IN (0,1) OR goal_15m_away IS NULL),
    resolved_ht INTEGER NOT NULL DEFAULT 0 CHECK (resolved_ht IN (0,1)),
    goal_before_ht INTEGER CHECK (goal_before_ht IN (0,1) OR goal_before_ht IS NULL),
    resolved_ft INTEGER NOT NULL DEFAULT 0 CHECK (resolved_ft IN (0,1)),
    goal_before_ft INTEGER CHECK (goal_before_ft IN (0,1) OR goal_before_ft IS NULL),
    next_goal_team TEXT CHECK (
        next_goal_team IN ('HOME','AWAY','NONE') OR next_goal_team IS NULL
    ),
    final_home INTEGER,
    final_away INTEGER,
    fully_resolved_at_ms INTEGER,
    outcome_version TEXT NOT NULL,
    FOREIGN KEY (state_id) REFERENCES v2_state_snapshots(state_id) ON DELETE RESTRICT,
    FOREIGN KEY (fixture_id) REFERENCES v2_fixtures(fixture_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_v2_outcomes_fixture
ON v2_state_outcomes(fixture_id);

CREATE TABLE IF NOT EXISTS v2_validation_runs (
    validation_run_id TEXT PRIMARY KEY,
    model_version TEXT NOT NULL,
    generated_at_ms INTEGER NOT NULL,
    population_json TEXT NOT NULL,
    train_n INTEGER NOT NULL DEFAULT 0,
    holdout_n INTEGER NOT NULL DEFAULT 0,
    negative_n INTEGER NOT NULL DEFAULT 0,
    positive_n INTEGER NOT NULL DEFAULT 0,
    metrics_json TEXT NOT NULL,
    calibration_json TEXT,
    verdict TEXT NOT NULL CHECK (
        verdict IN ('COLLECT','PASS','FAIL','REVIEW')
    ),
    report_ref TEXT,
    FOREIGN KEY (model_version) REFERENCES v2_model_versions(model_version) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_v2_validation_model_time
ON v2_validation_runs(model_version, generated_at_ms DESC);

-- Mutable read cache only. NOT source of truth.
CREATE TABLE IF NOT EXISTS v2_current_fixture_state (
    fixture_id INTEGER PRIMARY KEY,
    latest_snapshot_id TEXT NOT NULL,
    latest_state_id TEXT,
    latest_dq_score REAL,
    latest_gate_status TEXT,
    attention_score REAL,
    timeline_bucket TEXT CHECK (
        timeline_bucket IN ('HOT','RISING','WATCH','NONE') OR timeline_bucket IS NULL
    ),
    updated_at_ms INTEGER NOT NULL,
    FOREIGN KEY (fixture_id) REFERENCES v2_fixtures(fixture_id) ON DELETE RESTRICT,
    FOREIGN KEY (latest_snapshot_id) REFERENCES v2_live_snapshots(snapshot_id) ON DELETE RESTRICT,
    FOREIGN KEY (latest_state_id) REFERENCES v2_state_snapshots(state_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_v2_current_timeline
ON v2_current_fixture_state(timeline_bucket, attention_score DESC, updated_at_ms DESC);

PRAGMA defer_foreign_keys = OFF;
