SELECT schema_version,spec_version,applied_at_utc FROM v2_schema_meta WHERE id=1;
SELECT COUNT(*) AS v2_table_count FROM sqlite_schema WHERE type='table' AND name LIKE 'v2_%';
