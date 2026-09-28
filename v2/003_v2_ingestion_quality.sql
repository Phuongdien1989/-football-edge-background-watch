ALTER TABLE v2_data_quality_snapshots
ADD COLUMN capability_json TEXT;

CREATE TABLE IF NOT EXISTS v2_quality_policies (
    dq_version TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('SHADOW','ACTIVE','RETIRED')),
    config_json TEXT NOT NULL,
    code_hash TEXT,
    created_at_ms INTEGER NOT NULL,
    activated_at_ms INTEGER,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_v2_quality_policies_status
ON v2_quality_policies(status, created_at_ms DESC);

INSERT OR IGNORE INTO v2_quality_policies
(dq_version,status,config_json,created_at_ms,notes)
VALUES
(
  'DQ_V2_0_1_SHADOW',
  'SHADOW',
  '{"weights":{"coverage":45,"integrity":35,"freshness":20},"gates":{"pass":{"dq":80,"coverage":65,"integrity":80,"freshness":70},"limited":{"dq":60,"integrity":65}},"capture":{"base_sec":120,"active_sec":60}}',
  CAST(strftime('%s','now') AS INTEGER)*1000,
  'Foundation DQ policy. Shadow only; not used to drive V1 or public alerts.'
);
