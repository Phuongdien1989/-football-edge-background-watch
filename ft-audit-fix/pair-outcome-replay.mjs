// Candidate-only pair-backed outcome discovery. No network/database calls here.
// The distinct PAIR table holds a complete immutable Observation+Decision snapshot;
// regulation outcomes remain append-only OUTCOME rows in ft_replay_records_v1.
import {prepareFTPair} from './ft-pair-collector.mjs';
import {inspectFTOutcome} from './replay-integrity.mjs';
import {auditFTReplay} from './replay-coverage.mjs';
export const PAIR_PAGE_SQL=`SELECT p.observation_id,p.fixture_id,p.observed_at,p.decision_at,p.content_hash,
 p.observation_json,p.decision_json,
 EXISTS(SELECT 1 FROM ft_replay_records_v1 AS o INDEXED BY ft_replay_by_observation_kind
 WHERE o.observation_id=p.observation_id AND o.kind='OUTCOME') AS has_outcome
 FROM ft_replay_pairs_v1 AS p
 WHERE p.observation_id>?1 ORDER BY p.observation_id LIMIT ?2`;
export async function verifyFTPairRow(row,{maxRecordBytes=20000}={}){
 try{
  if(!row||typeof row.observation_json!=='string'||typeof row.decision_json!=='string'||
   typeof row.observation_id!=='string'||!row.observation_id||
   !Number.isSafeInteger(row.fixture_id)||row.fixture_id<1)throw Error('INVALID_PAIR_ROW');
  const observation=JSON.parse(row.observation_json),decision=JSON.parse(row.decision_json);
  const pair=await prepareFTPair(observation,decision,maxRecordBytes);
  for(const k of ['observation_id','fixture_id','observed_at','decision_at','content_hash']){
   if(pair[k]!==row[k])throw Error('PAIR_ROW_HASH_OR_ID_MISMATCH');
  }
  if(!['EVALUATED','NOT_EVALUATED','ERROR'].includes(decision.state))throw Error('INVALID_DECISION_STATE');
  if(observation.fixture?.fixture?.id!==row.fixture_id||
    observation.fixture?.fixture?.status?.short!=='2H')throw Error('NOT_LIVE_FT_OBSERVATION');
  if(observation.fixture?.score?.fulltime!=null||observation.outcome!=null)throw Error('FUTURE_SCORE_LEAKAGE');
  for(const x of Object.values(observation.sources||{})){
   if(x?.received_at!=null&&x.received_at>observation.decision_at)throw Error('FUTURE_SOURCE_RECEIPT');
   if(x?.source_at!=null&&x.source_at>x.received_at)throw Error('INVALID_SOURCE_CLOCK');
  }
  return {status:'VALID_PAIR',observation,decision};
 }catch(e){return {status:'INVALID_PAIR',reason:String(e.message||e).slice(0,120)};}
}
export async function auditFTPairOutcomeRows(pairs,outcomes,{maxRecordBytes=20000}={}){
 if(!Array.isArray(pairs)||!Array.isArray(outcomes))throw Error('INVALID_PAIR_AUDIT_INPUT');
 const records=[],issues=[],seen=new Set(),validatedPairs=new Map();
 for(const pair of pairs){
  const key=pair?.observation_id;
  if(typeof key!=='string'||seen.has(key)){issues.push({observation_id:key??null,reason:'DUPLICATE_OR_BAD_PAIR_KEY'});continue;}
  seen.add(key);
  const verify=await verifyFTPairRow(pair,{maxRecordBytes});
  if(verify.status!=='VALID_PAIR'){issues.push({observation_id:key,reason:verify.reason});continue;}
  validatedPairs.set(key,verify);
  records.push(verify.observation,verify.decision);
 }
 for(const outcome of outcomes)records.push(outcome);
 const replay=auditFTReplay(records);
 let integrityRejected=0;
 for(const result of replay.results){
  if(result.status!=='LINKED')continue;
  const pair=validatedPairs.get(result.id);
  const finalRows=outcomes.filter(x=>x.observation_id===result.id);
  const latestTime=Math.max(...finalRows.map(x=>x.observed_at||0));
  const finalists=finalRows.filter(x=>x.observed_at===latestTime);
  // Never certify a linked replay by arbitrarily selecting the first tied
  // outcome revision. Reject the linked cohort if ANY latest revision fails.
  if(!pair||!finalists.length||finalists.some(x=>inspectFTOutcome(pair.observation,pair.decision,x).status==='REJECT'))integrityRejected++;
 }
 return {schema:'FT_PAIR_OUTCOME_AUDIT_V1_DRAFT',
  valid_pairs:validatedPairs.size,invalid_pairs:issues.length,issues,
  replay_counts:replay.counts,linked_count:replay.counts.LINKED||0,
  linked_integrity_rejects:integrityRejected,accuracy:null,roi:null,calibration:null,
  status:'EVIDENCE_AUDIT_ONLY',releaseGate:'BLOCKED'};
}
