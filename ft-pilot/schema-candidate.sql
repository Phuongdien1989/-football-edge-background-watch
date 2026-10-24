-- FT pilot CANDIDATE ONLY. Do NOT run on production without approval.
-- Requires a separately created epoch row; migrations alone do not enable FT.
-- No changes to HT / HC / legacy tables, indexes, scanner, or Push.
CREATE TABLE IF NOT EXISTS ft_pilot_control_v1 (
 epoch TEXT PRIMARY KEY CHECK(length(epoch) BETWEEN 8 AND 80),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 capture_start_ms INTEGER NOT NULL CHECK(capture_start_ms>0),
 capture_end_ms INTEGER NOT NULL CHECK(capture_end_ms>capture_start_ms),
 outcome_end_ms INTEGER NOT NULL CHECK(outcome_end_ms>capture_end_ms),
 max_fixtures INTEGER NOT NULL DEFAULT 5 CHECK(max_fixtures BETWEEN 1 AND 5),
 max_pair_bytes INTEGER NOT NULL DEFAULT 20000 CHECK(max_pair_bytes BETWEEN 1024 AND 20000),
 max_total_pair_bytes INTEGER NOT NULL DEFAULT 100000 CHECK(max_total_pair_bytes BETWEEN 1024 AND 100000),
 max_revisions_per_fixture INTEGER NOT NULL DEFAULT 2 CHECK(max_revisions_per_fixture BETWEEN 1 AND 2)
);
CREATE TABLE IF NOT EXISTS ft_pilot_pairs_v1 (
 epoch TEXT NOT NULL,
 fixture_id INTEGER NOT NULL CHECK(fixture_id>0),
 observation_id TEXT NOT NULL CHECK(length(observation_id) BETWEEN 3 AND 160),
 observed_at INTEGER NOT NULL CHECK(observed_at>0),
 decision_at INTEGER NOT NULL CHECK(decision_at>=observed_at),
 class TEXT NOT NULL CHECK(class IN ('RECOMMENDATION_CANDIDATE','NOT_RECOMMENDED')),
 logic_version TEXT NOT NULL CHECK(length(logic_version) BETWEEN 1 AND 100),
 content_hash TEXT NOT NULL CHECK(length(content_hash)=64),
 observation_json TEXT NOT NULL CHECK(json_valid(observation_json)),
 decision_json TEXT NOT NULL CHECK(json_valid(decision_json)),
 pair_bytes INTEGER NOT NULL CHECK(pair_bytes BETWEEN 1 AND 20000),
 PRIMARY KEY(epoch,fixture_id),
 FOREIGN KEY(epoch) REFERENCES ft_pilot_control_v1(epoch)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS ft_pilot_outcomes_v1 (
 epoch TEXT NOT NULL,
 fixture_id INTEGER NOT NULL,
 revision_hash TEXT NOT NULL CHECK(length(revision_hash)=64),
 observed_at INTEGER NOT NULL CHECK(observed_at>0),
 resolved_at INTEGER NOT NULL CHECK(resolved_at>=observed_at),
 score_home INTEGER NOT NULL CHECK(score_home>=0),
 score_away INTEGER NOT NULL CHECK(score_away>=0),
 outcome_json TEXT NOT NULL CHECK(json_valid(outcome_json)),
 PRIMARY KEY(epoch,fixture_id,revision_hash),
 FOREIGN KEY(epoch,fixture_id) REFERENCES ft_pilot_pairs_v1(epoch,fixture_id)
) WITHOUT ROWID;
-- No secondary indexes: bounded max 5 pairs + 10 outcome rows;
-- avoid unnecessary D1 index-write amplification.
CREATE TRIGGER IF NOT EXISTS ft_pilot_pairs_no_update BEFORE UPDATE ON ft_pilot_pairs_v1
BEGIN SELECT RAISE(ABORT,'FT_PILOT_IMMUTABLE_PAIR'); END;
CREATE TRIGGER IF NOT EXISTS ft_pilot_pairs_no_delete BEFORE DELETE ON ft_pilot_pairs_v1
BEGIN SELECT RAISE(ABORT,'FT_PILOT_PRESERVE_PAIR'); END;
CREATE TRIGGER IF NOT EXISTS ft_pilot_outcomes_no_update BEFORE UPDATE ON ft_pilot_outcomes_v1
BEGIN SELECT RAISE(ABORT,'FT_PILOT_IMMUTABLE_OUTCOME'); END;
CREATE TRIGGER IF NOT EXISTS ft_pilot_outcomes_no_delete BEFORE DELETE ON ft_pilot_outcomes_v1
BEGIN SELECT RAISE(ABORT,'FT_PILOT_PRESERVE_OUTCOME'); END;
