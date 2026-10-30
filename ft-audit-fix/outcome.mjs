// Pure resolver: no endpoint calls; consumes an explicitly received fixture.
const count=x=>Number.isInteger(x)&&x>=0;
const score=x=>x&&count(x.home)&&count(x.away);
export function resolveFTOutcome(observation,fixture,receivedAt,now=Date.now()){
 const wait=reason=>({state:'PENDING',reason});
 if(!observation||!Number.isSafeInteger(observation.fixture_id)||fixture?.fixture?.id!==observation.fixture_id)return wait('FIXTURE_MISMATCH');
 if(!Number.isSafeInteger(receivedAt)||receivedAt<observation.decision_at||receivedAt>now)return wait('INVALID_RECEIPT_TIME');
 if(typeof observation.id!=='string'||!observation.id||!Number.isSafeInteger(observation.decision_at)||observation.decision_at<=0||!Number.isSafeInteger(now)||now<=0)return wait('INVALID_OBSERVATION_TIME');
 const status=fixture.fixture.status?.short;
 if(['CANC','ABD','AWD','WO'].includes(status))return {state:'UNSETTLED',reason:'SETTLEMENT_RULE_REQUIRED'};
 if(!['FT','AET','PEN'].includes(status))return wait('NOT_FINAL');
 const final=fixture.score?.fulltime;
 if(!score(final))return wait('REGULATION_SCORE_MISSING');
 if(status==='FT'&&score(fixture.goals)&&(fixture.goals.home!==final.home||fixture.goals.away!==final.away))return wait('FINAL_SCORE_CONFLICT');
 return {state:'RESOLVED',schema:'FT_OUTCOME_V2_DRAFT',observation_id:observation.id,fixture_id:observation.fixture_id,
 observed_at:receivedAt,resolved_at:now,status,settlement_basis:'FULL_MATCH_REGULATION',score:{home:final.home,away:final.away}};
}
