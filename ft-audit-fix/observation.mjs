// Staged serializer only. No database writes, API calls or runtime activation.
const clone=x=>JSON.parse(JSON.stringify(x));
const validTime=x=>Number.isSafeInteger(x)&&x>0;
export function buildFTObservation(input){
 const {id,fixture_id,decision_at,fixture,sources={},model_version=null}=input||{};
 if(typeof id!=='string'||!id||!Number.isSafeInteger(fixture_id)||fixture_id<=0||!validTime(decision_at))throw Error('INVALID_OBSERVATION_IDENTITY');
 if(fixture?.fixture?.id!==fixture_id)throw Error('FIXTURE_ID_MISMATCH');
 const sourceRows={};
 for(const name of ['fixture','statistics','events','odds','half_statistics']){
  const source=sources[name];
  if(!source){sourceRows[name]={status:'MISSING',received_at:null,source_at:null,data:null};continue;}
  if(!['OK','EMPTY','ERROR','INVALID'].includes(source.status)||!validTime(source.received_at)||source.received_at>decision_at)throw Error('INVALID_SOURCE_RECEIPT');
  if(source.source_at!=null&&(!validTime(source.source_at)||source.source_at>source.received_at))throw Error('INVALID_SOURCE_TIME');
  if(['OK','EMPTY'].includes(source.status)&&source.data==null)throw Error('MISSING_SOURCE_PAYLOAD');
  sourceRows[name]={status:source.status,received_at:source.received_at,source_at:source.source_at??null,data:['OK','EMPTY'].includes(source.status)?clone(source.data):null};
 }
 // Outcome is deliberately separate: no final score may enter a prediction row.
 return {schema:'FT_OBSERVATION_V1_DRAFT',id,fixture_id,decision_at,fixture:clone(fixture),sources:sourceRows,model_version,collection_scope:'SCANNED_FIXTURE_NOT_RECOMMENDATION_ONLY'};
}
export function buildFTOutcome({observation_id,fixture_id,observed_at,resolved_at,status,score}){
 if(!observation_id||!Number.isSafeInteger(fixture_id)||!validTime(observed_at)||!validTime(resolved_at)||resolved_at<observed_at||status!=='FT'||![score?.home,score?.away].every(x=>Number.isInteger(x)&&x>=0))throw Error('INVALID_FINAL_OUTCOME');
 return {schema:'FT_OUTCOME_V1_DRAFT',observation_id,fixture_id,observed_at,resolved_at,status,score:clone(score)};
}
