import {auditFTCalibration} from './calibration-audit.mjs';
export function joinPilotEvidence({pairs=[],outcomes=[],forecasts=[]}={}){
  if(![pairs,outcomes,forecasts].every(Array.isArray))throw Error('INVALID_INPUT');
  const rows=[],excluded=[],seen=new Set();
  for(const pair of pairs){
    let obs,decision;
    try{
      obs=JSON.parse(pair.observation_json);
      decision=JSON.parse(pair.decision_json);
    }catch{excluded.push({fixture_id:pair.fixture_id,reason:'INVALID_PAIR_JSON'});continue;}
    const id=obs?.fixture_id,observationId=obs?.id;
    if(!Number.isSafeInteger(id)||pair.fixture_id!==id||seen.has(id)||
       decision?.fixture_id!==id||decision?.observation_id!==observationId){
      excluded.push({fixture_id:id??null,reason:'PAIR_IDENTITY_OR_DUPLICATE'});continue;
    }
    seen.add(id);
    const linked=outcomes.filter(o=>o.fixture_id===id&&o.observation_id===observationId&&
      o.schema==='FT_OUTCOME_V2_DRAFT'&&o.state==='RESOLVED'&&
      Number.isSafeInteger(o.observed_at)&&o.observed_at>decision.decision_at&&
      ['FT','AET','PEN'].includes(o.status)&&
      Number.isInteger(o.score?.home)&&Number.isInteger(o.score?.away));
    if(!linked.length){excluded.push({fixture_id:id,reason:'NO_VERIFIED_FINAL'});continue;}
    linked.sort((a,b)=>b.observed_at-a.observed_at);
    const matching=forecasts.filter(f=>f.fixture_id===id&&f.observation_id===observationId);
    if(matching.length!==1){excluded.push({fixture_id:id,reason:matching.length?'AMBIGUOUS_ASOF_FORECAST':'MISSING_ASOF_FORECAST'});continue;}
    const f=matching[0],outcome=linked[0];
    if(f.decision_at!==obs.decision_at||f.model_generated_at!==obs.decision_at||
       f.source_received_at!==obs.sources?.fixture?.received_at||
       f.source_received_at>obs.decision_at||
       obs.fixture?.fixture?.id!==id){
      excluded.push({fixture_id:id,reason:'UNVERIFIED_ASOF_PROVENANCE'});continue;
    }
    rows.push({fixture_id:id,decision_at:obs.decision_at,outcome_received_at:outcome.observed_at,
      score:obs.fixture.goals,final_score:outcome.score,
      remaining_goals_pmf:f.remaining_goals_pmf,model_generated_at:f.model_generated_at,
      source_received_at:f.source_received_at,observed_stats:f.observed_stats,
      line:f.line,market_odds:f.market_odds,settlement_basis:f.settlement_basis});
  }
  return {status:'OFFLINE_ONLY',rows,excluded,matched:rows.length};
}
export function auditPilotEvidence(input,options){
  const result=joinPilotEvidence(input);
  return {...result,calibration:auditFTCalibration(result.rows,options)};
}
