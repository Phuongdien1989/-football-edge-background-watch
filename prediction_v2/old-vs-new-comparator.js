/* FOOTBALL EDGE — Prediction V2 / B5 + Batch 02.1
 * Paired comparison of OLD visibility vs NEW shadow ranking/value status.
 * Eligibility is validated elsewhere; this record only freezes comparison inputs.
 */
import {contentFingerprint,UNKNOWN_PROVENANCE,PERSISTENCE_UNVERIFIED} from './observation-contract.js';
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const round=(v,d=3)=>{const n=finite(v);if(n==null)return null;const p=10**d;return Math.round(n*p)/p};
const outcome=v=>v===true||v===1||v==='1'?1:v===false||v===0||v==='0'?0:null;
function stats(rows,flag){const selected=rows.filter(r=>Boolean(r[flag])),settled=selected.map(r=>outcome(r.hit)).filter(v=>v!=null);return {selected:selected.length,coverage_pct:rows.length?round(selected.length/rows.length*100,2):null,settled:settled.length,hit_rate_pct:settled.length?round(settled.reduce((a,b)=>a+b,0)/settled.length*100,2):null}}
export function compareOldNew(rows=[]){
  const valid=(rows||[]).filter(r=>r&&r.observation_id!=null),old=stats(valid,'old_selected'),newRank=stats(valid,'new_ranked'),newEdge=stats(valid,'new_positive_edge'),
    paired=valid.filter(r=>Boolean(r.old_selected)!==Boolean(r.new_ranked)),oldOnly=paired.filter(r=>r.old_selected&&!r.new_ranked),newOnly=paired.filter(r=>!r.old_selected&&r.new_ranked),both=valid.filter(r=>r.old_selected&&r.new_ranked),neither=valid.filter(r=>!r.old_selected&&!r.new_ranked),
    hitRate=a=>{const x=a.map(r=>outcome(r.hit)).filter(v=>v!=null);return x.length?round(x.reduce((s,v)=>s+v,0)/x.length*100,2):null};
  return {n:valid.length,old,new_ranked:newRank,new_positive_edge:newEdge,agreement:{both:both.length,neither:neither.length,old_only:oldOnly.length,new_only:newOnly.length,disagreement_rate_pct:valid.length?round(paired.length/valid.length*100,2):null,old_only_hit_rate_pct:hitRate(oldOnly),new_only_hit_rate_pct:hitRate(newOnly)}};
}
export function buildPairedObservation({id,fixtureId,capturedAt,oldRankMeta,newOpportunity,hit,league=null,minute=null,observation=null,oldEvaluationStatus=UNKNOWN_PROVENANCE,newEvaluationStatus=UNKNOWN_PROVENANCE}={}){
  const oldSelected=oldRankMeta?.eligible===true,newRank=finite(newOpportunity?.rank),newRanked=newRank!=null&&newRank<=3,ev=finite(newOpportunity?.best_market?.edge?.expected_return),newPositive=ev!=null&&ev>0,
    oid=id||observation?.observation_id||`${fixtureId}:${capturedAt}`,base={schema:'FE_PV2_OLD_NEW_PAIR_V2',observation_id:oid,fixture_id:Number(fixtureId)||null,captured_at:capturedAt||null,league,minute,
      observation,market_period:observation?.market_period||newOpportunity?.market_period||null,evaluation_cutoff:observation?.evaluation_cutoff||null,prediction_created_at:observation?.prediction_created_at||capturedAt||null,
      old_selected:oldSelected,old_state_rank:finite(oldRankMeta?.primary?.stateRank),new_ranked:newRanked,new_rank:newRank,new_positive_edge:newPositive,new_expected_return:ev,
      old_evaluation_status:oldEvaluationStatus,new_evaluation_status:newEvaluationStatus,hit:outcome(hit),outcome_provenance_status:UNKNOWN_PROVENANCE,outcome_received_at:null};
  const fp=contentFingerprint(base);return {...base,id:oid,content_fingerprint:fp,persisted_at:null,persistence_status:PERSISTENCE_UNVERIFIED,persistence_ack:null,strict_metrics_eligible:null};
}
