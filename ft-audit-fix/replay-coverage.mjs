// Offline/export audit. Completeness is not predictive accuracy.
import {linkFTReplay} from './decision-trace.mjs';
export function auditFTReplay(records){
 const observations=new Map(),decisions=new Map(),outcomes=new Map(),issues=[];
 for(const row of records){
  const id=row?.schema==='FT_OBSERVATION_V1_DRAFT'?row.id:row?.observation_id;
  const target=row?.schema==='FT_OBSERVATION_V1_DRAFT'?observations:row?.schema==='FT_DECISION_V1_DRAFT'?decisions:row?.schema==='FT_OUTCOME_V2_DRAFT'?outcomes:null;
  if(!target||typeof id!=='string'||!id){issues.push({status:'INVALID_RECORD'});continue;}
  const list=target.get(id)||[];if(!list.some(x=>JSON.stringify(x)===JSON.stringify(row)))list.push(row);target.set(id,list);
 }
 const results=[];
 for(const [id,list]of observations){
  if(list.length!==1){results.push({id,status:'CONFLICTING_OBSERVATION'});continue;}
  const ds=decisions.get(id)||[],os=outcomes.get(id)||[];
  // Do not silently pick a decision revision; adjudication remains explicit.
  if(ds.length!==1){results.push({id,status:ds.length?'AMBIGUOUS_DECISION':'MISSING_DECISION'});continue;}
  if(!os.length){results.push({id,status:'MISSING_OUTCOME'});continue;}
  const latest=Math.max(...os.map(x=>Number.isSafeInteger(x.observed_at)?x.observed_at:0));
  const finalists=os.filter(x=>x.observed_at===latest);
  if(finalists.some(x=>x.state!=='RESOLVED'||x.settlement_basis!=='FULL_MATCH_REGULATION'||!Number.isSafeInteger(x.resolved_at)||x.resolved_at<x.observed_at||![x.score?.home,x.score?.away].every(n=>Number.isInteger(n)&&n>=0))){results.push({id,status:'INVALID_LINK'});continue;}
  const scores=new Set(finalists.map(x=>JSON.stringify([x.fixture_id,x.state,x.status,x.score,x.settlement_basis])));
  if(scores.size!==1){results.push({id,status:'CONFLICTING_OUTCOME'});continue;}
  try{
   const joined=linkFTReplay(list[0],ds[0],finalists[0]);
   results.push({id,status:'LINKED',decision_state:joined.decision.state,outcome_revisions:os.length,score:joined.outcome.score});
  }catch{results.push({id,status:'INVALID_LINK'});}
 }
 for(const id of new Set([...decisions.keys(),...outcomes.keys()]))if(!observations.has(id))results.push({id,status:'ORPHAN_RECORD'});
 const counts={};for(const x of [...results,...issues])counts[x.status]=(counts[x.status]||0)+1;
 return {results,issues,counts,accuracy:null,roi:null,scope:'INPUT_EXPORT_ONLY'};
}
