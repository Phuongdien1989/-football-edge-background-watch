/* FOOTBALL EDGE — Prediction V2 / B8-B9
 * Builds validation report and non-automatic promotion stage.
 */
import {validationDashboard,marketValidation} from './validation-metrics.js';
import {compareOldNew} from './old-vs-new-comparator.js';
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
export function promotionStage({prediction=[],paired=[],paper=[]}={}){
  const settled=(prediction||[]).filter(x=>x?.outcome?.settled&&typeof x?.outcome?.goal_10m==='boolean').length,
    paperSettled=(paper||[]).filter(x=>x?.settled&&finite(x?.realized_return)!=null).length;
  let stage='COLLECT';if(settled>=3000)stage='STRATIFIED_REVIEW';else if(settled>=1000)stage='MEANINGFUL_COMPARISON';else if(settled>=500)stage='DIAGNOSTIC_REVIEW';
  return {stage,settled_predictions:settled,settled_paper:paperSettled,next_checkpoint:settled<500?500:settled<1000?1000:settled<3000?3000:null,
    production_ready:false,manual_review_required:true,note:'Sample checkpoint only. V2 is never auto-promoted by count alone.'};
}
export function buildValidationReport(data={}){
  const prediction=data.prediction||[],paired=data.paired||[],paper=data.paper||[];
  return {schema:'FE_PREDICTION_V2_VALIDATION_REPORT_B8',generated_at:Date.now(),promotion:promotionStage({prediction,paired,paper}),
    calibration:validationDashboard(prediction),old_vs_new:compareOldNew(paired),market:marketValidation(paper)};
}
