// Offline FT V2 binary Over calibration. NO API, no fake labels, no training on future.
import {number,validatePMF} from './core.mjs';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const n=x=>number(x);
export function auditFTCalibration(rows,{minSamples=30}={}){
 if(!Array.isArray(rows)||!Number.isSafeInteger(minSamples)||minSamples<2)throw Error('INVALID_INPUT');
 const valid=[],excluded=[],seen=new Set();
 for(const [index,r] of rows.entries()){
  const id=r?.fixture_id,at=r?.decision_at,received=r?.outcome_received_at,
   final=r?.final_score,pre=r?.score,pmf=r?.remaining_goals_pmf;
  let reason=null;
  if(!Number.isSafeInteger(id)||id<=0||!Number.isSafeInteger(at)||at<=0)reason='INVALID_ID_TIME';
  else if(seen.has(id))reason='DUPLICATE_FIXTURE';
  else if(!Number.isSafeInteger(received)||received<at)reason='OUTCOME_NOT_AFTER_DECISION';
  else if(!Number.isInteger(pre?.home)||!Number.isInteger(pre?.away)||pre.home<0||pre.away<0)reason='INVALID_DECISION_SCORE';
  else if(!Number.isInteger(final?.home)||!Number.isInteger(final?.away)||final.home<0||final.away<0)reason='MISSING_REGULATION_FINAL';
  else if(final.home+final.away<pre.home+pre.away)reason='GOAL_TOTAL_REVERSED';
  else if(!validatePMF(pmf))reason='MISSING_VALID_DECISION_PMF';
  else if(r?.model_generated_at!==at)reason='MODEL_ASOF_MISMATCH';
  else if(r?.source_received_at>at||!Number.isSafeInteger(r?.source_received_at))reason='FUTURE_OR_UNKNOWN_SOURCE';
  else if(!finite(r?.line)||Math.abs((r.line-Math.floor(r.line))-.5)>1e-8)reason='NON_BINARY_LINE';
  else if(!finite(r?.market_odds)||r.market_odds<=1)reason='UNVERIFIED_MARKET_ODDS';
  else if(r?.settlement_basis!=='FULL_MATCH_REGULATION')reason='SETTLEMENT_UNVERIFIED';
  else if(!Array.isArray(r?.observed_stats)||r.observed_stats.some(v=>!Number.isSafeInteger(v?.received_at)||v.received_at>at))reason='FUTURE_OR_UNKNOWN_STATS';
  if(reason){excluded.push({index,fixture_id:Number.isSafeInteger(id)?id:null,reason});continue;}
  seen.add(id);
  const additionalNeeded=Math.max(0,Math.floor(r.line)+1-(pre.home+pre.away));
  const predicted=additionalNeeded===0?1:pmf.slice(additionalNeeded).reduce((a,b)=>a+b,0);
  const outcome=(final.home+final.away)>r.line?1:0;
  if(!(predicted>=0&&predicted<=1)){excluded.push({index,fixture_id:id,reason:'INVALID_PREDICTION'});continue;}
  valid.push({fixture_id:id,decision_at:at,prediction:predicted,outcome,
   brier:(predicted-outcome)**2,logLoss:-(outcome*Math.log(Math.max(1e-12,predicted))+(1-outcome)*Math.log(Math.max(1e-12,1-predicted))),
   estimated_ev:predicted*r.market_odds-1,odds:r.market_odds});
 }
 const avg=k=>valid.length?valid.reduce((s,v)=>s+v[k],0)/valid.length:null;
 const buckets=[[0,.25],[.25,.5],[.5,.75],[.75,1.00000001]].map(([lo,hi])=>{
  const rr=valid.filter(v=>v.prediction>=lo&&v.prediction<hi);
  return {range:[lo,Math.min(1,hi)],n:rr.length,mean_predicted:rr.length?rr.reduce((a,b)=>a+b.prediction,0)/rr.length:null,
    observed_rate:rr.length?rr.reduce((a,b)=>a+b.outcome,0)/rr.length:null};
 });
 return {schema:'FT_V2_OFFLINE_CALIBRATION_AUDIT_V1',status:valid.length>=minSamples?'MEASURED_UNCALIBRATED':'INSUFFICIENT_OBSERVED_OUTCOMES',
  sample:valid.length,min_samples:minSamples,excluded_count:excluded.length,excluded,
  brier:avg('brier'),log_loss:avg('logLoss'),mean_probability:avg('prediction'),observed_win_rate:avg('outcome'),
  buckets,model_calibrated:false,live_probability_adjustment_authorized:false,
  note:'Real as-of paired fixtures only. Metrics are retrospective, not evidence of ROI or future performance.'};
}
