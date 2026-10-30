// Closed, indexed-only, bounded discovery plan for LEGACY production FT tables.
// No direct DB, Cloudflare access, migration, raw odds export or model promotion.
export const KNOWN_FT_TABLES=Object.freeze([
 'live_snapshots','entry_decisions','entry_outcomes','fixture_history','market_snapshots',
 'ft_replay_pairs_v1','ft_replay_records_v1'
]);
const specs=Object.freeze([
 {table:'live_snapshots',index:'idx_live_snapshots_engine_time',
  columns:['fixture_id','captured_at','minute','status','score_home','score_away','line','price','market_type','signal_score','snapshot_kind','source'],
  sql:"SELECT fixture_id,captured_at,minute,status,score_home,score_away,line,price,market_type,signal_score,snapshot_kind,source FROM live_snapshots INDEXED BY idx_live_snapshots_engine_time WHERE engine='FT' ORDER BY captured_at DESC LIMIT 24"},
 {table:'entry_decisions',index:'idx_entry_engine_time',
  columns:['fixture_id','captured_at','minute','score_home','score_away','line','price','model_prob','policy_status','resolution','outcome','auto_settle_supported'],
  sql:"SELECT fixture_id,captured_at,minute,score_home,score_away,line,price,model_prob,policy_status,resolution,outcome,auto_settle_supported FROM entry_decisions INDEXED BY idx_entry_engine_time WHERE engine='FT' ORDER BY captured_at DESC LIMIT 24"},
 {table:'entry_outcomes',index:'idx_entry_outcomes_engine',
  columns:['fixture_id','resolved_at','outcome','final_score_home','final_score_away'],
  sql:"SELECT fixture_id,resolved_at,outcome,final_score_home,final_score_away FROM entry_outcomes INDEXED BY idx_entry_outcomes_engine WHERE engine='FT' ORDER BY resolved_at DESC LIMIT 24"},
 {table:'fixture_history',index:'idx_fixture_history_status',
  columns:['fixture_id','last_seen_at','kickoff','status','terminal','fulltime_home','fulltime_away'],
  sql:"SELECT fixture_id,last_seen_at,kickoff,status,terminal,fulltime_home,fulltime_away FROM fixture_history INDEXED BY idx_fixture_history_status WHERE status='FT' ORDER BY last_seen_at DESC LIMIT 24"}
]);
const marketSpec=Object.freeze({
 table:'market_snapshots',index:'idx_market_snapshots_fixture',
 columns:['fixture_id','captured_at','market_type','selection','line','price','source'],
 sql:"SELECT fixture_id,captured_at,market_type,selection,line,price,source FROM market_snapshots INDEXED BY idx_market_snapshots_fixture WHERE fixture_id=?1 ORDER BY captured_at DESC LIMIT 12"
});
const validSql=(s)=>typeof s==='string'&&/^[\s]*SELECT\s/i.test(s)&&
 !/[;]|--|\/\*/.test(s)&&!/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|REPLACE|ATTACH|PRAGMA)\b/i.test(s);
export const LEGACY_META_SQL="SELECT name,type,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index') AND (name IN ('live_snapshots','entry_decisions','entry_outcomes','fixture_history','market_snapshots','ft_replay_pairs_v1','ft_replay_records_v1') OR tbl_name IN ('live_snapshots','entry_decisions','entry_outcomes','fixture_history','market_snapshots')) LIMIT 80";
export function assertSafeFTReadSQL(s){
 if(!validSql(s))throw Error('NOT_ALLOWED_READ_ONLY_FT_SQL');
 if(s!==LEGACY_META_SQL&&![...specs,marketSpec].some(p=>p.sql===s))throw Error('UNAPPROVED_FT_PROD_SQL');
 return true;
}
const ddlHas=(sql,column)=>new RegExp('(?:^|[\\s,(])'+column+'[\\s]+','i').test(sql);
function validSpec(table,index,tableMap,indexMap){
 const def=tableMap.get(table);
 const idx=indexMap.get(index);
 const plan=[...specs,marketSpec].find(x=>x.table===table);
 return !!(def&&idx?.tbl_name===table&&def.sql&&
  plan.columns.every(name=>ddlHas(def.sql,name))&&
  /CREATE\s+(?:UNIQUE\s+)?INDEX/i.test(idx.sql||''));
}
export function buildLegacyFTReadPlan(meta){
 if(!Array.isArray(meta)||meta.length>80)throw Error('INVALID_SCHEMA_METADATA');
 const tableMap=new Map(),indexMap=new Map();
 for(const row of meta){
  if(!row||typeof row.name!=='string'||typeof row.type!=='string'||
   !KNOWN_FT_TABLES.includes(row.name)&&row.type==='table'&&
     !specs.some(s=>s.index===row.name)&&row.name!==marketSpec.index)continue;
  if(row.type==='table')tableMap.set(row.name,row);
  if(row.type==='index')indexMap.set(row.name,row);
 }
 const existing=KNOWN_FT_TABLES.filter(x=>tableMap.has(x));
 const queries=specs.filter(s=>validSpec(s.table,s.index,tableMap,indexMap))
  .map(({table,sql})=>({key:table,sql,params:[],maxResultRows:24}));
 const marketEnabled=validSpec(marketSpec.table,marketSpec.index,tableMap,indexMap);
 return {status:'INDEXED_READ_PLAN_ONLY',existing_tables:existing,
  missing_replay_tables:['ft_replay_pairs_v1','ft_replay_records_v1'].filter(x=>!tableMap.has(x)),
  queries,market_probe_available:marketEnabled,
  discovery_candidate_tables:queries.map(x=>x.key).concat(marketEnabled?['market_snapshots']:[]),
  reasons:specs.filter(x=>!queries.some(q=>q.key===x.table)).map(x=>x.table+':ABSENT_OR_SCHEMA_INDEX_DRIFT'),
  market_spec:marketEnabled?{sql:marketSpec.sql,maxResultRows:12}:null};
}
export function summarizeLegacyFTSamples(key,rows){
 if(!['live_snapshots','entry_decisions','entry_outcomes','fixture_history','market_snapshots'].includes(key)||
 !Array.isArray(rows)||rows.length>24)throw Error('INVALID_FT_SAMPLE_ROWS');
 const ids=new Set(rows.filter(x=>Number.isSafeInteger(x.fixture_id)&&x.fixture_id>0).map(x=>x.fixture_id));
 const clockKey=key==='entry_outcomes'?'resolved_at':key==='fixture_history'?'last_seen_at':'captured_at';
 const validTimes=rows.map(x=>x[clockKey]).filter(x=>Number.isSafeInteger(x)&&x>0);
 return {table:key,sample_rows:rows.length,distinct_fixtures:ids.size,
  newest_record_at:validTimes.length?Math.max(...validTimes):null,
  oldest_record_at:validTimes.length?Math.min(...validTimes):null,
  with_line_price:rows.filter(x=>typeof x.line==='number'&&Number.isFinite(x.line)&&
    typeof x.price==='number'&&Number.isFinite(x.price)&&x.price>1).length,
  with_model_prob:rows.filter(x=>typeof x.model_prob==='number'&&Number.isFinite(x.model_prob)).length,
  with_final_score:rows.filter(x=>Number.isSafeInteger(x.final_score_home)&&Number.isSafeInteger(x.final_score_away)||
   Number.isSafeInteger(x.fulltime_home)&&Number.isSafeInteger(x.fulltime_away)).length,
  has_raw_odds_hash_pair:false,training_ready:false};
}
export function selectMarketFixtureCandidate(groups){
 for(const key of ['live_snapshots','entry_decisions']){
  for(const row of groups[key]||[]){
   if(Number.isSafeInteger(row.fixture_id)&&row.fixture_id>0)return row.fixture_id;
  }
 }
 return null;
}
export const LEGACY_MARKET_SPEC=marketSpec;
