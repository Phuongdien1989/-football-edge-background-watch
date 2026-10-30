// STAGED proof-of-concept only: one immutable D1 row per observation+decision.
// It is NOT wired to outcome discovery, production or FT pricing.
// A budget reservation may be lost on crash; the PAIR row itself is all-or-nothing.
import {prepareRecord} from './replay-ledger.mjs';
import {RESERVE_SQL} from './persistent-collector.mjs';
export const PAIR_INSERT_SQL='INSERT INTO ft_replay_pairs_v1 (observation_id,fixture_id,observed_at,decision_at,content_hash,observation_json,decision_json) VALUES (?,?,?,?,?,?,?) ON CONFLICT(observation_id) DO NOTHING';
export const PAIR_READ_SQL='SELECT content_hash FROM ft_replay_pairs_v1 WHERE observation_id=?';
function validTime(x){return Number.isSafeInteger(x)&&x>0;}
export async function prepareFTPair(observation,decision,maxRecordBytes){
 const a=await prepareRecord('OBSERVATION',observation,maxRecordBytes),b=await prepareRecord('DECISION',decision,maxRecordBytes);
 if(b.observation_id!==a.observation_id||b.fixture_id!==a.fixture_id||!validTime(decision.input_at)||
   decision.input_at!==observation.decision_at||decision.decision_at<observation.decision_at||
   (decision.state!=='EVALUATED'&&decision.evaluation!=null)||
   !/^[a-f0-9]{64}$/.test(decision.source_hash||''))throw Error('PAIR_INTEGRITY_ERROR');
 // Canonical, immutable components prepared from exactly the evidence passed to the recorder.
 const hashInput=new TextEncoder().encode(a.content_hash+':'+b.content_hash);
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',hashInput)),x=>x.toString(16).padStart(2,'0')).join('');
 const bytes=a.bytes+b.bytes;
 if(bytes>maxRecordBytes)throw Error('PAIR_TOO_LARGE');
 return {observation_id:a.observation_id,fixture_id:a.fixture_id,observed_at:a.recorded_at,decision_at:b.recorded_at,content_hash:digest,observation_json:a.payload_json,decision_json:b.payload_json,bytes};
}
export function createFTPairCollector(db,{enabled=false,maxRecordBytes,clock=Date.now}={}){
 if(enabled&&(!Number.isSafeInteger(maxRecordBytes)||maxRecordBytes<1))throw Error('EXPLICIT_PAIR_RECORD_LIMIT_REQUIRED');
 return {async capture(observation,decision){
  if(!enabled)return {status:'DISABLED'};
  let pair;
  try{pair=await prepareFTPair(observation,decision,maxRecordBytes);}catch(e){return {status:'INVALID_PAIR',reason:e.message};}
  const now=clock();
  if(!validTime(now)||pair.decision_at>now)return {status:'INVALID_PAIR_CLOCK'};
  let reserved;
  try{reserved=await db.prepare(RESERVE_SQL).bind(pair.bytes,now).first();}
  catch{return {status:'PAIR_BUDGET_UNAVAILABLE'};}
  if(!reserved)return {status:'PAIR_BUDGET_DENIED'};
  // Reservation is deliberately not refunded on failure, collision, timeout or duplicate.
  // A non-committed pair has no partial observation or partial decision row.
  try{
   const inserted=await db.prepare(PAIR_INSERT_SQL).bind(pair.observation_id,pair.fixture_id,pair.observed_at,pair.decision_at,pair.content_hash,pair.observation_json,pair.decision_json).run();
   const confirmed=await db.prepare(PAIR_READ_SQL).bind(pair.observation_id).first();
   if(confirmed?.content_hash!==pair.content_hash)return {status:'PAIR_CONFLICT',budget_reserved:true};
   return {status:inserted.meta?.changes===0?'PAIR_DUPLICATE':'PAIR_STORED',budget_reserved:true,sql_attempts:3,bytes:pair.bytes,reported_rows_written:inserted.meta?.rows_written??null};
  }catch{return {status:'PAIR_WRITE_UNCONFIRMED',budget_reserved:true};}
 }};
}
