-- If capability_json is already listed, DO NOT run 003 again.
PRAGMA table_info(v2_data_quality_snapshots);
SELECT name FROM sqlite_schema WHERE type='table' AND name='v2_quality_policies';
