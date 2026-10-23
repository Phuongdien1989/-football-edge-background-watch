// Launches only from callbacks of provider requests the existing scanner
// ALREADY made. All D1/DO operations happen AFTER the legacy Push decision
// path inside waitUntil. No new fetch, timers, retries or scanner controls.
import {createFTPilotRecorder} from './recorder.mjs';
const SCAN_BUDGET=60; // max FT-sidecar D1 requests per entire pilot epoch
const WRITE_TOKEN_BUDGET=240; // 15 candidate inserts * 16 billed rows each; includes index amplification tolerance
const KEY=e=>'ft:pilot:v1:'+e+':';
const passive=Object.freeze({status:'DISABLED',d1_queries:0,provider_calls:0});
export function scheduleFTPilot(owner,{kind,scan,fixture,receivedAt}={}){
 if(owner?.env?.FT_PILOT_ENABLED!=='true')return passive;
 const env=owner.env,epoch=env.FT_PILOT_EPOCH;
 if(typeof epoch!=='string'||epoch.length<8||epoch.length>80||
 !owner?.env?.FT_PILOT_DB||typeof owner?.ctx?.waitUntil!=='function'||
 !owner?.ctx?.storage?.transaction)return {status:'NOT_SCHEDULED_MISSING_ISOLATED_FT_CONFIG'};
 if(kind!=='PAIR'&&kind!=='OUTCOME')return {status:'NOT_SCHEDULED_INVALID_KIND'};
 const id=kind==='PAIR'?scan?.fixture?.fixture?.id:fixture?.fixture?.id;
 const status=kind==='PAIR'?scan?.fixture?.fixture?.status?.short:fixture?.fixture?.status?.short;
 if(!Number.isSafeInteger(id)||id<=0||kind==='PAIR'&&status!=='2H'||
 kind==='OUTCOME'&&!['FT','AET','PEN'].includes(status))
  return {status:'NOT_SCHEDULED_OUT_OF_SCOPE'};
 const storage=owner.ctx.storage;
 // waitUntil registered synchronously; the caller does not await it and its
 // existing scan/Push results cannot be turned into an FT recorder exception.
 let waitUntilAttached=false;
 const task=Promise.resolve().then(async()=>{
  if(!waitUntilAttached)return {status:'FT_WAITUNTIL_NOT_ATTACHED'};
  const prefix=KEY(epoch),pauseKey=prefix+'paused',doneKey=prefix+'seen:'+id+':'+kind;
  try{
   if(await storage.get(pauseKey))return {status:'FT_PILOT_PAUSED'};
   if(await storage.get(doneKey))return {status:'ALREADY_AUDITED_THIS_EPOCH'};
   const reserve=await storage.transaction(async tx=>{
    const key=prefix+'sql-budget',x=await tx.get(key)||{used:0,reserved_writes:0};
    if(!Number.isSafeInteger(x.used)||x.used<0||
      !Number.isSafeInteger(x.reserved_writes)||x.reserved_writes<0||
      x.used+3>SCAN_BUDGET||x.reserved_writes+16>WRITE_TOKEN_BUDGET)
      return {allowed:false,used:x.used,reserved_writes:x.reserved_writes};
    await tx.put(key,{used:x.used+3,reserved_writes:x.reserved_writes+16}); // no refunds
    return {allowed:true,used:x.used+3,reserved_writes:x.reserved_writes+16};
   });
   if(!reserve.allowed){
    await storage.put(pauseKey,{reason:'FT_SQL_OR_WRITE_TOKEN_TOTAL_CAP',at:Date.now()});
    return {status:'FT_PILOT_SQL_CAP'};
   }
   const log=result=>{
    // bounded status only; never publish real source odds or API credentials.
    const minimal={id,status:result.status,kind,class:result.class??null,
      billed_rows_written:result.billed_rows_written??null,billed_rows_read:result.reported_rows_read??null,
      sql_requests:result.sql_requests,sql_metrics_unverified:result.sql_metrics_unverified??true};
    try{console.log('FE_FT_PILOT_AUDIT '+JSON.stringify(minimal));}catch{}
   };
   const recorder=createFTPilotRecorder({
    env,db:env.FT_PILOT_DB,audit:log,
    maxSqlPerInvocation:3,
    durablePause:async p=>storage.put(pauseKey,{reason:p.reason,at:Date.now()})
   });
   const result=kind==='PAIR'?await recorder.capture(scan):await recorder.outcome(fixture,receivedAt);
   // Persist confirmed selection or definitive skip to avoid repeated FT D1
   // lookups during ordinary 30s legacy scanner ticks and across DO restart.
   const terminalPair=result.status==='PAIR_STORED'||
    result.status==='SKIPPED_EXISTING_FIXTURE'||result.status.startsWith('SKIPPED_');
   const terminalOutcome=['OUTCOME_STORED','OUTCOME_REVISION_LIMIT','OUTCOME_NO_SELECTED_PAIR'].includes(result.status);
   // OUTCOME_STORED is not final: corrections may later arrive. Never mark its
   // fixture as final until revision 2 or explicit stop-window.
   if(terminalPair||terminalOutcome&&result.status!=='OUTCOME_STORED')
    await storage.put(doneKey,{status:result.status,at:Date.now()});
   if(result.status==='D1_ERROR_PAUSED'||result.status==='BILLING_UNVERIFIED_PAUSED'||
    result.status==='WRITE_AMPLIFICATION_PAUSED')
    await storage.put(pauseKey,{reason:result.status,at:Date.now()});
   return {status:result.status};
  }catch(e){
   try{await storage.put(pauseKey,{reason:'FT_SIDE_CAR_ERROR',at:Date.now()});}catch{}
   try{console.log('FE_FT_PILOT_AUDIT '+JSON.stringify({id,kind,status:'FT_SIDE_CAR_ERROR'}));}catch{}
   return {status:'FT_SIDE_CAR_ERROR'};
  }
 });
 try{owner.ctx.waitUntil(task.catch(()=>{}));waitUntilAttached=true;return {status:'SCHEDULED_NON_BLOCKING'};}
 catch{return {status:'FT_WAITUNTIL_UNAVAILABLE'};}
}
