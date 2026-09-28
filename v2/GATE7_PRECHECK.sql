-- GATE 7 PRECHECK — READ ONLY
SELECT 'V1_CORE_SCHEMA' AS check_name, value AS value FROM fe_schema_meta WHERE key='schema_version';
SELECT 'V1_HISTORY_SCHEMA' AS check_name, value AS value FROM fe_schema_meta WHERE key='history_schema_version';
SELECT 'V1_TEAMS' AS check_name, COUNT(*) AS value FROM teams;
SELECT 'V1_FIXTURE_HISTORY' AS check_name, COUNT(*) AS value FROM fixture_history;
SELECT 'V1_VALIDATION_RESULTS' AS check_name, COUNT(*) AS value FROM validation_results;
SELECT name AS existing_v2_table FROM sqlite_schema WHERE type='table' AND name LIKE 'v2_%' ORDER BY name;
