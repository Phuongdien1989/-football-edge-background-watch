// FT 3L offline training cohort. A pair must have hash-verified pre-decision
// evidence; final regulation goals enter LABELS ONLY after the match resolved.
// One earliest valid snapshot per fixture for independent chronological testing.
// No network, D1, bookmaker prices, recommendation ranking or live changes.
import {verifyFTPairRow} from './pair-outcome-replay.mjs';
import {inspectFTOutcome} from './replay-integrity.mjs';
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const validTime=v=>Number.isSafeInteger(v)&&v>0;
function statsSotTotal(o){
 const s=o?.sources?.statistics;
 if(s?.status!=='OK'||!Array.isArray(s.data)||s.data.length!==2)return null;
 const n=s.data.map(team=>{
  const a=team?.statistics;
  if(!Array.isArray(a))return null;
  const shot=a.find(x=>['shots on goal','shots on target'].includes(String(x?.type||'').toLowerCase()));
  if(!shot||!integer(shot.value))return null;
  return shot.value;
 });
 return n.every(integer)?n[0]+n[1]:null;
}
function extract(o,d,outcome){
 const f=o.fixture,minute=f?.fixture?.status?.elapsed,home=f?.goals?.home,away=f?.goals?.away;
 if(!Number.isSafeInteger(minute)||minute<45||minute>90||
  !integer(home)||!integer(away)||!validTime(d.decision_at)||
  outcome.score.home<home||outcome.score.away<away)return {reason:'INVALID_LIVE_OR_CORRECTED_SCORE'};
 const remaining=(outcome.score.home-home)+(outcome.score.away-away);
 if(!integer(remaining)||remaining>20)return {reason:'IMPLAUSIBLE_REMAINING_GOALS_REVIEW'};
 return {row:{fixture_id:o.fixture_id,observation_id:o.id,
  decision_at:d.decision_at,label_available_at:outcome.resolved_at,
  live_minute:minute,live_home_goals:home,live_away_goals:away,live_goals:home+away,
  shots_on_target_total:statsSotTotal(o),remaining_goals:remaining,
  final_total_goals:outcome.score.home+outcome.score.away,
  provenance:'HASHED_PAIR_WITH_LATER_REGULATION_RESULT',
  outcome_status:outcome.status}};
}
export async function createFTTotalCohort(pairs,outcomes,{maxRecordBytes=20000}={}){
 if(!Array.isArray(pairs)||!Array.isArray(outcomes))throw Error('INVALID_COHORT_INPUT');
 const issues=[],candidates=[],pairIDs=new Set();
 const outcomeById=new Map();
 for(const out of outcomes){
  if(typeof out?.observation_id!=='string'){issues.push({reason:'OUTCOME_WITHOUT_OBSERVATION_ID'});continue;}
  const rows=outcomeById.get(out.observation_id)||[];rows.push(out);outcomeById.set(out.observation_id,rows);
 }
 for(const pair of pairs){
  const id=pair?.observation_id;
  if(typeof id!=='string'||!id||pairIDs.has(id)){issues.push({observation_id:id??null,reason:'DUPLICATE_PAIR_ID'});continue;}
  pairIDs.add(id);
  const checked=await verifyFTPairRow(pair,{maxRecordBytes});
  if(checked.status!=='VALID_PAIR'){issues.push({observation_id:id,reason:checked.reason});continue;}
  const {observation:o,decision:d}=checked;
  const rows=outcomeById.get(id)||[];
  if(!rows.length){issues.push({observation_id:id,reason:'OUTCOME_PENDING_NOT_NEGATIVE_LABEL'});continue;}
  const latest=Math.max(...rows.map(x=>validTime(x?.observed_at)?x.observed_at:0));
  const recent=rows.filter(x=>x.observed_at===latest);
  // No arbitrary pick when the latest revision has divergent scores/statuses.
  if(!recent.length||recent.some(x=>inspectFTOutcome(o,d,x).status==='REJECT')||
    new Set(recent.map(x=>JSON.stringify([x.status,x.score,x.fixture_id,x.settlement_basis]))).size!==1){
   issues.push({observation_id:id,reason:'AMBIGUOUS_OR_INVALID_FINAL_OUTCOME'});continue;
  }
  const label=recent[0],v=extract(o,d,label);
  if(v.reason){issues.push({observation_id:id,reason:v.reason});continue;}
  candidates.push(v.row);
 }
 const sorted=candidates.sort((a,b)=>a.decision_at-b.decision_at||a.fixture_id-b.fixture_id||a.observation_id.localeCompare(b.observation_id));
 const unique=[],seenFixtures=new Set();
 for(const item of sorted){
  if(seenFixtures.has(item.fixture_id)){issues.push({observation_id:item.observation_id,reason:'LATER_SNAPSHOT_SAME_FIXTURE_EXCLUDED_FROM_INDEPENDENT_COHORT'});continue;}
  unique.push(item);seenFixtures.add(item.fixture_id);
 }
 return {schema:'FT_TOTAL_TRAINING_COHORT_3L_OFFLINE',
  rows:unique,fixture_count:seenFixtures.size,issues,
  status:unique.length?'COHORT_ASSEMBLED_NOT_VALIDATED':'NO_VERIFIED_REAL_COHORT',
  training_data_origin:'CALLER_SUPPLIED_NO_REMOTE_FETCH',
  gate:'NO_PRODUCTION_MODEL_RELEASE',market_prices_used:false};
}
