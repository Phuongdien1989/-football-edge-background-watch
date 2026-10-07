/* FOOTBALL EDGE — Prediction V2 / B3 + Batch 02 provenance contract
 * Compact evidence journal for shadow predictions. No production D1 schema change required.
 * captured_at remains for legacy compatibility, but it is NEVER treated as source received_at.
 */
import {buildObservationEnvelope,marketPeriodForEngine} from './observation-contract.js';
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const round=(v,d=3)=>{const n=finite(v);if(n==null)return null;const p=10**d;return Math.round(n*p)/p};
function defaultTarget(engine,period){return {kind:'SHADOW_GOAL_AND_PERIOD_DISTRIBUTION',engine:String(engine||'').toUpperCase()||null,market_period:period||null,goal_windows_min:[5,10,15],period_distribution:period?{period,basis:'POISSON_REMAINING'}:null}}
export function compactShadowEvidence({item,packet,prediction,context=null,now=Date.now(),sourceRefs=[],marketPeriod=null,target=null,
  evaluationCutoff=null,modelVersion='PREDICTION_V2_B2_B9',configVersion='UNVERSIONED_CONFIG',persistedAt=null,persistenceAckId=null}={}){
  const s=item?.latest||{},p=prediction?.probabilities||{},engine=packet?.engine||null,period=marketPeriod||marketPeriodForEngine(engine),
    state={minute:finite(s.minute??packet?.state?.minute),score_home:finite(s?.goals?.home??packet?.state?.score_home),
      score_away:finite(s?.goals?.away??packet?.state?.score_away),status:s?.status??packet?.state?.status??null},
    observation=buildObservationEnvelope({fixtureId:Number(item?.id??packet?.fixture_id)||null,engine,marketPeriod:period,target:target||defaultTarget(engine,period),state,
      evaluationCutoff:evaluationCutoff??now,modelVersion,configVersion,sourceRefs,predictionCreatedAt:now,persistedAt,persistenceAckId});
  return {
    schema:'FE_PREDICTION_V2_EVIDENCE_B10',id:observation.observation_id,observation_id:observation.observation_id,
    fixture_id:observation.fixture_id,engine:observation.engine,market_period:observation.market_period,captured_at:now,
    evaluation_cutoff:observation.evaluation_cutoff,prediction_created_at:observation.prediction_created_at,persisted_at:observation.persisted_at,
    persistence_status:observation.persistence_status,strict_replay_status:observation.strict_replay_status,
    strict_replay_eligible:observation.strict_replay_eligible,strict_metrics_eligible:observation.strict_metrics_eligible,
    observation,
    minute:state.minute,score_home:state.score_home,score_away:state.score_away,status:state.status,
    p_goal_5m:finite(p.goal_5m),p_goal_10m:finite(p.goal_10m),p_goal_15m:finite(p.goal_15m),p_home_next:finite(p.home_next_goal_given_goal),
    confidence:finite(prediction?.confidence?.score_100),confidence_band:prediction?.confidence?.band||null,live_index:finite(prediction?.live_update?.index),
    hazard_multiplier:finite(prediction?.live_update?.hazard_multiplier),base_lambda:finite(prediction?.base?.lambda_match),
    base_source:prediction?.base?.source||null,dq:round(packet?.quality?.dq,3),score_mode:packet?.quality?.score_mode||null,
    context_present:!!context,market_used:false,
    outcome:{revision:0,goal_5m:null,goal_10m:null,goal_15m:null,first_goal_min:null,first_goal_interval:null,settled:false,status:'OPEN',provenance_status:'UNRESOLVED',history:[]}
  };
}
export function shouldRecordShadow(prev,next,{minIntervalMs=60000,probabilityDeltaPct=3,confidenceDelta=8}={}){
  if(!prev)return true;
  if(Number(prev.fixture_id)!==Number(next.fixture_id)||String(prev.engine)!==String(next.engine)||String(prev.market_period)!==String(next.market_period))return true;
  const dt=Number(next.captured_at)-Number(prev.captured_at);
  if(dt>=minIntervalMs)return true;
  if(Number(prev.score_home)!==Number(next.score_home)||Number(prev.score_away)!==Number(next.score_away))return true;
  if(Math.abs((Number(next.p_goal_10m)||0)-(Number(prev.p_goal_10m)||0))>=probabilityDeltaPct)return true;
  if(Math.abs((Number(next.confidence)||0)-(Number(prev.confidence)||0))>=confidenceDelta)return true;
  return false;
}
/* Legacy B3 resolver retained only for backward test compatibility.
 * Batch 02 strict runtime must use strict-outcome-resolver.js instead.
 */
export function settleShadowEvidence(row,snapshot,{ended=false}={}){
  if(!row||row.outcome?.settled)return row;
  const s=snapshot||{},minute=finite(s.minute),goals=(finite(s?.goals?.home)||0)+(finite(s?.goals?.away)||0),
    start=(finite(row.score_home)||0)+(finite(row.score_away)||0),out={...(row.outcome||{})};
  if(goals>start&&out.first_goal_min==null)out.first_goal_min=minute??row.minute;
  for(const h of [5,10,15]){
    const k=`goal_${h}m`;
    if(out[k]==null){
      if(out.first_goal_min!=null)out[k]=(Number(out.first_goal_min)-Number(row.minute))<=h;
      else if(minute!=null&&minute>=Number(row.minute)+h)out[k]=false;
    }
  }
  if(ended){for(const h of [5,10,15])if(out[`goal_${h}m`]==null)out[`goal_${h}m`]=false;out.settled=true}
  else if([5,10,15].every(h=>typeof out[`goal_${h}m`]==='boolean'))out.settled=true;
  return {...row,outcome:out};
}