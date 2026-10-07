/* FOOTBALL EDGE — Prediction V2 / Batch 02
 * Strict observation/provenance contract.
 * IMPORTANT: captured_at/fresh_at are never promoted to received_at.
 * A source without a provable received_at is UNKNOWN_PROVENANCE and cannot enter strict replay metrics.
 */
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const stable=v=>{
  if(v===null||typeof v!=='object')return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(stable).join(',')+']';
  return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
};
function fnv1a(str){let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193)}return (h>>>0).toString(16).padStart(8,'0')}
export const UNKNOWN_PROVENANCE='UNKNOWN_PROVENANCE';
export const STRICT_VALID='STRICT_VALID';
export const AFTER_CUTOFF='AFTER_CUTOFF';
export const PERSISTENCE_UNVERIFIED='UNVERIFIED';
export const PERSISTENCE_ACKNOWLEDGED='ACKNOWLEDGED';

export function timestampMs(v){
  if(v===null||v===undefined||v==='')return null;
  if(typeof v==='number'&&Number.isFinite(v))return v>1e11?v:v*1000;
  const n=finite(v);if(n!=null&&String(v).trim()!==''&&!String(v).includes('-')&&!String(v).includes(':'))return n>1e11?n:n*1000;
  const t=Date.parse(v);return Number.isFinite(t)?t:null;
}
export function timestampIso(v){const t=timestampMs(v);return t==null?null:new Date(t).toISOString()}
export function normalizeMarketPeriod(v){
  const s=String(v??'').trim().toUpperCase().replace(/[\s_-]+/g,' ');
  if(!s)return null;
  if(['FT','FULL TIME','FULLTIME','MATCH','MATCH RESULT','90 MIN','90 MINUTES'].includes(s))return 'FT';
  if(['H1','1H','FIRST HALF','1ST HALF','HALF 1'].includes(s))return 'H1';
  if(['H2','2H','SECOND HALF','2ND HALF','HALF 2'].includes(s))return 'H2';
  return null;
}
export function marketPeriodForEngine(engine){const e=String(engine||'').toUpperCase();return e==='H1'?'H1':e==='H2'?'H2':e==='FT'||e==='HC'?'FT':null}

export function buildSourceReference({sourceId=null,kind=null,provider=null,endpoint=null,requestId=null,payloadHash=null,
  providerUpdatedAt=null,receivedAt=null,observedAt=null,required=true,metadata=null}={}){
  const received=timestampIso(receivedAt),providerUpdated=timestampIso(providerUpdatedAt),observed=timestampIso(observedAt);
  return {source_id:sourceId||requestId||payloadHash||null,kind:kind||null,provider:provider||null,endpoint:endpoint||null,
    request_id:requestId||null,payload_hash:payloadHash||null,provider_updated_at:providerUpdated,received_at:received,
    observed_at:observed,required:required!==false,provenance_status:received?STRICT_VALID:UNKNOWN_PROVENANCE,metadata:metadata||null};
}
export function sourceReplayStatus(ref,evaluationCutoff){
  const cut=timestampMs(evaluationCutoff),received=timestampMs(ref?.received_at);
  if(cut==null||received==null)return UNKNOWN_PROVENANCE;
  return received<=cut?STRICT_VALID:AFTER_CUTOFF;
}
export function filterSourcesAtCutoff(sourceRefs=[],evaluationCutoff){
  const accepted=[],rejected=[];
  for(const ref of sourceRefs||[]){
    const status=sourceReplayStatus(ref,evaluationCutoff),row={...ref,replay_status:status};
    if(status===STRICT_VALID)accepted.push(row);else rejected.push(row);
  }
  return {accepted,rejected};
}
export function observationInputFingerprint(input){return fnv1a(stable(input))}
function deepFreeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))deepFreeze(x)}return v}

export function buildObservationEnvelope({observationId=null,fixtureId,engine,marketPeriod=null,target=null,state={},evaluationCutoff,
  modelVersion='PREDICTION_V2_B2_B9',configVersion='UNVERSIONED_CONFIG',sourceRefs=[],predictionCreatedAt=Date.now(),persistedAt=null,persistenceAckId=null}={}){
  const fid=Number(fixtureId)||null,e=String(engine||'').toUpperCase()||null,period=normalizeMarketPeriod(marketPeriod)||marketPeriodForEngine(e),
    cutoff=timestampIso(evaluationCutoff),created=timestampIso(predictionCreatedAt),persisted=timestampIso(persistedAt),normalizedSources=(sourceRefs||[]).map(buildSourceReference)
      .sort((a,b)=>stable([a.kind,a.source_id,a.request_id,a.payload_hash,a.received_at]).localeCompare(stable([b.kind,b.source_id,b.request_id,b.payload_hash,b.received_at]))),
    replay=normalizedSources.map(r=>({...r,replay_status:sourceReplayStatus(r,cutoff)})),required=replay.filter(r=>r.required!==false),
    strictReplay=!!cutoff&&required.length>0&&required.every(r=>r.replay_status===STRICT_VALID),
    provenanceStatus=strictReplay?STRICT_VALID:(required.some(r=>r.replay_status===AFTER_CUTOFF)?AFTER_CUTOFF:UNKNOWN_PROVENANCE),
    input={fixture_id:fid,engine:e,market_period:period,target:target||null,state:{minute:finite(state?.minute),score_home:finite(state?.score_home),score_away:finite(state?.score_away),status:state?.status??null},
      evaluation_cutoff:cutoff,model_version:modelVersion,config_version:configVersion,source_references:replay};
  const fingerprint=observationInputFingerprint(input),oid=observationId||`pv2:obs:${fid}:${e||'NA'}:${period||'NA'}:${cutoff||created||'UNKNOWN'}:${fingerprint}`;
  return deepFreeze({schema:'FE_PV2_OBSERVATION_CONTRACT_V1',observation_id:oid,...input,input_fingerprint:fingerprint,
    prediction_created_at:created,persisted_at:persisted,persistence_status:persisted?PERSISTENCE_ACKNOWLEDGED:PERSISTENCE_UNVERIFIED,
    persistence_ack_id:persistenceAckId||null,strict_replay_status:provenanceStatus,strict_replay_eligible:strictReplay,
    strict_metrics_eligible:strictReplay&&!!persisted});
}
export function withPersistenceAcknowledgement(observation,{persistedAt,ackId=null}={}){
  if(!observation)return observation;const ts=timestampIso(persistedAt);if(!ts)return {...observation,persisted_at:null,persistence_status:PERSISTENCE_UNVERIFIED,persistence_ack_id:null,strict_metrics_eligible:false};
  return {...observation,persisted_at:ts,persistence_status:PERSISTENCE_ACKNOWLEDGED,persistence_ack_id:ackId||null,
    strict_metrics_eligible:observation.strict_replay_eligible===true};
}
export function strictMetricEligible(row){
  if(row?.strict_metrics_eligible===true)return true;
  if(row?.observation?.strict_metrics_eligible===true)return true;
  return false;
}
