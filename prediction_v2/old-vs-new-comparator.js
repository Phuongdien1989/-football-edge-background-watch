/* FOOTBALL EDGE — Prediction V2 / B5
 * Paired comparison of OLD TOP visibility vs NEW shadow ranking/value status.
 * Does not create thresholds. Selection flags must be supplied by the caller.
 */
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const round=(v,d=3)=>{const n=finite(v);if(n==null)return null;const p=10**d;return Math.round(n*p)/p};
const outcome=v=>v===true||v===1||v==='1'?1:v===false||v===0||v==='0'?0:null;
function stats(rows,flag){
  const selected=rows.filter(r=>Boolean(r[flag])),settled=selected.map(r=>outcome(r.hit)).filter(v=>v!=null);
  return {selected:selected.length,coverage_pct:rows.length?round(selected.length/rows.length*100,2):null,settled:settled.length,hit_rate_pct:settled.length?round(settled.reduce((a,b)=>a+b,0)/settled.length*100,2):null};
}
export function compareOldNew(rows=[]){
  const valid=(rows||[]).filter(r=>r&&r.observation_id!=null),old=stats(valid,'old_selected'),newRank=stats(valid,'new_ranked'),newEdge=stats(valid,'new_positive_edge');
  const paired=valid.filter(r=>Boolean(r.old_selected)!==Boolean(r.new_ranked)),oldOnly=paired.filter(r=>r.old_selected&&!r.new_ranked),newOnly=paired.filter(r=>!r.old_selected&&r.new_ranked),
    both=valid.filter(r=>r.old_selected&&r.new_ranked),neither=valid.filter(r=>!r.old_selected&&!r.new_ranked);
  const hitRate=a=>{const x=a.map(r=>outcome(r.hit)).filter(v=>v!=null);return x.length?round(x.reduce((s,v)=>s+v,0)/x.length*100,2):null};
  return {n:valid.length,old,new_ranked:newRank,new_positive_edge:newEdge,agreement:{both:both.length,neither:neither.length,old_only:oldOnly.length,new_only:newOnly.length,
    disagreement_rate_pct:valid.length?round(paired.length/valid.length*100,2):null,old_only_hit_rate_pct:hitRate(oldOnly),new_only_hit_rate_pct:hitRate(newOnly)}};
}
export function buildPairedObservation({id,fixtureId,capturedAt,oldRankMeta,newOpportunity,hit,league=null,minute=null,observation=null}={}){
  const oldSelected=oldRankMeta?.eligible===true,newRank=finite(newOpportunity?.rank),newRanked=newRank!=null&&newRank<=3,
    ev=finite(newOpportunity?.best_market?.edge?.expected_return),newPositive=ev!=null&&ev>0;
  return {observation_id:id||observation?.observation_id||`${fixtureId}:${capturedAt}`,fixture_id:Number(fixtureId)||null,captured_at:capturedAt||null,league,minute,
    market_period:observation?.market_period||newOpportunity?.market_period||null,evaluation_cutoff:observation?.evaluation_cutoff||null,
    prediction_created_at:observation?.prediction_created_at||capturedAt||null,persisted_at:observation?.persisted_at||null,
    persistence_status:observation?.persistence_status||'UNVERIFIED',strict_replay_status:observation?.strict_replay_status||'UNKNOWN_PROVENANCE',
    strict_metrics_eligible:observation?.strict_metrics_eligible===true,old_selected:oldSelected,old_state_rank:finite(oldRankMeta?.primary?.stateRank),
    new_ranked:newRanked,new_rank:newRank,new_positive_edge:newPositive,new_expected_return:ev,hit:outcome(hit)};
}