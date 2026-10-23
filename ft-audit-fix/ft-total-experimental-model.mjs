// FT 3L experimental conditional remaining-goals Poisson baseline.
// Input MUST be verified training-cohort rows. Never train on bookmaker odds.
// Out-of-time holdout starts at T; train labels must have resolved before T.
// This is a diagnostic scientific baseline, NOT a calibrated production predictor.
const yesInt=x=>Number.isSafeInteger(x)&&x>=0;
const clock=x=>Number.isSafeInteger(x)&&x>0;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const K=4;
function exposure(minute){return Math.max(1,94-minute)/45;} // provisional stoppage-time assumption; not calibrated
function fv(row){
 const goals=row.live_goals;
 const sot=row.shots_on_target_total;
 return [1,clamp((goals-2)/2,-2,3),sot===null?0:clamp((sot-8)/8,-2,3),sot===null?1:0];
}
function validateRow(r){
 return yesInt(r?.fixture_id)&&r.fixture_id>0&&typeof r.observation_id==='string'&&
 clock(r.decision_at)&&clock(r.label_available_at)&&r.label_available_at>r.decision_at&&
 yesInt(r.live_minute)&&r.live_minute>=45&&r.live_minute<=90&&
 yesInt(r.live_goals)&&r.live_goals<=18&&
 (r.shots_on_target_total===null||yesInt(r.shots_on_target_total)&&r.shots_on_target_total<=120)&&
 yesInt(r.remaining_goals)&&r.remaining_goals<=20&&
 r.final_total_goals===r.live_goals+r.remaining_goals&&
 r.provenance==='HASHED_PAIR_WITH_LATER_REGULATION_RESULT';
}
function fitPoisson(rows,{interceptOnly=false}={}){
 const n=rows.length,x0=rows.reduce((a,r)=>a+r.remaining_goals,0),
   expSum=rows.reduce((a,r)=>a+exposure(r.live_minute),0);
 const w=[clamp(Math.log(Math.max(.02,x0/expSum)),-7,4),0,0,0];
 for(let step=0;step<850;step++){
  const gradient=[0,0,0,0];
  for(const r of rows){
   const x=fv(r),eta=Math.log(exposure(r.live_minute))+w.reduce((a,b,i)=>a+b*x[i],0);
   const mu=Math.exp(clamp(eta,-12,6)),err=r.remaining_goals-mu;
   for(let i=0;i<K;i++)if(!interceptOnly||i===0)gradient[i]+=err*x[i]/n;
  }
  const lr=.036;
  for(let i=0;i<K;i++){
   if(interceptOnly&&i>0)continue;
   const penalty=i===0?0:.035*w[i];
   w[i]=clamp(w[i]+lr*(clamp(gradient[i],-4,4)-penalty),i===0?-7:-2.5,i===0?4:2.5);
  }
 }
 return w;
}
function expectedRemaining(coeffs,row){
 const x=fv(row),eta=Math.log(exposure(row.live_minute))+
   coeffs.reduce((a,b,i)=>a+b*x[i],0);
 return clamp(Math.exp(clamp(eta,-10,5)),.0001,25);
}
function poissonPMF(mu,max=20){
 const probs=[],p0=Math.exp(-mu);let p=p0,sum=0;
 for(let k=0;k<max;k++){if(k>0)p*=mu/k;probs.push(p);sum+=p;}
 probs.push(Math.max(0,1-sum)); // last bin absorbs >=20 goals; no truncated probability.
 const z=probs.reduce((a,b)=>a+b,0);
 return probs.map(v=>v/z);
}
function dist(coeffs,row){
 const mu=expectedRemaining(coeffs,row);
 const p=poissonPMF(mu);
 return {mean_remaining_goals:mu,
  distribution:p.map((probability,k)=>({finalTotalGoals:row.live_goals+k,probability})),
  tail_bin:'LAST_BIN_IS_AT_LEAST_20_REMAINING_GOALS'};
}
function oneScore(model,row){
 const forecast=dist(model,row),actual=row.remaining_goals,probs=forecast.distribution;
 const logloss=-Math.log(Math.max(1e-15,probs[Math.min(20,actual)].probability));
 const pOver25=probs.reduce((a,v)=>a+(v.finalTotalGoals>=3?v.probability:0),0);
 const hit=row.final_total_goals>=3?1:0;
 return {logloss,brier_over_2_5:(pOver25-hit)**2,p_over_2_5:pOver25,hit};
}
const avg=(rows,key)=>rows.reduce((n,r)=>n+r[key],0)/rows.length;
function evaluate(coeffs,holdout){
 const scored=holdout.map(r=>oneScore(coeffs,r));
 return {n:holdout.length,mean_poisson_neg_log_likelihood:avg(scored,'logloss'),
  mean_brier_over_2_5:avg(scored,'brier_over_2_5'),
  observed_over_2_5_rate:avg(scored,'hit'),
  mean_predicted_over_2_5_rate:avg(scored,'p_over_2_5')};
}
async function hash(s){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function trainFTTotalExperimental(cohort,{holdoutFraction=.25,minTrain=15,minHoldout=5}={}){
 if(cohort?.schema!=='FT_TOTAL_TRAINING_COHORT_3L_OFFLINE'||!Array.isArray(cohort.rows))throw Error('VERIFIED_COHORT_REQUIRED');
 if(!Number.isFinite(holdoutFraction)||holdoutFraction<=0||holdoutFraction>=.5||
 !Number.isSafeInteger(minTrain)||minTrain<1||!Number.isSafeInteger(minHoldout)||minHoldout<1)throw Error('INVALID_TRAINING_CONFIG');
 const rows=cohort.rows.slice().sort((a,b)=>a.decision_at-b.decision_at||a.fixture_id-b.fixture_id);
 if(rows.some(r=>!validateRow(r))||new Set(rows.map(r=>r.fixture_id)).size!==rows.length)throw Error('INVALID_OR_REPEATED_FIXTURE_IN_COHORT');
 const holdoutN=Math.max(minHoldout,Math.floor(rows.length*holdoutFraction));
 if(rows.length<=holdoutN)return {status:'INSUFFICIENT_COHORT',n:rows.length,required_minimum:minTrain+minHoldout,releaseGate:'BLOCKED',model:null};
 const cut=rows.length-holdoutN,splitTime=rows[cut].decision_at;
 const initial=rows.slice(0,cut),train=initial.filter(r=>r.label_available_at<splitTime),test=rows.slice(cut);
 const purged=initial.length-train.length;
 const stats={total:rows.length,train:train.length,holdout:test.length,purged,
  split_decision_at:splitTime,holdout_first_decision_at:test[0]?.decision_at??null,
  training_last_label_available_at:train.length?Math.max(...train.map(r=>r.label_available_at)):null,
  unique_training_fixtures:train.length,unique_holdout_fixtures:test.length};
 if(train.length<minTrain||test.length<minHoldout)return {status:'INSUFFICIENT_CHRONOLOGICAL_LABELS',counts:stats,releaseGate:'BLOCKED',model:null};
 const coeffs=fitPoisson(train),nullCoeff=fitPoisson(train,{interceptOnly:true});
 const version='FT_TOTAL_POISSON_3L_'+(await hash(JSON.stringify({
  training:train.map(r=>[r.fixture_id,r.observation_id,r.decision_at,r.label_available_at,r.live_minute,r.live_goals,r.shots_on_target_total,r.remaining_goals]),
  model_definition:'FOUR_FEATURE_POISSON_94MIN_PROVISIONAL',coeffs}))).slice(0,16);
 const model={schema:'FT_TOTAL_POISSON_EXPERIMENTAL_3L',model_version:version,
  coeffs,trained_until:stats.training_last_label_available_at,
  feature_names:['intercept','live_goals','sot_total','sot_missing'],
  feature_contract:'NO_MARKET_INPUT_NO_FUTURE_EVENTS',state:'NOT_CALIBRATED_FOR_BETTING',
  training_fixtures:train.length,stoppage_assumption:'94_EFFECTIVE_MINUTES_UNVALIDATED'};
 const metrics=evaluate(coeffs,test),nullMetrics=evaluate(nullCoeff,test);
 return {status:'OFFLINE_DIAGNOSTIC_ONLY',model,counts:stats,holdout_metrics:metrics,
  null_poisson_metrics:nullMetrics,
  improvement_in_logloss:nullMetrics.mean_poisson_neg_log_likelihood-metrics.mean_poisson_neg_log_likelihood,
  improvement_in_brier:nullMetrics.mean_brier_over_2_5-metrics.mean_brier_over_2_5,
  calibration_verified:false,real_world_predictive_edge_verified:false,
  releaseGate:'BLOCKED_NO_REAL_OUT_OF_TIME_CALIBRATION',
  caveat:'No bookmaker prices used in training; backtest results alone cannot prove tradable edge. Real data and independent calibration still required.'};
}
export function predictFTTotalExperimental(model,row){
 if(model?.schema!=='FT_TOTAL_POISSON_EXPERIMENTAL_3L'||
 model?.state!=='NOT_CALIBRATED_FOR_BETTING'||!Array.isArray(model.coeffs)||model.coeffs.length!==K||
 model.coeffs.some(x=>!Number.isFinite(x))||!validatePrediction(row)||
 row.decision_at<=model.trained_until)return {status:'NOT_ELIGIBLE',distribution:null,reason:'INVALID_MODEL_INPUT_OR_TEMPORAL_LEAKAGE'};
 const result=dist(model.coeffs,row);
 return {status:'OFFLINE_UNCALIBRATED_PMF',model_version:model.model_version,
  decision_at:row.decision_at,...result,pricing_eligible:false,releaseGate:'BLOCKED'};
}
function validatePrediction(row){
 return clock(row?.decision_at)&&yesInt(row.live_minute)&&row.live_minute>=45&&row.live_minute<=90&&
 yesInt(row.live_goals)&&row.live_goals<=18&&
 (row.shots_on_target_total===null||yesInt(row.shots_on_target_total)&&row.shots_on_target_total<=120);
}
