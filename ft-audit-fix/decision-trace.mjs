import {resolveFTOutcome} from './outcome.mjs';
import {persistFTRecord,persistFTStagedPair} from './worker-recorder.mjs';
const time=x=>Number.isSafeInteger(x)&&x>0;
export function buildFTDecision({observation,decision_at,state,reason=null,evaluation=null,market_rows=null,devices=[],source_hash}){
 if(!observation||typeof observation.id!=='string'||!observation.id||!Number.isSafeInteger(observation.fixture_id)||observation.fixture_id<=0||!time(observation.decision_at)||!time(decision_at)||decision_at<observation.decision_at)throw Error('INVALID_DECISION_LINK');
 if(!['EVALUATED','NOT_EVALUATED','ERROR'].includes(state)||!/^[a-f0-9]{64}$/.test(source_hash))throw Error('INVALID_DECISION_PROVENANCE');
 if(state!=='EVALUATED'&&evaluation!==null)throw Error('STALE_EVALUATION_REJECTED');
 return structuredClone({schema:'FT_DECISION_V1_DRAFT',observation_id:observation.id,fixture_id:observation.fixture_id,decision_at,input_at:observation.decision_at,state,reason,evaluation,market_rows,devices,source_hash,
  scope:'BACKEND_FT_EVALUATION_AND_CROSSING',top_rank:null,frontend_recommendation:null,push_delivery:'NOT_OBSERVED'});
}
export async function recordFTDecision(owner,input){
 if(owner.env?.FT_REPLAY_TRIAL_ENABLED!=='true')return {status:'DISABLED'};
 let decision;try{decision=buildFTDecision(input);}catch{return {status:'INVALID_DECISION'};}
 if(owner.env.FT_REPLAY_PAIR_TRIAL_ENABLED==='true')return persistFTStagedPair(owner,decision);
 return persistFTRecord(owner,'DECISION',decision);
}
export function linkFTReplay(observation,decision,outcome){
 if(!observation||!decision||!outcome||decision.schema!=='FT_DECISION_V1_DRAFT'||outcome.schema!=='FT_OUTCOME_V2_DRAFT'||outcome.state!=='RESOLVED'||decision.observation_id!==observation.id||outcome.observation_id!==observation.id||decision.fixture_id!==observation.fixture_id||outcome.fixture_id!==observation.fixture_id)throw Error('REPLAY_IDENTITY_MISMATCH');
 if(!time(observation.decision_at)||!time(decision.decision_at)||!time(outcome.observed_at)||decision.input_at!==observation.decision_at||decision.decision_at<observation.decision_at||outcome.observed_at<decision.decision_at)throw Error('REPLAY_TIME_MISMATCH');
 if(!['FT','AET','PEN'].includes(outcome.status))throw Error('REPLAY_NOT_FINAL_REGULATION');
 return structuredClone({observation,decision,outcome,market_settlement:null,forecast_validation:'NOT_COMPUTED'});
}
export async function recordFTOutcome(owner,observation,fixture,receivedAt,now=Date.now()){
 if(owner.env?.FT_REPLAY_TRIAL_ENABLED!=='true')return {status:'DISABLED'};
 const outcome=resolveFTOutcome(observation,fixture,receivedAt,now);
 if(outcome.state!=='RESOLVED')return outcome;
 return persistFTRecord(owner,'OUTCOME',outcome);
}
