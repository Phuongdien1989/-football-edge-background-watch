/* FOOTBALL EDGE — Prediction V2 / Batch 02.1
 * Strict observation / provenance / persistence contract.
 * IMPORTANT:
 * - captured_at/cache clocks are NEVER promoted to received_at.
 * - normalized source references are idempotent across JSON round-trips.
 * - conflicting camelCase/snake_case aliases are explicit, never silently resolved.
 * - persistence acknowledgement is a separate bound contract; client time alone is not proof.
 */
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const stable=v=>{
  if(v===undefined)return '"__UNDEFINED__"';
  if(v===null||typeof v!=='object')return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(stable).join(',')+']';
  return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
};
function fnv1a(str){let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193)}return (h>>>0).toString(16).padStart(8,'0')}
export const UNKNOWN_PROVENANCE='UNKNOWN_PROVENANCE';
export const CONFLICTING_PROVENANCE='CONFLICTING_PROVENANCE';
export const STRICT_VALID='STRICT_VALID';
export const AFTER_CUTOFF='AFTER_CUTOFF';
export const PERSISTENCE_UNVERIFIED='UNVERIFIED';
export const PERSISTENCE_ACKNOWLEDGED='ACKNOWLEDGED';
export const PERSISTENCE_MOCK='MOCK_ACK';
export const PERSISTENCE_INVALID='INVALID_ACK';
export const FINGERPRINT_ALGORITHM='FE_CANONICAL_FNV1A32_V1';

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
export function contentFingerprint(value){return `${FINGERPRINT_ALGORITHM}:${fnv1a(stable(value))}`}
export function observationInputFingerprint(input){return contentFingerprint(input)}

function hasOwn(o,k){return !!o&&Object.prototype.hasOwnProperty.call(o,k)}
function stringOrNull(v){if(v===null||v===undefined||String(v).trim()==='')return null;return String(v)}
function boolOrDefault(v,d=true){return v===undefined?d:v!==false}
function aliasValue(input,camel,snake,normalizer=x=>x){
  const hc=hasOwn(input,camel),hs=hasOwn(input,snake),cv=hc?normalizer(input[camel]):null,sv=hs?normalizer(input[snake]):null;
  if(hc&&hs&&cv!==sv)return {value:null,conflict:{field:snake,camel_key:camel,snake_key:snake,camel_value:cv,snake_value:sv}};
  return {value:hc?cv:hs?sv:null,conflict:null};
}
function sourceConflictStatus(conflicts,received){return conflicts.length?CONFLICTING_PROVENANCE:(received?STRICT_VALID:UNKNOWN_PROVENANCE)}
export function buildSourceReference(input={}){
  const conflicts=Array.isArray(input?.normalization_conflicts)?[...input.normalization_conflicts]:[];
  const sourceId=aliasValue(input,'sourceId','source_id',stringOrNull),requestId=aliasValue(input,'requestId','request_id',stringOrNull),
    payloadHash=aliasValue(input,'payloadHash','payload_hash',stringOrNull),providerUpdated=aliasValue(input,'providerUpdatedAt','provider_updated_at',timestampIso),
    received=aliasValue(input,'receivedAt','received_at',timestampIso),observed=aliasValue(input,'observedAt','observed_at',timestampIso);
  for(const x of [sourceId,requestId,payloadHash,providerUpdated,received,observed])if(x.conflict)conflicts.push(x.conflict);
  const required=hasOwn(input,'required')?input.required!==false:true;
  const sourceCandidates=[sourceId.value,requestId.value,payloadHash.value].filter(Boolean),sid=sourceCandidates[0]||null;
  const out={source_id:sid,kind:stringOrNull(input.kind),provider:stringOrNull(input.provider),endpoint:stringOrNull(input.endpoint),
    request_id:requestId.value,payload_hash:payloadHash.value,provider_updated_at:providerUpdated.value,received_at:received.value,observed_at:observed.value,
    required,provenance_status:sourceConflictStatus(conflicts,received.value),normalization_conflicts:conflicts,metadata:input.metadata??null};
  if(received.conflict)out.received_at_candidates=[received.conflict.camel_value,received.conflict.snake_value].filter(Boolean);
  return out;
}
export function sourceReplayStatus(ref,evaluationCutoff){
  const normalized=buildSourceReference(ref||{});if(normalized.provenance_status===CONFLICTING_PROVENANCE)return CONFLICTING_PROVENANCE;
  const cut=timestampMs(evaluationCutoff),received=timestampMs(normalized.received_at);
  if(cut==null||received==null)return UNKNOWN_PROVENANCE;
  return received<=cut?STRICT_VALID:AFTER_CUTOFF;
}
export function filterSourcesAtCutoff(sourceRefs=[],evaluationCutoff){
  const accepted=[],rejected=[];
  for(const raw of sourceRefs||[]){const ref=buildSourceReference(raw),status=sourceReplayStatus(ref,evaluationCutoff),row={...ref,replay_status:status};if(status===STRICT_VALID)accepted.push(row);else rejected.push(row)}
  return {accepted,rejected};
}

export function buildGoalWindowTarget({engine,minute,requested=[5,10,15]}={}){
  const e=String(engine||'').toUpperCase(),m=finite(minute),nominalEnd=e==='H1'?45:(e==='FT'||e==='HC'?90:null),windows={};
  for(const h0 of requested||[]){const h=finite(h0);if(h==null||h<=0)continue;const modelH=(m!=null&&nominalEnd!=null)?Math.max(0,Math.min(h,nominalEnd-m)):h;
    windows[`goal_${h}m`]={requested_horizon_min:h,outcome_time_basis:'MATCH_CLOCK_ELAPSED_INCLUDING_STOPPAGE',period_end_policy:'ACTUAL_CONFIRMED_PERIOD_END',
      model_horizon_min:modelH,model_horizon_basis:nominalEnd==null?'UNPROVEN':'B3_NOMINAL_REGULATION_CAP',model_target_compatible:modelH===h,
      mismatch_reason:modelH===h?null:'MODEL_HORIZON_TRUNCATED_AT_NOMINAL_PERIOD_BOUNDARY'};}
  return {kind:'ROLLING_NEXT_GOAL',engine:e||null,market_period:marketPeriodForEngine(e),requested_windows_min:(requested||[]).map(Number),
    outcome_time_basis:'MATCH_CLOCK_ELAPSED_INCLUDING_STOPPAGE',period_end_policy:'ACTUAL_CONFIRMED_PERIOD_END',model_horizon_contract:'B3_CURRENT_HORIZON_SEMANTICS',
    nominal_model_period_end_minute:nominalEnd,windows};
}
export function buildContentFingerprints({inputFingerprint=null,featurePacket=null,prediction=null}={}){
  const feature=contentFingerprint(featurePacket??null),pred=contentFingerprint(prediction??null),combined=contentFingerprint({input_fingerprint:inputFingerprint,feature_fingerprint:feature,prediction_fingerprint:pred});
  return {feature_fingerprint:feature,prediction_fingerprint:pred,content_fingerprint:combined,fingerprint_algorithm:FINGERPRINT_ALGORITHM};
}
function deepFreeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))deepFreeze(x)}return v}

export function buildObservationEnvelope({observationId=null,fixtureId,engine,marketPeriod=null,target=null,state={},evaluationCutoff,
  modelVersion='PREDICTION_V2_B2_B9',configVersion='UNVERSIONED_CONFIG',sourceRefs=[],predictionCreatedAt=Date.now(),persistedAt=null,persistenceAckId=null,
  featurePacket=null,predictionPayload=null}={}){
  const fid=Number(fixtureId)||null,e=String(engine||'').toUpperCase()||null,period=normalizeMarketPeriod(marketPeriod)||marketPeriodForEngine(e),
    cutoff=timestampIso(evaluationCutoff),created=timestampIso(predictionCreatedAt),normalizedSources=(sourceRefs||[]).map(buildSourceReference)
      .sort((a,b)=>stable([a.kind,a.source_id,a.request_id,a.payload_hash,a.received_at,a.provenance_status]).localeCompare(stable([b.kind,b.source_id,b.request_id,b.payload_hash,b.received_at,b.provenance_status]))),
    replay=normalizedSources.map(r=>({...r,replay_status:sourceReplayStatus(r,cutoff)})),required=replay.filter(r=>r.required!==false),
    strictReplay=!!cutoff&&required.length>0&&required.every(r=>r.replay_status===STRICT_VALID),
    provenanceStatus=strictReplay?STRICT_VALID:(required.some(r=>r.replay_status===CONFLICTING_PROVENANCE)?CONFLICTING_PROVENANCE:(required.some(r=>r.replay_status===AFTER_CUTOFF)?AFTER_CUTOFF:UNKNOWN_PROVENANCE)),
    minute=finite(state?.minute),resolvedTarget=target||buildGoalWindowTarget({engine:e,minute}),
    input={fixture_id:fid,engine:e,market_period:period,target:resolvedTarget,state:{minute,score_home:finite(state?.score_home),score_away:finite(state?.score_away),status:state?.status??null,match_clock:state?.match_clock??null},
      evaluation_cutoff:cutoff,model_version:modelVersion,config_version:configVersion,source_references:replay},
    inputFp=observationInputFingerprint(input),fps=buildContentFingerprints({inputFingerprint:inputFp,featurePacket,prediction:predictionPayload}),
    oid=observationId||`pv2:obs:${fid}:${e||'NA'}:${period||'NA'}:${cutoff||created||'UNKNOWN'}:${fps.content_fingerprint}`;
  const legacyPersisted=timestampIso(persistedAt),legacyAck=stringOrNull(persistenceAckId);
  return deepFreeze({schema:'FE_PV2_OBSERVATION_CONTRACT_V2',observation_id:oid,...input,input_fingerprint:inputFp,...fps,
    prediction_created_at:created,persisted_at:legacyPersisted,persistence_status:PERSISTENCE_UNVERIFIED,persistence_ack_id:legacyAck,
    persistence_ack:null,persistence_note:(legacyPersisted||legacyAck)?'LEGACY_PERSISTENCE_FIELDS_PRESENT_BUT_NOT_ACK_VERIFIED':null,
    strict_replay_status:provenanceStatus,strict_replay_eligible:strictReplay,strict_metrics_eligible:false});
}

export function buildPersistenceAcknowledgement(input={}){
  const subject=input.subject||null,
    subjectId=aliasValue(input,'subjectId','subject_id',stringOrNull),fp=aliasValue(input,'contentFingerprint','content_fingerprint',stringOrNull),
    persisted=aliasValue(input,'persistedAt','persisted_at',timestampIso),ackId=aliasValue(input,'ackId','ack_id',stringOrNull),
    origin=aliasValue(input,'ackOrigin','ack_origin',v=>String(v??'MOCK').toUpperCase()),verified=aliasValue(input,'serverVerified','server_verified',v=>v===true),
    conflicts=[subjectId,fp,persisted,ackId,origin,verified].filter(x=>x.conflict).map(x=>x.conflict),sid=subjectId.value??subject?.observation_id??subject?.id??null,content=fp.value??subject?.content_fingerprint??null;
  return {schema:'FE_PV2_PERSISTENCE_ACK_V1',ack_id:ackId.value,subject_id:stringOrNull(sid),content_fingerprint:stringOrNull(content),persisted_at:persisted.value,
    source:stringOrNull(input.source),ack_origin:origin.value||'MOCK',server_verified:verified.value===true,normalization_conflicts:conflicts,metadata:input.metadata??null};
}
export function validatePersistenceAcknowledgement(subject,ack,{allowSyntheticServerAck=false}={}){
  const reasons=[],a=ack||{},sid=subject?.observation_id??subject?.id??null,fp=subject?.content_fingerprint??null,created=timestampMs(subject?.prediction_created_at??subject?.captured_at),persisted=timestampMs(a?.persisted_at);
  if(a?.schema!=='FE_PV2_PERSISTENCE_ACK_V1')reasons.push('ACK_SCHEMA_INVALID');
  if(!a?.ack_id)reasons.push('ACK_ID_MISSING');
  if(!a?.subject_id||String(a.subject_id)!==String(sid||''))reasons.push('ACK_SUBJECT_MISMATCH');
  if(!a?.content_fingerprint||String(a.content_fingerprint)!==String(fp||''))reasons.push('ACK_CONTENT_FINGERPRINT_MISMATCH');
  if(persisted==null)reasons.push('ACK_PERSISTED_AT_INVALID');
  if(created!=null&&persisted!=null&&persisted<created)reasons.push('ACK_BEFORE_PREDICTION_CREATED');
  if(!a?.source)reasons.push('ACK_SOURCE_MISSING');
  const origin=String(a?.ack_origin||'').toUpperCase();if(origin==='MOCK')reasons.push('MOCK_ACK_NOT_STRICT');else if(origin!=='SERVER')reasons.push('ACK_ORIGIN_INVALID');
  if(origin==='SERVER'&&a?.server_verified!==true&&!allowSyntheticServerAck)reasons.push('SERVER_ACK_NOT_VERIFIED');
  return {valid:reasons.length===0,reasons,ack_origin:origin,persisted_at:timestampIso(a?.persisted_at),ack_id:a?.ack_id||null};
}
export function withPersistenceAcknowledgement(subject,ack,options={}){
  if(!subject)return subject;const normalized=buildPersistenceAcknowledgement({...ack,subject,subjectId:ack?.subject_id??subject?.observation_id??subject?.id,contentFingerprint:ack?.content_fingerprint??subject?.content_fingerprint}),
    v=validatePersistenceAcknowledgement(subject,normalized,options),mock=normalized.ack_origin==='MOCK';
  return {...subject,persisted_at:normalized.persisted_at,persistence_ack_id:normalized.ack_id,persistence_ack:normalized,
    persistence_status:v.valid?PERSISTENCE_ACKNOWLEDGED:(mock?PERSISTENCE_MOCK:PERSISTENCE_INVALID),persistence_validation:v,
    strict_metrics_eligible:subject?.strict_metrics_eligible===false?false:null};
}
export function strictMetricEligible(row){return row?.strict_metrics_eligible===true}
