// Recorder-trial Worker hook only. Disabled without explicit trial configuration.
import {createPersistentCollector} from './persistent-collector.mjs';
import {createFTPairCollector} from './ft-pair-collector.mjs';
import {buildFTObservation} from './observation.mjs';
import {ftReplaySqlRemaining,ftReplayQueryDB} from './replay-sql-budget.mjs';
const states=new WeakMap();
const stagedPairs=new WeakMap();
const PAUSE_KEY='ft:replay:trial:pause:v1';
export async function recordFTScan(owner,scan){
 if(owner.env?.FT_REPLAY_TRIAL_ENABLED!=='true')return {status:'DISABLED'};
 if(scan.fixture?.fixture?.status?.short!=='2H')return {status:'OUT_OF_SCOPE'};
 // Clone before queuing, preserving the receipt-time evidence.
 let input;
 try{
  const sources={fixture:{status:'OK',received_at:scan.fixtureReceivedAt,data:scan.fixture}};
  for(const [raw,key] of [['stats','statistics'],['events','events'],['odds','odds'],['half','half_statistics']]){
   if(scan.receipts[raw]!=null)sources[key]={status:scan.health[raw],received_at:scan.receipts[raw],source_at:null,data:scan.payloads[raw]};
  }
  input=JSON.parse(JSON.stringify({id:scan.id,fixture_id:scan.fixture.fixture.id,decision_at:scan.capturedAt,fixture:scan.fixture,sources,model_version:null}));
 }catch{return {status:'INVALID_INPUT'};}
 if(owner.env?.FT_REPLAY_PAIR_TRIAL_ENABLED==='true'){
   let obs;try{obs=buildFTObservation(input);}catch{return {status:'INVALID_PAIR_OBSERVATION'};}
   let pending=stagedPairs.get(owner);if(!pending){pending=new Map();stagedPairs.set(owner,pending);}
   // One tick's working set; never evict/recreate historical evidence silently.
   if(pending.size>=12)return {status:'PAIR_STAGE_FULL'};
   pending.set(obs.id,obs);
   return {status:'PAIR_STAGED',observation_id:obs.id};
 }
 return persistFTRecord(owner,'OBSERVATION',input);
}
export async function persistFTRecord(owner,kind,payload){
 if(owner.env?.FT_REPLAY_TRIAL_ENABLED!=='true')return {status:'DISABLED'};
 const epoch=owner.env.FT_REPLAY_TRIAL_EPOCH;
 const maxRecordBytes=Number(owner.env.FT_REPLAY_TRIAL_MAX_RECORD_BYTES);
 if(typeof epoch!=='string'||!epoch||!Number.isSafeInteger(maxRecordBytes)||maxRecordBytes<=0||!owner.env.FT_REPLAY_DB)return {status:'INVALID_CONFIG'};
 let state=states.get(owner);
 if(!state||state.epoch!==epoch){state={epoch,paused:false,loaded:false,tail:Promise.resolve()};states.set(owner,state);}
 let input;try{input=structuredClone(payload);}catch{return {status:'INVALID_INPUT'};}
 const task=state.tail.then(async()=>{
  if(state.paused)return {status:'PAUSED',reason:state.reason};
  if(!state.loaded){
   try{
    const saved=await owner.ctx.storage.get(PAUSE_KEY);state.loaded=true;
    if(saved?.epoch===epoch){state.paused=true;state.reason=saved.reason;return {status:'PAUSED',reason:saved.reason};}
   }catch{state.paused=true;state.reason='PAUSE_READ_FAILED';return {status:'PAUSE_READ_FAILED'};}
  }
  if(ftReplaySqlRemaining(owner)<4)return {status:'SQL_LIMIT_DEFERRED',reason:'REPLAY_INVOCATION_BUDGET'};
  let result;
  try{result=await createPersistentCollector(ftReplayQueryDB(owner),{enabled:true,maxRecordBytes}).append(kind,input);}
  catch{result={status:'RECORDER_FAILED'};}
  if(['BUDGET_DENIED','BUDGET_UNAVAILABLE','RECORD_FAILED','RECORDER_FAILED'].includes(result.status)){
   state.paused=true;state.reason=result.status;
   try{await owner.ctx.storage.put(PAUSE_KEY,{epoch,reason:result.status,at:Date.now()});}
   catch{return {...result,pause_persisted:false};}
   return {...result,pause_persisted:true};
  }
  return result;
 });
 state.tail=task.catch(()=>{});
 return task;
}

 // Opt-in atomic-pair writer. Does not change the default legacy recorder.
export async function persistFTStagedPair(owner,decision){
 if(owner.env?.FT_REPLAY_TRIAL_ENABLED!=='true'||owner.env?.FT_REPLAY_PAIR_TRIAL_ENABLED!=='true')return {status:'DISABLED'};
 const pending=stagedPairs.get(owner),observation=pending?.get(decision?.observation_id);
 if(!observation)return {status:'PAIR_STAGE_MISSING'};
 pending.delete(decision.observation_id);
 const epoch=owner.env.FT_REPLAY_TRIAL_EPOCH,maxRecordBytes=Number(owner.env.FT_REPLAY_TRIAL_MAX_RECORD_BYTES);
 if(typeof epoch!=='string'||!epoch||!Number.isSafeInteger(maxRecordBytes)||maxRecordBytes<=0||!owner.env.FT_REPLAY_DB)return {status:'INVALID_CONFIG'};
 let state=states.get(owner);
 if(!state||state.epoch!==epoch){state={epoch,paused:false,loaded:false,tail:Promise.resolve()};states.set(owner,state);}
 let frozen;try{frozen=structuredClone(decision);}catch{return {status:'INVALID_PAIR'};}
 const task=state.tail.then(async()=>{
  if(state.paused)return {status:'PAUSED',reason:state.reason};
  if(!state.loaded){
   try{const saved=await owner.ctx.storage.get(PAUSE_KEY);state.loaded=true;
    if(saved?.epoch===epoch){state.paused=true;state.reason=saved.reason;return {status:'PAUSED',reason:saved.reason};}
   }catch{state.paused=true;state.reason='PAUSE_READ_FAILED';return {status:'PAUSE_READ_FAILED'};}
  }
  if(ftReplaySqlRemaining(owner)<3)return {status:'SQL_LIMIT_DEFERRED',reason:'PAIR_INVOCATION_BUDGET'};
  let result;
  try{result=await createFTPairCollector(ftReplayQueryDB(owner),{enabled:true,maxRecordBytes}).capture(observation,frozen);}
  catch{result={status:'PAIR_RECORDER_FAILED'};}
  if(['PAIR_BUDGET_DENIED','PAIR_BUDGET_UNAVAILABLE','PAIR_WRITE_UNCONFIRMED','PAIR_CONFLICT','PAIR_RECORDER_FAILED'].includes(result.status)){
   state.paused=true;state.reason=result.status;
   try{await owner.ctx.storage.put(PAUSE_KEY,{epoch,reason:result.status,at:Date.now()});}
   catch{return {...result,pause_persisted:false};}
   return {...result,pause_persisted:true};
  }
  return result;
 });
 state.tail=task.catch(()=>{});
 return task;
}
