// FT 3C staged provenance/quality audit. Pure: no provider, storage, ranking or scoring.
// REJECT = not safe to use as a chronologically-valid forecast input;
// REVIEW = preserved but missing non-mandatory evidence; never translated into a lost bet.
const positive=x=>Number.isSafeInteger(x)&&x>0;
const score=x=>x&&Number.isInteger(x.home)&&x.home>=0&&Number.isInteger(x.away)&&x.away>=0;
const finalStates=new Set(['FT','AET','PEN','CANC','ABD','AWD','WO']);
const optional=['statistics','events','odds','half_statistics'];
const unique=x=>[...new Set(x)];
export function inspectFTObservation(o){
 const errors=[],warnings=[],sources={};
 if(o?.schema!=='FT_OBSERVATION_V1_DRAFT'||typeof o.id!=='string'||!o.id||!positive(o.fixture_id)||!positive(o.decision_at))errors.push('INVALID_OBSERVATION_IDENTITY');
 const f=o?.fixture,phase=f?.fixture?.status?.short,elapsed=f?.fixture?.status?.elapsed;
 if(f?.fixture?.id!==o?.fixture_id)errors.push('FIXTURE_ID_MISMATCH');
 if(finalStates.has(phase))errors.push('POST_MATCH_FIXTURE_IN_FORECAST');
 if(phase!=='2H')warnings.push('NOT_SECOND_HALF_TRIAL_SCOPE');
 if(!score(f?.goals))errors.push('INVALID_LIVE_SCORE');
 if(elapsed!=null&&(!Number.isFinite(elapsed)||elapsed<45||elapsed>90))warnings.push('NONSTANDARD_LIVE_ELAPSED');
 if(f?.score?.fulltime!=null)errors.push('FULLTIME_SCORE_LEAKAGE');
 // The independently captured fixture source must not smuggle a later final result.
 // Provider snapshots may arrive as a fixture object or a one-element fixtures list.
 const sourceFixture=o?.sources?.fixture?.data;
 const fixtureSnapshots=Array.isArray(sourceFixture)?sourceFixture:[sourceFixture];
 if(fixtureSnapshots.some(row=>row?.score?.fulltime!=null||finalStates.has(row?.fixture?.status?.short)))errors.push('SOURCE_FIXTURE_FUTURE_LABEL_LEAKAGE');
 if(o?.outcome!=null||o?.final_score!=null)errors.push('FUTURE_LABEL_IN_OBSERVATION');
 for(const name of ['fixture',...optional]){
  const s=o?.sources?.[name];
  if(!s){sources[name]='MISSING';warnings.push(name+':MISSING');continue;}
  if(!['OK','EMPTY','ERROR','INVALID','MISSING'].includes(s.status))errors.push(name+':INVALID_STATUS');
  sources[name]=s.status;
  if(s.status==='MISSING'){warnings.push(name+':MISSING');continue;}
  if(!positive(s.received_at)||!positive(o?.decision_at)||s.received_at>o.decision_at)errors.push(name+':FUTURE_OR_UNKNOWN_RECEIPT');
  if(s.source_at==null)warnings.push(name+':UNKNOWN_PROVIDER_SOURCE_TIME');
  else if(!positive(s.source_at)||!positive(s.received_at)||s.source_at>s.received_at)errors.push(name+':FUTURE_PROVIDER_SOURCE_TIME');
  if(['OK','EMPTY'].includes(s.status)&&s.data==null)errors.push(name+':MISSING_PAYLOAD');
  if(['ERROR','INVALID'].includes(s.status))warnings.push(name+':UNUSABLE_SOURCE');
 }
 return {status:errors.length?'REJECT':warnings.length?'REVIEW':'ACCEPT',errors:unique(errors),warnings:unique(warnings),sources,can_use_for_model:errors.length===0,provider_age_certified:optional.every(k=>o?.sources?.[k]?.source_at!=null)};
}
export function inspectFTDecision(o,d){
 const errors=[],warnings=[],ob=inspectFTObservation(o);
 if(!d||d.schema!=='FT_DECISION_V1_DRAFT'||d.observation_id!==o?.id||d.fixture_id!==o?.fixture_id)errors.push('DECISION_IDENTITY_MISMATCH');
 if(!positive(d?.input_at)||d?.input_at!==o?.decision_at||!positive(d?.decision_at)||d.decision_at<d.input_at)errors.push('DECISION_CLOCK_MISMATCH');
 if(!['EVALUATED','NOT_EVALUATED','ERROR'].includes(d?.state))errors.push('DECISION_STATE_INVALID');
 if(d?.state!=='EVALUATED'&&d?.evaluation!=null)errors.push('STALE_EVALUATION');
 if(d?.forecast_prob!=null||d?.fair_odds!=null||d?.roi!=null)warnings.push('UNVERIFIED_PRICING_FIELDS_PRESENT');
 if(d?.state!=='EVALUATED')warnings.push('NOT_EVALUATED_NOT_A_NEGATIVE_RECOMMENDATION');
 if(d?.push_delivery!=='NOT_OBSERVED')warnings.push('PUSH_EVIDENCE_SEPARATELY_REQUIRED');
 return {status:errors.length||ob.status==='REJECT'?'REJECT':warnings.length||ob.status==='REVIEW'?'REVIEW':'ACCEPT',errors:unique([...ob.errors,...errors]),warnings:unique([...ob.warnings,...warnings]),forecast_accuracy:null,roi:null};
}
export function inspectFTOutcome(o,d,result){
 const dec=inspectFTDecision(o,d),errors=[...dec.errors],warnings=[...dec.warnings];
 if(result?.schema!=='FT_OUTCOME_V2_DRAFT'||result?.state!=='RESOLVED'||result?.settlement_basis!=='FULL_MATCH_REGULATION'||result?.observation_id!==o?.id||result?.fixture_id!==o?.fixture_id)errors.push('INVALID_OUTCOME_IDENTITY');
 if(!positive(result?.observed_at)||result.observed_at<d?.decision_at||!positive(result?.resolved_at)||result.resolved_at<result.observed_at)errors.push('OUTCOME_CHRONOLOGY');
 if(!score(result?.score))errors.push('OUTCOME_SCORE_INVALID');
 if(!['FT','AET','PEN'].includes(result?.status))errors.push('OUTCOME_NOT_FINAL_REGULATION_STATUS');
 return {status:errors.length?'REJECT':warnings.length?'REVIEW':'ACCEPT',errors:unique(errors),warnings:unique(warnings),forecast_accuracy:null,roi:null,regulation_only:true};
}
