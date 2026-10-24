// FT PILOT ONLY. Independent, default-OFF sidecar, no providers, timers,
// schedules, push, scanner or HT/HC APIs. Not imported by production.
import {buildFTObservation} from '../ft-audit-fix/observation.mjs';
import {buildFTDecision} from '../ft-audit-fix/decision-trace.mjs';
import {prepareFTPair} from '../ft-audit-fix/ft-pair-collector.mjs';
import {resolveFTOutcome} from '../ft-audit-fix/outcome.mjs';
import {prepareRecord} from '../ft-audit-fix/replay-ledger.mjs';
const valid=n=>Number.isSafeInteger(n)&&n>0;
const int=n=>Number.isSafeInteger(n)&&n>=0;
const copy=x=>structuredClone(x);
const CAP=12,PAIR_MAX=20000,OUTCOME_MAX=4096;
export const PAIR_READ_SQL='SELECT content_hash,observation_json FROM ft_pilot_pairs_v1 WHERE epoch=?1 AND fixture_id=?2 LIMIT 1';
export const PAIR_INSERT_SQL=`INSERT INTO ft_pilot_pairs_v1
 (epoch,fixture_id,observation_id,observed_at,decision_at,class,logic_version,content_hash,observation_json,decision_json,pair_bytes)
 SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11 FROM ft_pilot_control_v1 c
 WHERE c.epoch=?1 AND c.enabled=1 AND c.capture_start_ms<=?12 AND ?12<c.capture_end_ms
 AND c.max_fixtures>(SELECT COUNT(*) FROM ft_pilot_pairs_v1 p WHERE p.epoch=?1)
 AND c.max_pair_bytes>=?11
 AND c.max_total_pair_bytes>=?11+(SELECT COALESCE(SUM(pair_bytes),0) FROM ft_pilot_pairs_v1 p WHERE p.epoch=?1)
 AND 3>(SELECT COUNT(*) FROM ft_pilot_pairs_v1 p WHERE p.epoch=?1 AND p.class=?6)
 ON CONFLICT(epoch,fixture_id) DO NOTHING`;
export const PAIR_LIMIT_SQL=`SELECT enabled,capture_start_ms,capture_end_ms,
 max_fixtures,max_pair_bytes,max_total_pair_bytes,
 (SELECT COUNT(*) FROM ft_pilot_pairs_v1 p WHERE p.epoch=c.epoch) AS used_fixtures,
 (SELECT COUNT(*) FROM ft_pilot_pairs_v1 p WHERE p.epoch=c.epoch AND p.class=?2) AS used_class,
 (SELECT COALESCE(SUM(pair_bytes),0) FROM ft_pilot_pairs_v1 p WHERE p.epoch=c.epoch) AS used_bytes
 FROM ft_pilot_control_v1 c WHERE epoch=?1 LIMIT 1`;
export const OUTCOME_PAIR_SQL='SELECT observation_json FROM ft_pilot_pairs_v1 WHERE epoch=?1 AND fixture_id=?2 LIMIT 1';
export const OUTCOME_LIST_SQL=`SELECT outcome_json,score_home,score_away,revision_hash,observed_at
 FROM ft_pilot_outcomes_v1 WHERE epoch=?1 AND fixture_id=?2 ORDER BY observed_at DESC LIMIT 2`;
export const OUTCOME_INSERT_SQL=`INSERT INTO ft_pilot_outcomes_v1
 (epoch,fixture_id,revision_hash,observed_at,resolved_at,score_home,score_away,outcome_json)
 SELECT ?1,?2,?3,?4,?5,?6,?7,?8 FROM ft_pilot_control_v1 c
 JOIN ft_pilot_pairs_v1 p ON p.epoch=c.epoch AND p.fixture_id=?2
 WHERE c.enabled=1 AND c.epoch=?1 AND ?9<=c.outcome_end_ms
 AND (SELECT COUNT(*) FROM ft_pilot_outcomes_v1 o WHERE o.epoch=?1 AND o.fixture_id=?2)<c.max_revisions_per_fixture
 ON CONFLICT(epoch,fixture_id,revision_hash) DO NOTHING`;
export const PAUSE_REASON_SQL='UPDATE ft_pilot_control_v1 SET enabled=0 WHERE epoch=?1 AND enabled=1';
function sourcePiece(name,payload,receipt,health,decisionAt){
 if(!valid(receipt)||receipt>decisionAt)return null;
 if(!['OK','EMPTY','ERROR','INVALID'].includes(health))return null;
 return {status:health,received_at:receipt,source_at:null,
  data:health==='OK'||health==='EMPTY'?copy(payload??[]):null};
}
export function buildFTPilotInput(scan,{epoch,logicVersion}={}){
 if(!scan||typeof epoch!=='string'||!epoch||
 !/^[a-f0-9]{64}$/.test(logicVersion||'')||
 !valid(scan.capturedAt)||!valid(scan.fixtureReceivedAt)||
 scan.fixtureReceivedAt>scan.capturedAt)return {status:'INVALID_SOURCE_CLOCK'};
 const f=scan.fixture,id=f?.fixture?.id,min=f?.fixture?.status?.elapsed;
 if(!valid(id)||f.fixture.status.short!=='2H'||!int(min)||min<46||min>90||
 ![f.goals?.home,f.goals?.away].every(int))return {status:'NOT_ELIGIBLE_2H'};
 const sources={fixture:{status:'OK',received_at:scan.fixtureReceivedAt,source_at:null,data:copy(f)}};
 const reasons={};
 for(const [key,field] of [['statistics','stats'],['events','events'],['odds','odds'],['half_statistics','half']]){
  const p=sourcePiece(key,scan.payloads?.[field],scan.receipts?.[field],scan.health?.[field],scan.capturedAt);
  if(p)sources[key]=p;
  if(!p||p.status!=='OK')reasons[key]=!p?'RECEIPT_OR_HEALTH_UNAVAILABLE':p.status==='EMPTY'?'SOURCE_RETURNED_EMPTY':p.status==='ERROR'?'PROVIDER_READ_ERROR':'PROVIDER_RESPONSE_INVALID';
 }
 // Explicit NOT-RECOMMENDED (no crossing) fixtures remain eligible even if
 // normalized market/evaluation is missing.
 const candidate=scan.crossingRequested===true;
 const observation=buildFTObservation({
  id:'FT-PILOT:'+epoch+':'+id,fixture_id:id,decision_at:scan.capturedAt,
  fixture:copy(f),sources,model_version:logicVersion
 });
 observation.missing_reasons=reasons;
 observation.pilot={kind:'READ_ONLY_EXISTING_API_RESPONSES',snapshot_class:candidate?'RECOMMENDATION_CANDIDATE':'NOT_RECOMMENDED',
  alert_delivered:'NOT_ATTESTED',logic_version:logicVersion};
 const context=scan.decision;
 const state=['EVALUATED','NOT_EVALUATED','ERROR'].includes(context?.state)?context.state:'NOT_EVALUATED';
 const decision=buildFTDecision({observation,
  decision_at:Math.max(scan.capturedAt,valid(context?.decision_at)?context.decision_at:scan.capturedAt),
  state,reason:state==='EVALUATED'?null:String(context?.reason||'NO_VALID_EVALUATION').slice(0,80),
  evaluation:state==='EVALUATED'?copy(context.evaluation):null,
  market_rows:Array.isArray(context?.market_rows)?copy(context.market_rows):null,
  devices:Array.isArray(context?.devices)?copy(context.devices):[],source_hash:logicVersion});
 return {status:'READY',fixture_id:id,class:candidate?'RECOMMENDATION_CANDIDATE':'NOT_RECOMMENDED',
  observation,decision};
}
export function createFTPilotRecorder({
 env,db,clock=Date.now,nowHighRes=()=>performance.now(),audit=()=>{},
 durablePause=null,maxSqlPerInvocation=CAP
}={}){
 let sql=0,halt=false;
 const usage={reported_rows_read:0,reported_rows_written:0,unverified_sql_metrics:0};
 if(!Number.isSafeInteger(maxSqlPerInvocation)||maxSqlPerInvocation<1||maxSqlPerInvocation>CAP)
  throw Error('INVALID_FT_PILOT_SQL_CAP');
 const enabled=env?.FT_PILOT_ENABLED==='true';
 const epoch=env?.FT_PILOT_EPOCH;
 const logicVersion=env?.FT_PILOT_LOGIC_VERSION;
 const validConfig=enabled&&typeof epoch==='string'&&epoch.length>=8&&epoch.length<=80&&
  /^[a-f0-9]{64}$/.test(logicVersion||'')&&db&&typeof db.prepare==='function';
 async function sqlCall(sqlText,params,method='all'){
  if(sql>=maxSqlPerInvocation)throw Error('FT_PILOT_SQL_LIMIT');
  sql++;
  const r=await db.prepare(sqlText).bind(...params)[method]();
  if(!r||!Array.isArray(r.results)&&method==='all')throw Error('FT_PILOT_SQL_BAD_RESULT');
  const read=r.meta?.rows_read,written=r.meta?.rows_written;
  // Require actual D1 meta counters, including index amplification.
  // If absent or excessive, fail closed rather than reporting optimistic cost.
  if(!Number.isFinite(read)||read<0||read>1000||
    !Number.isFinite(written)||written<0||written>16)
    throw Error('FT_PILOT_BILLED_METRIC_UNKNOWN_OR_EXCESSIVE');
  usage.reported_rows_read+=read;
  usage.reported_rows_written+=written;
  return r;
 }
 async function stop(reason){
  halt=true;
  try{if(typeof durablePause==='function')await durablePause({epoch,reason:String(reason).slice(0,70)});}catch{}
 }
 const report=(fixture_id,status,extra={})=>{
  const result={fixture_id,status,...extra,sql_requests:sql,
   reported_rows_read:usage.reported_rows_read,
   reported_rows_written:usage.reported_rows_written,
   sql_metrics_unverified:usage.unverified_sql_metrics>0};
  try{audit(result);}catch{}return result;
 };
 async function capture(scan){
  const started=nowHighRes();
  if(!enabled)return report(scan?.fixture?.fixture?.id??null,'DISABLED');
  if(!validConfig)return report(null,'INVALID_DISABLED_CONFIG');
  if(halt)return report(scan?.fixture?.fixture?.id??null,'FT_PILOT_PAUSED');
  let input,pair;
  try{
   input=buildFTPilotInput(scan,{epoch,logicVersion});
   if(input.status!=='READY')return report(scan?.fixture?.fixture?.id??null,input.status);
   // Strict cap before any D1 use: huge source responses are not truncated
   // silently and never turn into made-up missing API evidence.
   pair=await prepareFTPair(input.observation,input.decision,PAIR_MAX);
  }catch{return report(scan?.fixture?.fixture?.id??null,'PAIR_INVALID_OR_TOO_LARGE');}
  const id=input.fixture_id;
  try{
   const old=(await sqlCall(PAIR_READ_SQL,[epoch,id])).results[0];
   if(old)return report(id,'SKIPPED_EXISTING_FIXTURE',{class:input.class,hash_matches:old.content_hash===pair.content_hash,
    elapsed_ms:nowHighRes()-started});
   const current=clock();
   if(!valid(current)||current<scan.capturedAt)return report(id,'INVALID_PILOT_CLOCK');
   const x=await sqlCall(PAIR_INSERT_SQL,[epoch,id,pair.observation_id,pair.observed_at,
    pair.decision_at,input.class,logicVersion,pair.content_hash,pair.observation_json,
    pair.decision_json,pair.bytes,current],'run');
   const billed=x.meta?.rows_written;
   if(!Number.isFinite(billed)||billed<0){await stop('UNKNOWN_BILLED_WRITES');return report(id,'BILLING_UNVERIFIED_PAUSED');}
   if(billed>16){await stop('BILLED_ROWS_WRITE_HIGH');return report(id,'WRITE_AMPLIFICATION_PAUSED',{billed_rows_written:billed});}
   if(x.meta?.changes===1)return report(id,'PAIR_STORED',{class:input.class,pair_bytes:pair.bytes,
    billed_rows_written:billed,elapsed_ms:nowHighRes()-started});
   const limits=(await sqlCall(PAIR_LIMIT_SQL,[epoch,input.class])).results[0];
   const reason=!limits?'EPOCH_MISSING':
    limits.enabled!==1?'PILOT_DISABLED':
    current<limits.capture_start_ms||current>=limits.capture_end_ms?'CAPTURE_WINDOW_CLOSED':
    limits.used_fixtures>=limits.max_fixtures?'FIVE_FIXTURE_CAP':
    limits.used_class>=3?'BALANCED_CLASS_CAP':
    limits.used_bytes+pair.bytes>limits.max_total_pair_bytes?'TOTAL_BYTE_CAP':'BUDGET_OR_CONCURRENT_CONFLICT';
   return report(id,'SKIPPED_'+reason,{class:input.class,elapsed_ms:nowHighRes()-started});
  }catch(e){await stop(String(e?.message||'FT_PILOT_D1_ERROR'));return report(id,'D1_ERROR_PAUSED',{elapsed_ms:nowHighRes()-started});}
 }
 async function outcome(fixture,receivedAt){
  const id=fixture?.fixture?.id,started=nowHighRes();
  if(!enabled)return report(id??null,'DISABLED');
  if(!validConfig)return report(id??null,'INVALID_DISABLED_CONFIG');
  if(halt)return report(id??null,'FT_PILOT_PAUSED');
  if(!valid(id))return report(null,'OUTCOME_INVALID_FIXTURE');
  try{
   const row=(await sqlCall(OUTCOME_PAIR_SQL,[epoch,id])).results[0];
   if(!row)return report(id,'OUTCOME_NO_SELECTED_PAIR');
   const observation=JSON.parse(row.observation_json);
   const now=clock();
   const result=resolveFTOutcome(observation,fixture,receivedAt,now);
   if(result.state!=='RESOLVED')return report(id,result.state,{reason:result.reason});
   const previous=(await sqlCall(OUTCOME_LIST_SQL,[epoch,id])).results;
   if(previous.some(x=>x.score_home===result.score.home&&x.score_away===result.score.away))
    return report(id,'OUTCOME_ALREADY_RECORDED');
   if(previous.length>=2)return report(id,'OUTCOME_REVISION_LIMIT');
   const rec=await prepareRecord('OUTCOME',result,OUTCOME_MAX);
   const x=await sqlCall(OUTCOME_INSERT_SQL,[epoch,id,rec.content_hash,
    result.observed_at,result.resolved_at,result.score.home,result.score.away,rec.payload_json,now],'run');
   const billed=x.meta?.rows_written;
   if(!Number.isFinite(billed)||billed<0){await stop('UNKNOWN_OUTCOME_BILLED_WRITES');return report(id,'BILLING_UNVERIFIED_PAUSED');}
   if(billed>16){await stop('OUTCOME_WRITE_AMPLIFICATION');return report(id,'WRITE_AMPLIFICATION_PAUSED');}
   return report(id,x.meta?.changes===1?
    (previous.length?'OUTCOME_CORRECTION_APPENDED':'OUTCOME_STORED'):'OUTCOME_WRITE_DENIED',
    {revisions_before:previous.length,billed_rows_written:billed,elapsed_ms:nowHighRes()-started});
  }catch(e){await stop(String(e?.message||'OUTCOME_D1_ERROR'));return report(id,'D1_ERROR_PAUSED',{elapsed_ms:nowHighRes()-started});}
 }
 return {capture,outcome,sqlUsed:()=>sql,reportedUsage:()=>({...usage}),
  paused:()=>halt,enabled:()=>validConfig,
  contract:{max_sql_per_invocation:maxSqlPerInvocation,max_distinct_fixtures:5,
   max_per_class:3,max_pair_bytes:PAIR_MAX,default_off:true,
   provider_calls:0,scheduled_polls:0,model_pricing:false}};
}
