/* FOOTBALL EDGE — Prediction V2 / B8-B9 + Batch 02.1 strict metric quarantine
 * strictMode=false preserves historical B7-B9 behavior.
 * strictMode=true derives eligibility from the evidence required by each metric;
 * no nested boolean can bypass contradictory record/outcome/persistence evidence.
 */
import {validationDashboard,marketValidation,calibrationMetrics,stratifiedCalibration} from './validation-metrics.js';
import {compareOldNew} from './old-vs-new-comparator.js';
import {predictionMetricEligibility,paperMetricEligibility,pairedMetricEligibility} from './strict-metric-eligibility.js';
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
export function promotionStage({prediction=[],paired=[],paper=[]}={}){
  const settled=(prediction||[]).filter(x=>typeof x?.outcome?.goal_10m==='boolean').length,
    paperSettled=(paper||[]).filter(x=>x?.settled&&finite(x?.realized_return)!=null).length;
  let stage='COLLECT';if(settled>=3000)stage='STRATIFIED_REVIEW';else if(settled>=1000)stage='MEANINGFUL_COMPARISON';else if(settled>=500)stage='DIAGNOSTIC_REVIEW';
  return {stage,settled_predictions:settled,settled_paper:paperSettled,next_checkpoint:settled<500?500:settled<1000?1000:settled<3000?3000:null,
    production_ready:false,manual_review_required:true,note:'Sample checkpoint only. V2 is never auto-promoted by count alone.'};
}
function filterRows(rows,validator){const accepted=[],quarantined=[];for(const r of rows||[]){const v=validator(r);if(v.eligible)accepted.push(r);else quarantined.push({...r,__strict_reasons:v.reasons})}return {accepted,quarantined}}
function countReasons(rows){const out={};for(const r of rows||[])for(const k of r.__strict_reasons||['UNKNOWN'])out[k]=(out[k]||0)+1;return out}
function summary(total,f){return {total,included:f.accepted.length,excluded:f.quarantined.length,reasons:countReasons(f.quarantined)}}
function strictCalibration(raw,options){
  const allowSyntheticServerAck=options?.allowSyntheticServerAck===true,
    p5=filterRows(raw.prediction,r=>predictionMetricEligibility(r,'goal_5m',{allowSyntheticServerAck})),
    p10=filterRows(raw.prediction,r=>predictionMetricEligibility(r,'goal_10m',{allowSyntheticServerAck})),
    p15=filterRows(raw.prediction,r=>predictionMetricEligibility(r,'goal_15m',{allowSyntheticServerAck}));
  return {filters:{p5,p10,p15},calibration:{
    goal_5m:calibrationMetrics(p5.accepted,{probPath:'p_goal_5m',outcomePath:'outcome.goal_5m'}),
    goal_10m:calibrationMetrics(p10.accepted,{probPath:'p_goal_10m',outcomePath:'outcome.goal_10m'}),
    goal_15m:calibrationMetrics(p15.accepted,{probPath:'p_goal_15m',outcomePath:'outcome.goal_15m'}),
    by_minute_10m:stratifiedCalibration(p10.accepted,{probPath:'p_goal_10m',outcomePath:'outcome.goal_10m',groupBy:'minute_bucket'}),
    by_confidence_10m:stratifiedCalibration(p10.accepted,{probPath:'p_goal_10m',outcomePath:'outcome.goal_10m',groupBy:'confidence_band'})
  }};
}
export function buildValidationReport(data={},options={}){
  const raw={prediction:data.prediction||[],paired:data.paired||[],paper:data.paper||[]},strictMode=options?.strictMode===true;
  if(!strictMode)return {schema:'FE_PREDICTION_V2_VALIDATION_REPORT_B8',generated_at:Date.now(),strict_mode:false,
    promotion:promotionStage(raw),calibration:validationDashboard(raw.prediction),old_vs_new:compareOldNew(raw.paired),market:marketValidation(raw.paper),
    quarantine:{prediction:{total:raw.prediction.length,included:raw.prediction.length,excluded:0,reasons:{}},paired:{total:raw.paired.length,included:raw.paired.length,excluded:0,reasons:{}},paper:{total:raw.paper.length,included:raw.paper.length,excluded:0,reasons:{}}}};
  const sc=strictCalibration(raw,options),allowSyntheticServerAck=options?.allowSyntheticServerAck===true,
    xf=filterRows(raw.paired,r=>pairedMetricEligibility(r,{allowSyntheticServerAck})),mf=filterRows(raw.paper,r=>paperMetricEligibility(r,{allowSyntheticServerAck})),p10=sc.filters.p10;
  return {schema:'FE_PREDICTION_V2_VALIDATION_REPORT_B11_STRICT',generated_at:Date.now(),strict_mode:true,
    promotion:promotionStage({prediction:p10.accepted,paired:xf.accepted,paper:mf.accepted}),calibration:sc.calibration,old_vs_new:compareOldNew(xf.accepted),market:marketValidation(mf.accepted),
    quarantine:{prediction:summary(raw.prediction.length,p10),prediction_by_metric:{goal_5m:summary(raw.prediction.length,sc.filters.p5),goal_10m:summary(raw.prediction.length,p10),goal_15m:summary(raw.prediction.length,sc.filters.p15)},
      paired:summary(raw.paired.length,xf),paper:summary(raw.paper.length,mf)}};
}
