-- Staged schema only. Provision one explicit window separately; runtime never creates or resets it.
CREATE TABLE IF NOT EXISTS ft_replay_budget_v1 (
 id INTEGER PRIMARY KEY CHECK(id=1),
 window_start INTEGER NOT NULL CHECK(window_start>0),
 window_end INTEGER NOT NULL CHECK(window_end>window_start),
 max_records INTEGER NOT NULL CHECK(max_records>0),
 max_bytes INTEGER NOT NULL CHECK(max_bytes>0),
 used_records INTEGER NOT NULL DEFAULT 0 CHECK(used_records>=0 AND used_records<=max_records),
 used_bytes INTEGER NOT NULL DEFAULT 0 CHECK(used_bytes>=0 AND used_bytes<=max_bytes),
 last_at INTEGER NOT NULL DEFAULT 0 CHECK(last_at>=0)
);
