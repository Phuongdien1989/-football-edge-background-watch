// Offline audited plan: probe presence/count ONLY of compact raw odds in
// production FT live snapshot payloads. No raw odds or fixture IDs exported.
export const FT_RAW_ODDS_PRESENCE_SQL=`SELECT fixture_id,captured_at,source,snapshot_kind,
 CASE WHEN json_valid(payload_json) THEN COALESCE(json_array_length(payload_json,'$.odds_raw'),0) ELSE -1 END AS odds_group_count,
 CASE WHEN json_valid(payload_json) THEN COALESCE(json_array_length(payload_json,'$.stats_raw'),0) ELSE -1 END AS stats_team_count,
 CASE WHEN json_valid(payload_json) THEN COALESCE(json_array_length(payload_json,'$.events_raw'),0) ELSE -1 END AS event_count,
 CASE WHEN json_valid(payload_json) THEN
  CASE WHEN json_type(payload_json,'$.odds_raw[0].update') IN ('text','integer','real') THEN 1 ELSE 0 END
 ELSE 0 END AS has_feed_update
 FROM live_snapshots INDEXED BY idx_live_snapshots_engine_time
 WHERE engine='FT' ORDER BY captured_at DESC LIMIT 24`;
export function assertFTPayloadReadOnlySQL(sql){
 if(sql!==FT_RAW_ODDS_PRESENCE_SQL||!/^SELECT\b/i.test(sql)||sql.includes(';'))
 throw Error('FT_PAYLOAD_NOT_CLOSED_READONLY_SQL');
 return true;
}
const num=x=>Number.isSafeInteger(x)&&x>=0?x:0;
export function summarizeFTPayloadShape(rows){
 if(!Array.isArray(rows)||rows.length>24)throw Error('INVALID_BOUNDED_FT_PAYLOAD_SAMPLE');
 const out={rows_sampled:rows.length,with_raw_odds_groups:0,with_both_teams_stats:0,
  with_event_evidence:0,with_provider_market_update:0,missing_or_invalid_json:0,
  source_kind_counts:{},latest_sample_at:null,oldest_sample_at:null,
  raw_bet_price_verified:0,bookmaker_identity_verified:0,can_replay_without_new_writes:false,
  labels_are_independently_verified:false};
 for(const r of rows){
  if(!r||typeof r!=='object')throw Error('INVALID_FT_PAYLOAD_ROW');
  if(r.odds_group_count===-1)out.missing_or_invalid_json++;
  if(num(r.odds_group_count)>0)out.with_raw_odds_groups++;
  if(num(r.stats_team_count)>=2)out.with_both_teams_stats++;
  if(num(r.event_count)>0)out.with_event_evidence++;
  if(r.has_feed_update===1)out.with_provider_market_update++;
  const kind=['SOURCE_DETAIL','SOURCE_HEARTBEAT'].includes(r.snapshot_kind)?
   r.snapshot_kind:'OTHER';
  out.source_kind_counts[kind]=(out.source_kind_counts[kind]||0)+1;
  if(Number.isSafeInteger(r.captured_at)&&r.captured_at>0){
   out.latest_sample_at=Math.max(out.latest_sample_at||0,r.captured_at);
   out.oldest_sample_at=Math.min(out.oldest_sample_at||r.captured_at,r.captured_at);
  }
 }
 out.result=out.with_raw_odds_groups?'RAW_ODDS_PAYLOAD_PRESENT_NOT_PRICE_CERTIFIED':
  'NO_RAW_ODDS_IN_RECENT_BOUNDED_SAMPLE';
 out.note='Only JSON array counts and update-key presence; no odds, selections, fixture IDs or payloads disclosed. Market source/time, regulation settlement and historical joins remain unverified.';
 return out;
}
