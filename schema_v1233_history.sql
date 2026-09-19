PRAGMA foreign_keys = ON;

-- V1.23.3 Team + Fixture History Database (additive migration)
CREATE TABLE IF NOT EXISTS teams (
  team_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  logo TEXT,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);
CREATE INDEX IF NOT EXISTS idx_teams_last_seen ON teams(last_seen_at DESC);

CREATE TABLE IF NOT EXISTS fixture_history (
  fixture_id INTEGER PRIMARY KEY,
  league_id INTEGER,
  league TEXT,
  country TEXT,
  season INTEGER,
  round TEXT,
  kickoff INTEGER,
  status TEXT,
  status_long TEXT,
  minute INTEGER,
  home_team_id INTEGER,
  away_team_id INTEGER,
  score_home INTEGER,
  score_away INTEGER,
  halftime_home INTEGER,
  halftime_away INTEGER,
  fulltime_home INTEGER,
  fulltime_away INTEGER,
  home_winner INTEGER,
  away_winner INTEGER,
  terminal INTEGER NOT NULL DEFAULT 0,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  payload_json TEXT,
  FOREIGN KEY (home_team_id) REFERENCES teams(team_id),
  FOREIGN KEY (away_team_id) REFERENCES teams(team_id)
);
CREATE INDEX IF NOT EXISTS idx_fixture_history_kickoff ON fixture_history(kickoff DESC);
CREATE INDEX IF NOT EXISTS idx_fixture_history_league ON fixture_history(league_id,season,kickoff DESC);
CREATE INDEX IF NOT EXISTS idx_fixture_history_home ON fixture_history(home_team_id,kickoff DESC);
CREATE INDEX IF NOT EXISTS idx_fixture_history_away ON fixture_history(away_team_id,kickoff DESC);
CREATE INDEX IF NOT EXISTS idx_fixture_history_status ON fixture_history(status,last_seen_at DESC);

CREATE TABLE IF NOT EXISTS team_fixture_history (
  id TEXT PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  opponent_team_id INTEGER,
  venue TEXT NOT NULL,
  league_id INTEGER,
  league TEXT,
  season INTEGER,
  round TEXT,
  kickoff INTEGER,
  status TEXT,
  goals_for INTEGER,
  goals_against INTEGER,
  result TEXT,
  points INTEGER,
  updated_at INTEGER NOT NULL,
  payload_json TEXT,
  FOREIGN KEY (fixture_id) REFERENCES fixture_history(fixture_id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (opponent_team_id) REFERENCES teams(team_id)
);
CREATE INDEX IF NOT EXISTS idx_team_fixture_team_time ON team_fixture_history(team_id,kickoff DESC);
CREATE INDEX IF NOT EXISTS idx_team_fixture_opponent ON team_fixture_history(opponent_team_id,kickoff DESC);
CREATE INDEX IF NOT EXISTS idx_team_fixture_league ON team_fixture_history(league_id,season,kickoff DESC);
CREATE INDEX IF NOT EXISTS idx_team_fixture_result ON team_fixture_history(team_id,result,kickoff DESC);

INSERT INTO fe_schema_meta (key,value,updated_at)
VALUES ('history_schema_version','V1.23.3',unixepoch()*1000)
ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;
