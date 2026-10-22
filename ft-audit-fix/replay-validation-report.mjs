// 3C offline validation report, never a model-performance/ROI calculator.
// Includes link coverage and capture-plan omissions without forging old snapshots.
import {auditFTReplay} from './replay-coverage.mjs';
import {inspectFTObservation,inspectFTDecision,inspectFTOutcome} from './replay-integrity.mjs';
const percent=(num,den)=>den?Number((100*num/den).toFixed(2)):null;
export function makeFTValidationReport({records,manifests=[]}={}){
 if(!Array.isArray(records)||!Array.isArray(manifests))throw Error('INVALID_VALIDATION_INPUT');
 const links=auditFTReplay(records);
 const obs=new Map(),dec=new Map(),out=new Map();
 for(const r of records){
  if(r?.schema==='FT_OBSERVATION_V1_DRAFT')obs.set(r.id,r);
  if(r?.schema==='FT_DECISION_V1_DRAFT'){const a=dec.get(r.observation_id)||[];a.push(r);dec.set(r.observation_id,a);}
  if(r?.schema==='FT_OUTCOME_V2_DRAFT'){const a=out.get(r.observation_id)||[];a.push(r);out.set(r.observation_id,a);}
 }
 let accepted=0,review=0,reject=0,unknownSourceAt=0,missingMarket=0;
 const detail=[];
 for(const o of obs.values()){
  const ev=inspectFTObservation(o);
  if(ev.status==='REJECT')reject++;else if(ev.status==='REVIEW')review++;else accepted++;
  if(!ev.provider_age_certified)unknownSourceAt++;
  if(!['OK','EMPTY'].includes(ev.sources.odds))missingMarket++;
  const ds=dec.get(o.id)||[];
  if(ds.length===1){
   const r=inspectFTDecision(o,ds[0]);
   detail.push({id:o.id,fixture_id:o.fixture_id,observation_status:ev.status,decision_status:r.status,decision_state:ds[0].state,can_score_market:false});
  }else detail.push({id:o.id,fixture_id:o.fixture_id,observation_status:ev.status,decision_status:ds.length?'AMBIGUOUS':'MISSING',can_score_market:false});
 }
 let totalScanned=0,totalSelected=0,totalDeferred=0,manifestInvalid=0;
 for(const m of manifests){
  if(!m||!Array.isArray(m.selected)||!Array.isArray(m.deferred)||!Number.isSafeInteger(m.at)||m.at<=0||!['SCANNED_FT_ONLY'].includes(m.scope)){manifestInvalid++;continue;}
  const ids=[...m.selected,...m.deferred];
  if(ids.some(x=>!Number.isSafeInteger(x)||x<=0)||new Set(ids).size!==ids.length){manifestInvalid++;continue;}
  totalScanned+=ids.length;totalSelected+=m.selected.length;totalDeferred+=m.deferred.length;
 }
 const resolved=links.counts.LINKED||0,observations=obs.size;
 const linkedButNotEvidenceValidated=links.results.filter(x=>x.status==='LINKED').reduce((n,x)=>n+(detail.find(d=>d.id===x.id)?.observation_status==='REJECT'?1:0),0);
 return {
  schema:'FT_VALIDATION_3C_DRAFT',
  status:'EVIDENCE_AUDIT_ONLY',
  replay:{total_observations:observations,linked_count:resolved,linked_pct:percent(resolved,observations),counts:links.counts,linked_but_invalid_observation:linkedButNotEvidenceValidated},
  quality:{accepted,review,reject,provider_source_age_unknown:unknownSourceAt,missing_or_unusable_odds:missingMarket},
  capture:{observed_manifests:manifests.length-manifestInvalid,manifest_invalid:manifestInvalid,scanned_candidates:totalScanned,selected_for_attempt:totalSelected,deferred_without_historical_snapshot:totalDeferred,selected_capture_successes:'NOT_MEASURED',recovery_successes:'NOT_MEASURED'},
  integrity_issues:links.issues.length,
  evidence_details:detail,
  calibration:null,accuracy:null,roi:null,push_delivery:'NOT_OBSERVED',
  releaseGate:'BLOCKED',reasons:[
   'REPLAY_COHORT_NOT_LIVE_VALIDATED','TOTAL_WORKER_D1_NOT_MEASURED',
   'DEFERRED_SNAPSHOT_NOT_REPLAYABLE','MODEL_PROBABILITIES_NOT_AVAILABLE'
  ]
 };
}
