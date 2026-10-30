// Safe bounded BACKGROUND snapshot odds presence probe.
// Engine=FT stores a different class of row. BACKGROUND snapshots are indexed
// by persistence reason and may hold compact odds_raw despite NULL line/price.
export const BG_INDEX_SQL="SELECT name FROM sqlite_master WHERE type='index' AND name='idx_live_snapshots_reason_time' LIMIT 1";
export const BG_ODDS_SHAPE_SQL=`SELECT captured_at,source,snapshot_kind,
 CASE WHEN json_valid(payload_json) THEN COALESCE(json_array_length(payload_json,'$.odds_raw'),0) ELSE -1 END AS odds_group_count,
 CASE WHEN json_valid(payload_json) THEN COALESCE(json_array_length(payload_json,'$.stats_raw'),0) ELSE -1 END AS stats_team_count,
 CASE WHEN json_valid(payload_json) THEN COALESCE(json_array_length(payload_json,'$.events_raw'),0) ELSE -1 END AS event_count,
 CASE WHEN json_valid(payload_json) THEN
  CASE WHEN json_type(payload_json,'$.odds_raw[0].update') IN ('text','integer','real') THEN 1 ELSE 0 END ELSE 0 END AS has_feed_update
 FROM live_snapshots INDEXED BY idx_live_snapshots_reason_time
 WHERE persistence_reason=?1 ORDER BY captured_at DESC LIMIT 24`;
export const BG_REASONS=Object.freeze(['MARKET_MOVE','BACKGROUND_BASELINE','PERIODIC_5M']);
export function safeBgProbeSQL(sql,params){
 const meta=sql===BG_INDEX_SQL&&Array.isArray(params)&&params.length===0;
 const data=sql===BG_ODDS_SHAPE_SQL&&Array.isArray(params)&&params.length===1&&BG_REASONS.includes(params[0]);
 if(!meta&&!data)throw Error('NOT_A_CLOSED_INDEXED_BG_ODDS_READ');
 return true;
}
export function summaryBackgroundShape(reason,rows){
 if(!BG_REASONS.includes(reason)||!Array.isArray(rows)||rows.length>24)throw Error('INVALID_BG_SAMPLE');
 const tally={reason,rows_sampled:rows.length,raw_odds_present:0,stats_present:0,
  events_present:0,market_updates_present:0,source_BACKGROUND:0,source_other:0,
  oldest_at:null,newest_at:null,verified_bookmaker_odds:0,calibrated_model_pairs:0};
 for(const r of rows){
  if(!r||typeof r!=='object')throw Error('INVALID_BG_SAMPLE_ROW');
  if(Number.isSafeInteger(r.odds_group_count)&&r.odds_group_count>0)tally.raw_odds_present++;
  if(Number.isSafeInteger(r.stats_team_count)&&r.stats_team_count>=2)tally.stats_present++;
  if(Number.isSafeInteger(r.event_count)&&r.event_count>0)tally.events_present++;
  if(r.has_feed_update===1)tally.market_updates_present++;
  if(r.source==='BACKGROUND')tally.source_BACKGROUND++;else tally.source_other++;
  if(Number.isSafeInteger(r.captured_at)&&r.captured_at>0){
   tally.oldest_at=Math.min(tally.oldest_at??r.captured_at,r.captured_at);
   tally.newest_at=Math.max(tally.newest_at??r.captured_at,r.captured_at);
  }
 }
 return tally;
}
