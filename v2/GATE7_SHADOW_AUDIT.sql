SELECT gate_status,COUNT(*) AS n,ROUND(AVG(dq_score),1) AS avg_dq,ROUND(AVG(coverage),1) AS avg_coverage,ROUND(AVG(integrity),1) AS avg_integrity,ROUND(AVG(freshness),1) AS avg_freshness FROM v2_data_quality_snapshots GROUP BY gate_status ORDER BY n DESC;
SELECT capture_reason,COUNT(*) AS n FROM v2_live_snapshots GROUP BY capture_reason ORDER BY n DESC;
SELECT COUNT(*) AS snapshots,COUNT(DISTINCT fixture_id) AS fixtures,MIN(observed_at_utc) AS first_capture,MAX(observed_at_utc) AS last_capture FROM v2_live_snapshots;
SELECT COUNT(*) AS duplicate_groups FROM (SELECT fixture_id,capture_bucket,COUNT(*) n FROM v2_live_snapshots GROUP BY fixture_id,capture_bucket HAVING COUNT(*)>1);
SELECT COUNT(*) AS orphan_stats FROM v2_live_team_stats s LEFT JOIN v2_live_snapshots x ON x.snapshot_id=s.snapshot_id WHERE x.snapshot_id IS NULL;
SELECT COUNT(*) AS error_runs FROM v2_ingest_runs WHERE mode='SHADOW_LIVE' AND error_count>0;
SELECT run_id,started_at_ms,finished_at_ms,api_calls,rows_seen,rows_written,rows_skipped,error_count FROM v2_ingest_runs WHERE mode='SHADOW_LIVE' ORDER BY started_at_ms DESC LIMIT 20;
