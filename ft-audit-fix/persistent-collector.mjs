// Staged, opt-in collector; no schema provisioning, reset, provider calls or automatic retries.
import {buildFTObservation} from './observation.mjs';
import {prepareRecord,appendRecord} from './replay-ledger.mjs';
export const RESERVE_SQL=`UPDATE ft_replay_budget_v1
 SET used_records=used_records+1,used_bytes=used_bytes+?1,last_at=?2
 WHERE id=1 AND window_start<=?2 AND ?2<window_end AND last_at<=?2
 AND used_records<max_records AND ?1<=max_bytes-used_bytes
 RETURNING used_records,used_bytes,window_end`;
export function createPersistentCollector(db,{enabled=false,maxRecordBytes,clock=Date.now}={}){
 if(enabled&&(!Number.isSafeInteger(maxRecordBytes)||maxRecordBytes<=0))throw Error('EXPLICIT_RECORD_LIMIT_REQUIRED');
 async function append(kind,input){
  if(!enabled)return {status:'DISABLED'};
  let observation,record;
  try{
   observation=kind==='OBSERVATION'?buildFTObservation(input):input;
   record=await prepareRecord(kind,observation,maxRecordBytes);
  }catch{return {status:'INVALID_RECORD'};}
  const now=clock();
  if(!Number.isSafeInteger(now)||now<=0||record.recorded_at>now)return {status:'INVALID_CLOCK'};
  let reserved;
  try{reserved=await db.prepare(RESERVE_SQL).bind(record.bytes,now).first();}
  catch{return {status:'BUDGET_UNAVAILABLE'};}
  if(!reserved)return {status:'BUDGET_DENIED'};
  // Reservation remains consumed on crash, duplicate, write failure or ambiguous timeout.
  // Never refund automatically: a write may have committed despite a lost response.
  try{
   const result=await appendRecord(db,kind,observation,{enabled:true,maxBytes:maxRecordBytes});
   return {...result,budget_reserved:true,reserved_bytes:record.bytes};
  }catch{return {status:'RECORD_FAILED',budget_reserved:true,reserved_bytes:record.bytes};}
 }
 return {capture:input=>append('OBSERVATION',input),append};
}
