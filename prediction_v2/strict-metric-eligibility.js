/* FOOTBALL EDGE — Prediction V2 / Batch 02.1 strict metric eligibility
 * Eligibility is derived from the evidence required by each metric.
 * A nested boolean cannot override a contradictory record-level veto or missing evidence.
 */
import {timestampMs,STRICT_VALID,PERSISTENCE_ACKNOWLEDGED,validatePersistenceAcknowledgement,sourceReplayStatus} from './observation-contract.js';
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const boolOutcome=v=>v===true||v===1||v==='1'?true:v===false||v===0||v==='0'?false:null;
function push(a,x){if(x&&!a.includes(x))a.push(x)}
function minReceived(refs=[]){const xs=(refs||[]).map(r=>timestampMs(r?.received_at)).filter(v=>v!=null);return xs.length?Math.min(...xs):null}
function baseObservation(row,{allowSyntheticServerAck=false}={}){
  const reasons=[],obs=row?.observation||null;if(row?.strict_metrics_eligible===false)push(reasons,'RECORD_EXPLICITLY_INELIGIBLE');
  if(!obs){push(reasons,'OBSERVATION_CONTRACT_MISSING');return {eligible:false,reasons,observation:null,persisted_ms:null}}
  if(row?.observation_id&&String(row.observation_id)!==String(obs.observation_id))push(reasons,'OBSERVATION_ID_MISMATCH');
  if(obs.strict_replay_status!==STRICT_VALID||obs.strict_replay_eligible!==true)push(reasons,obs.strict_replay_status||'OBSERVATION_REPLAY_NOT_STRICT');
  for(const ref of obs.source_references||[])if(ref?.required!==false&&sourceReplayStatus(ref,obs.evaluation_cutoff)!==STRICT_VALID)push(reasons,'SOURCE_NOT_STRICT_AT_CUTOFF');
  if(row?.input_fingerprint&&obs.input_fingerprint&&row.input_fingerprint!==obs.input_fingerprint)push(reasons,'INPUT_FINGERPRINT_MISMATCH');
  const ackValidation=validatePersistenceAcknowledgement(obs,obs.persistence_ack,{allowSyntheticServerAck});
  if(obs.persistence_status!==PERSISTENCE_ACKNOWLEDGED||!ackValidation.valid)for(const r of ackValidation.reasons.length?ackValidation.reasons:['PERSISTENCE_UNVERIFIED'])push(reasons,r);
  const persisted=timestampMs(obs.persisted_at);if(persisted==null)push(reasons,'PERSISTED_AT_MISSING');
  return {eligible:reasons.length===0,reasons,observation:obs,persisted_ms:persisted,ack_validation:ackValidation};
}
function recordPersistence(row,reasons,{allowSyntheticServerAck=false}={}){
  const v=validatePersistenceAcknowledgement(row,row?.persistence_ack,{allowSyntheticServerAck});if(row?.persistence_status!==PERSISTENCE_ACKNOWLEDGED||!v.valid)for(const r of v.reasons.length?v.reasons:['RECORD_PERSISTENCE_UNVERIFIED'])push(reasons,r);
  const persisted=timestampMs(row?.persisted_at);if(persisted==null)push(reasons,'RECORD_PERSISTED_AT_MISSING');return {persisted_ms:persisted,validation:v};
}
function assertBeforeOutcome(persisted,received,reasons){if(received==null)push(reasons,'OUTCOME_RECEIVED_AT_MISSING');else if(persisted!=null&&persisted>received)push(reasons,'PERSISTED_AFTER_OUTCOME_RECEIVED')}
export function predictionMetricEligibility(row,metric='goal_10m',options={}){
  const base=baseObservation(row,options),reasons=[...base.reasons],out=row?.outcome||{},we=out?.window_evidence?.[metric]||null,value=boolOutcome(out?.[metric]);
  if(row?.content_fingerprint&&base.observation?.content_fingerprint&&row.content_fingerprint!==base.observation.content_fingerprint)push(reasons,'CONTENT_FINGERPRINT_MISMATCH');
  if(out?.strict_outcome_eligible===false)push(reasons,'OUTCOME_EXPLICITLY_INELIGIBLE');
  if(value===null)push(reasons,'OUTCOME_UNRESOLVED');
  if(!we)push(reasons,'WINDOW_EVIDENCE_MISSING');
  else{if(we.model_target_compatible!==true)push(reasons,we.mismatch_reason||'MODEL_OUTCOME_HORIZON_MISMATCH');if(we.strict_provenance!==true)push(reasons,'OUTCOME_PROVENANCE_NOT_STRICT');if(we.metric_eligible!==true)push(reasons,'WINDOW_METRIC_INELIGIBLE')}
  const outcomeReceived=we?minReceived(we.refs):null;assertBeforeOutcome(base.persisted_ms,outcomeReceived,reasons);
  return {eligible:reasons.length===0,reasons,metric,value,outcome_received_at:outcomeReceived==null?null:new Date(outcomeReceived).toISOString()};
}
export function paperMetricEligibility(row,options={}){
  const base=baseObservation(row,options),reasons=[...base.reasons];if(row?.strict_metrics_eligible===false)push(reasons,'RECORD_EXPLICITLY_INELIGIBLE');
  if(row?.market_provenance_status!==STRICT_VALID)push(reasons,'MARKET_PROVENANCE_NOT_STRICT');
  const marketReceived=timestampMs(row?.received_at),cut=timestampMs(row?.evaluation_cutoff??base.observation?.evaluation_cutoff);if(marketReceived==null)push(reasons,'MARKET_RECEIVED_AT_MISSING');else if(cut!=null&&marketReceived>cut)push(reasons,'MARKET_AFTER_CUTOFF');
  const record=recordPersistence(row,reasons,options);
  if(row?.settled!==true)push(reasons,'SETTLEMENT_UNRESOLVED');if(String(row?.settlement_state||'').toUpperCase()==='VOID')push(reasons,'SETTLEMENT_VOID');
  if(row?.settlement_provenance_status!==STRICT_VALID)push(reasons,'SETTLEMENT_PROVENANCE_NOT_STRICT');
  const settlementReceived=timestampMs(row?.settlement_received_at);assertBeforeOutcome(record.persisted_ms,settlementReceived,reasons);
  return {eligible:reasons.length===0,reasons,settlement_received_at:settlementReceived==null?null:new Date(settlementReceived).toISOString()};
}
export function pairedMetricEligibility(row,options={}){
  const base=baseObservation(row,options),reasons=[...base.reasons];if(row?.strict_metrics_eligible===false)push(reasons,'RECORD_EXPLICITLY_INELIGIBLE');
  const record=recordPersistence(row,reasons,options);if(row?.old_evaluation_status!==STRICT_VALID)push(reasons,'OLD_EVALUATION_NOT_STRICT');if(row?.new_evaluation_status!==STRICT_VALID)push(reasons,'NEW_EVALUATION_NOT_STRICT');
  if(boolOutcome(row?.hit)===null)push(reasons,'PAIRED_OUTCOME_UNRESOLVED');if(row?.outcome_provenance_status!==STRICT_VALID)push(reasons,'PAIRED_OUTCOME_PROVENANCE_NOT_STRICT');
  const received=timestampMs(row?.outcome_received_at);assertBeforeOutcome(record.persisted_ms,received,reasons);
  return {eligible:reasons.length===0,reasons,outcome_received_at:received==null?null:new Date(received).toISOString()};
}
export function strictEligibility(row,{kind='prediction',metric='goal_10m',allowSyntheticServerAck=false}={}){
  if(kind==='paper')return paperMetricEligibility(row,{allowSyntheticServerAck});if(kind==='paired')return pairedMetricEligibility(row,{allowSyntheticServerAck});return predictionMetricEligibility(row,metric,{allowSyntheticServerAck});
}
