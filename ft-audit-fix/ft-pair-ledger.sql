-- Staged schema for atomic observation+decision envelope. NO production migration.
-- Append-only by application policy; a unique observation ID is one immutable pair.
CREATE TABLE IF NOT EXISTS ft_replay_pairs_v1 (
 observation_id TEXT PRIMARY KEY,
 fixture_id INTEGER NOT NULL CHECK(fixture_id>0),
 observed_at INTEGER NOT NULL CHECK(observed_at>0),
 decision_at INTEGER NOT NULL CHECK(decision_at>=observed_at),
 content_hash TEXT NOT NULL,
 observation_json TEXT NOT NULL,
 decision_json TEXT NOT NULL
);
-- The existing ft_replay_budget_v1 remains a separate conservative reservation.
