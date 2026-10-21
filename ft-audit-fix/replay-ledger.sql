-- STAGED ONLY: not referenced by current migrations or Worker.
CREATE TABLE IF NOT EXISTS ft_replay_records_v1 (
 record_id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('OBSERVATION','OUTCOME')),
 observation_id TEXT NOT NULL,
 fixture_id INTEGER NOT NULL CHECK(fixture_id > 0),
 recorded_at INTEGER NOT NULL CHECK(recorded_at > 0),
 content_hash TEXT NOT NULL,
 payload_json TEXT NOT NULL
);
-- No UPDATE/DELETE path in the staged adapter.
