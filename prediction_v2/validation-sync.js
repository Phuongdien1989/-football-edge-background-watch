/* FOOTBALL EDGE — Prediction V2 / B7
 * Sync compact V2 evidence into existing validation_results via /api/db/sync.
 * Uses deterministic IDs + content signatures so unchanged rows are not re-written.
 */
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const stable=v=>{
  if(v===null||typeof v!=='object')return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(stable).join(',')+']';
  return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
};
function fnv1a(str){let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193)}return (h>>>0).toString(16).padStart(8,'0')}
export function evidenceSignature(row){return fnv1a(stable(row))}
function predPayload(r){
  const window_outcome=r?.outcome||null,{outcome:_drop,...base}=r||{};
  return {...base,window_outcome,id:r.id||`pv2:pred:${r.fixture_id}:${r.engine}:${r.captured_at}`,source:'PV2_PREDICTION',sample_type:'PV2_PREDICTION',
    outcome:window_outcome?.settled?(window_outcome?.goal_10m===true?'HIT':window_outcome?.goal_10m===false?'MISS':null):null,
    resolution:window_outcome?.settled?'RESOLVED':'OPEN'};
}
function pairPayload(r){
  return {...r,id:r.observation_id||r.id||`pv2:pair:${r.fixture_id}:${r.captured_at}`,source:'PV2_OLD_NEW',sample_type:'PV2_OLD_NEW',
    outcome:r.hit===1||r.hit===true?'HIT':r.hit===0||r.hit===false?'MISS':null,resolution:r.hit===0||r.hit===1||typeof r.hit==='boolean'?'RESOLVED':'OPEN'};
}
function paperPayload(r){
  return {...r,id:r.id||`pv2:paper:${r.fixture_id}:${r.captured_at}`,source:'PV2_PAPER_MARKET',sample_type:'PV2_PAPER_MARKET',
    outcome:r.settled?(r.realized_return>0?'WIN':r.realized_return<0?'LOSS':'PUSH'):null,resolution:r.settled?'RESOLVED':'OPEN'};
}
export function buildValidationEvents({prediction=[],paired=[],paper=[]}={}){
  return [
    ...(prediction||[]).map(r=>({type:'VALIDATION_RESULT',payload:predPayload(r)})),
    ...(paired||[]).map(r=>({type:'VALIDATION_RESULT',payload:pairPayload(r)})),
    ...(paper||[]).map(r=>({type:'VALIDATION_RESULT',payload:paperPayload(r)}))
  ];
}
export function changedEvents(events,hashes={},limit=60){
  const out=[];
  for(const evt of events||[]){
    const id=evt?.payload?.id;if(!id)continue;const sig=evidenceSignature(evt.payload);
    if(hashes[id]!==sig)out.push({...evt,__sig:sig});
    if(out.length>=limit)break;
  }
  return out;
}
export async function syncValidationEvents({events,hashes={},request,maxBatch=60}={}){
  if(typeof request!=='function')return {ok:false,skipped:true,reason:'NO_REQUEST',hashes};
  const changed=changedEvents(events,hashes,maxBatch);if(!changed.length)return {ok:true,skipped:true,reason:'NO_CHANGES',synced:0,hashes};
  const payload=changed.map(({__sig,...evt})=>evt);
  const res=await request('/api/db/sync',{method:'POST',body:{events:payload},timeout:15000});
  if(res?.ok!==true)throw new Error(res?.error||'PV2_D1_SYNC_FAILED');
  const next={...hashes};for(const evt of changed)next[evt.payload.id]=evt.__sig;
  const entries=Object.entries(next);if(entries.length>12000){entries.sort((a,b)=>String(a[0]).localeCompare(String(b[0])));return {ok:true,synced:changed.length,hashes:Object.fromEntries(entries.slice(-10000)),response:res}}
  return {ok:true,synced:changed.length,hashes:next,response:res};
}
export function parseValidationRows(rows=[]){
  const out={prediction:[],paired:[],paper:[]};
  for(const r of rows||[]){
    let p=null;try{p=typeof r?.payload_json==='string'?JSON.parse(r.payload_json):r?.payload_json}catch{}
    if(!p)continue;
    const legacy=!p.observation_id&&!p.observation;
    if(legacy){p.strict_metrics_eligible=false;p.strict_replay_status=p.strict_replay_status||'UNKNOWN_PROVENANCE';p.persistence_status=p.persistence_status||'UNVERIFIED';p.legacy_evidence=true}
    if(p.source==='PV2_PREDICTION')out.prediction.push({...p,outcome:p.window_outcome||p.outcome});
    else if(p.source==='PV2_OLD_NEW')out.paired.push(p);
    else if(p.source==='PV2_PAPER_MARKET')out.paper.push(p);
  }
  return out;
}