-- Staged only: extra index maintenance adds writes to every ledger insert.
CREATE INDEX IF NOT EXISTS ft_replay_by_observation_kind
ON ft_replay_records_v1(observation_id,kind,recorded_at);
