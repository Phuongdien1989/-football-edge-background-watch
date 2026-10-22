import {runFTOutcomePass,OUTCOME_BUDGET_KEY} from './outcome-pass.mjs';
import {ftReplaySqlRemaining,ftReplayQueryDB} from './replay-sql-budget.mjs';
import {PAIR_PAGE_SQL,verifyFTPairRow} from './pair-outcome-replay.mjs';
export const DISCOVERY_KEY='ft:outcome:discovery:v1';
export const PAGE_SQL=`WITH page AS MATERIALIZED (
 SELECT record_id,observation_id,fixture_id,payload_json
 FROM ft_replay_records_v1
 WHERE record_id>?1 AND record_id>='OBS:' AND record_id<'OBS;'
 ORDER BY record_id LIMIT ?2
)
SELECT page.*,
 EXISTS(SELECT 1 FROM ft_replay_records_v1 AS d INDEXED BY ft_replay_by_observation_kind WHERE d.observation_id=page.observation_id AND d.kind='DECISION') AS has_decision,
 EXISTS(SELECT 1 FROM ft_replay_records_v1 AS o INDEXED BY ft_replay_by_observation_kind WHERE o.observation_id=page.observation_id AND o.kind='OUTCOME') AS has_outcome
FROM page ORDER BY record_id`;
const pos=x=>Number.isSafeInteger(x)&&x>0;
export async function runPendingFT(owner,{clock=Date.now}={}){
 if(owner.env?.FT_OUTCOME_DISCOVERY_ENABLED!=='true'||owner.env?.FT_OUTCOME_TRIAL_ENABLED!=='true'||owner.env?.FT_REPLAY_TRIAL_ENABLED!=='true')return {status:'DISABLED'};
 if(typeof owner.scanControl!=='function'||(await owner.scanControl())?.enabled!==true)return {status:'SCANNER_OFF'};
 const pageSize=Number(owner.env.FT_OUTCOME_TRIAL_PAGE_SIZE),interval=Number(owner.env.FT_OUTCOME_TRIAL_DISCOVERY_INTERVAL_MS),lease=Number(owner.env.FT_OUTCOME_TRIAL_DISCOVERY_LEASE_MS);
 if(![pageSize,interval,lease,Number(owner.env.FT_OUTCOME_TRIAL_MAX_OBSERVATIONS)].every(pos)||pageSize>Number(owner.env.FT_OUTCOME_TRIAL_MAX_OBSERVATIONS)||!owner.env.FT_REPLAY_DB||typeof owner.ctx?.storage?.transaction!=='function')return {status:'INVALID_CONFIG'};
 const now=clock();if(!pos(now))return {status:'INVALID_CLOCK'};
 if(ftReplaySqlRemaining(owner)<1)return {status:'SQL_LIMIT_DEFERRED'};
 const token=crypto.randomUUID(),storage=owner.ctx.storage;
 let reserved;
 try{reserved=await storage.transaction(async tx=>{
  const paused=await tx.get('ft:replay:trial:pause:v1');
  if(paused?.epoch===owner.env.FT_REPLAY_TRIAL_EPOCH)return {status:'STORAGE_PAUSED'};
  const budget=await tx.get(OUTCOME_BUDGET_KEY);
  if(!budget||!pos(budget.start)||!pos(budget.end)||!pos(budget.max_calls)||!Number.isSafeInteger(budget.used)||budget.used<0||now<budget.start||now>=budget.end||budget.used>=budget.max_calls)return {status:'API_BUDGET_DENIED'};
  const previous=await tx.get(DISCOVERY_KEY);
  if(previous&&(previous.next_at>now||previous.lease_until>now))return {status:'NOT_DUE'};
  const cursor=typeof previous?.cursor==='string'?previous.cursor:'';
  await tx.put(DISCOVERY_KEY,{cursor,next_at:now+interval,lease_until:now+lease,token});
  return {status:'RESERVED',cursor};
 });}catch{return {status:'DISCOVERY_RESERVATION_FAILED'};}
 if(reserved.status!=='RESERVED')return reserved;
 let nextCursor=reserved.cursor,report;
 try{
  const pairMode=owner.env.FT_REPLAY_PAIR_TRIAL_ENABLED==='true';
  const response=await ftReplayQueryDB(owner).prepare(pairMode?PAIR_PAGE_SQL:PAGE_SQL).bind(reserved.cursor,pageSize).all();
  if(!Array.isArray(response.results)||response.results.length>pageSize)throw Error('INVALID_PAGE');
  const page=response.results,pending=[],incomplete=[],invalid=[];
  for(const row of page){
   const rowId=pairMode?row.observation_id:row.record_id;
   if(typeof rowId!=='string'||rowId<=nextCursor)throw Error('INVALID_CURSOR_ORDER');
   nextCursor=rowId;
   if(row.has_outcome)continue;
   try{
    if(pairMode){
     const verified=await verifyFTPairRow(row,{maxRecordBytes:Number(owner.env.FT_REPLAY_TRIAL_MAX_RECORD_BYTES)});
     if(verified.status!=='VALID_PAIR')throw Error(verified.reason);
     pending.push(verified.observation);
    }else{
     const observation=JSON.parse(row.payload_json);
     if(observation.id!==row.observation_id||observation.fixture_id!==row.fixture_id||observation.schema!=='FT_OBSERVATION_V1_DRAFT')throw Error('INVALID_OBSERVATION');
     pending.push(observation);if(!row.has_decision)incomplete.push(observation.id);
    }
   }catch{invalid.push(rowId);}
  }
  if(page.length===0)nextCursor=''; // Wrap on an empty page, bounded to one page query per pass.
  const result=pending.length?await runFTOutcomePass(owner,pending,{clock,source:pairMode?'PAIR_DISCOVERY_VALIDATED':'LEGACY_DISCOVERY'}):{status:'NO_PENDING_IN_PAGE',api_calls:0};
  return report={status:'PAGE_PROCESSED',ledger:pairMode?'PAIR':'LEGACY',page_rows:page.length,missing_decision:incomplete,invalid_rows:invalid,result};
 }catch{return report={status:'DISCOVERY_FAILED'};}
 finally{
  try{await storage.transaction(async tx=>{
   const current=await tx.get(DISCOVERY_KEY);
   if(current?.token===token){await tx.put(DISCOVERY_KEY,{...current,cursor:nextCursor,lease_until:0});if(report)report.cursor_persisted=true;}else if(report)report.cursor_persisted=false;
  });}catch{if(report)report.cursor_persisted=false;}
 }
}
