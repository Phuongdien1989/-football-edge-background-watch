/* FOOTBALL EDGE — Prediction V2 / B8-B9 + Batch 02 strict-metric quarantine
 * Builds validation report and non-automatic promotion stage.
 * strictMode=false preserves historical B7-B9 compatibility.
 * strictMode=true excludes legacy/unprovenance/unacknowledged observations from metrics.
 */
import {validationDashboard,marketValidation} from './validation-metrics.js';
import {compareOldNew} from './old-vs-new-comparator.js';
import {strictMetricEligible} from './observation-contract.js';
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
export function promotionStage({prediction=[],paired=[],paper=[]}={}){
  const settled=(prediction||[]).filter(x=>x?.outcome?.settled&&typeof x?.outcome?.goal_10m==='boolean').length,
    paperSettled=(paper||[]).filter(x=>x?.settled&&finite(x?.realized_return)!=null).length;
  let stage='COLLECT';if(settled>=3000)stage='STRATIFIED_REVIEW';else if(settled>=1000)stage='MEANINGFUL_COMPARISON';else if(settled>=500)stage='DIAGNOSTIC_REVIEW';
  return {stage,settled_predictions:settled,settled_paper:paperSettled,next_checkpoint:settled<500?500:settled<1000?1000:settled<3000?3000:null,
    production_ready:false,manual_review_required:true,note:'Sample checkpoint only. V2 is never auto-promoted by count alone.'};
}
function quarantineReason(r,kind){
  if(r?.strict_metrics_eligible===true||r?.observation?.strict_metrics_eligible===true)return null;
  if(!r?.observation_id&&!r?.observation)return 'LEGACY_NO_OBSERVATION_CONTRACT';
  const replay=r?.strict_replay_status??r?.observation?.strict_replay_status;
  if(replay!=='STRICT_VALID')return replay||'UNKNOWN_PROVENANCE';
  const persist=r?.persistence_status??r?.observation?.persistence_status;
  if(persist!=='ACKNOWLEDGED')return 'PERSISTENCE_UNVERIFIED';
  if(kind==='prediction'&&r?.outcome?.strict_outcome_eligible!==true)return 'OUTCOME_NOT_STRICT';
  if(kind==='paper'&&r?.market_provenance_status!=='STRICT_VALID')return 'MARKET_NOT_STRICT';
  return 'STRICT_ELIGIBILITY_FALSE';
}
function strictFilter(rows,kind){
  const accepted=[],quarantined=[];for(const r of rows||[]){if(strictMetricEligible(r))accepted.push(r);else quarantined.push({...r,__quarantine_reason:quarantineReason(r,kind)})}
  return {accepted,quarantined};
}
function countReasons(rows){const out={};for(const r of rows||[]){const k=r.__quarantine_reason||'UNKNOWN';out[k]=(out[k]||0)+1}return out}
export function buildValidationReport(data={},options={}){
  const raw={prediction:data.prediction||[],paired:data.paired||[],paper:data.paper||[]},strictMode=options?.strictMode===true;
  const pf=strictMode?strictFilter(raw.prediction,'prediction'):{accepted:raw.prediction,quarantined:[]},
    xf=strictMode?strictFilter(raw.paired,'paired'):{accepted:raw.paired,quarantined:[]},
    mf=strictMode?strictFilter(raw.paper,'paper'):{accepted:raw.paper,quarantined:[]},
    prediction=pf.accepted,paired=xf.accepted,paper=mf.accepted;
  return {schema:strictMode?'FE_PREDICTION_V2_VALIDATION_REPORT_B10_STRICT':'FE_PREDICTION_V2_VALIDATION_REPORT_B8',generated_at:Date.now(),strict_mode:strictMode,
    promotion:promotionStage({prediction,paired,paper}),calibration:validationDashboard(prediction),old_vs_new:compareOldNew(paired),market:marketValidation(paper),
    quarantine:{prediction:{total:raw.prediction.length,included:prediction.length,excluded:pf.quarantined.length,reasons:countReasons(pf.quarantined)},
      paired:{total:raw.paired.length,included:paired.length,excluded:xf.quarantined.length,reasons:countReasons(xf.quarantined)},
      paper:{total:raw.paper.length,included:paper.length,excluded:mf.quarantined.length,reasons:countReasons(mf.quarantined)}}};
}