// Recorder-trial Worker hook only. Disabled without explicit trial configuration.
import {createPersistentCollector} from './persistent-collector.mjs';
const states=new WeakMap();
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
  let result;
  try{result=await createPersistentCollector(owner.env.FT_REPLAY_DB,{enabled:true,maxRecordBytes}).append(kind,input);}
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
