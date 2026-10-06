/* FOOTBALL EDGE — Prediction V2 / B3
 * Compact evidence journal for shadow predictions. No D1 schema required.
 */
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const round=(v,d=3)=>{const n=finite(v);if(n==null)return null;const p=10**d;return Math.round(n*p)/p};
export function compactShadowEvidence({item,packet,prediction,context=null,now=Date.now()}={}){
  const s=item?.latest||{},p=prediction?.probabilities||{};
  return {
    schema:'FE_PREDICTION_V2_EVIDENCE_B3',id:`${item?.id??packet?.fixture_id}:${packet?.engine||'NA'}:${now}`,
    fixture_id:Number(item?.id??packet?.fixture_id)||null,engine:packet?.engine||null,captured_at:now,
    minute:finite(s.minute??packet?.state?.minute),score_home:finite(s?.goals?.home??packet?.state?.score_home),
    score_away:finite(s?.goals?.away??packet?.state?.score_away),p_goal_5m:finite(p.goal_5m),p_goal_10m:finite(p.goal_10m),
    p_goal_15m:finite(p.goal_15m),p_home_next:finite(p.home_next_goal_given_goal),confidence:finite(prediction?.confidence?.score_100),
    confidence_band:prediction?.confidence?.band||null,live_index:finite(prediction?.live_update?.index),
    hazard_multiplier:finite(prediction?.live_update?.hazard_multiplier),base_lambda:finite(prediction?.base?.lambda_match),
    base_source:prediction?.base?.source||null,dq:round(packet?.quality?.dq,3),score_mode:packet?.quality?.score_mode||null,
    context_present:!!context,market_used:false,outcome:{goal_5m:null,goal_10m:null,goal_15m:null,first_goal_min:null,settled:false}
  };
}
export function shouldRecordShadow(prev,next,{minIntervalMs=60000,probabilityDeltaPct=3,confidenceDelta=8}={}){
  if(!prev)return true;
  if(Number(prev.fixture_id)!==Number(next.fixture_id)||String(prev.engine)!==String(next.engine))return true;
  const dt=Number(next.captured_at)-Number(prev.captured_at);
  if(dt>=minIntervalMs)return true;
  if(Number(prev.score_home)!==Number(next.score_home)||Number(prev.score_away)!==Number(next.score_away))return true;
  if(Math.abs((Number(next.p_goal_10m)||0)-(Number(prev.p_goal_10m)||0))>=probabilityDeltaPct)return true;
  if(Math.abs((Number(next.confidence)||0)-(Number(prev.confidence)||0))>=confidenceDelta)return true;
  return false;
}
export function settleShadowEvidence(row,snapshot,{ended=false}={}){
  if(!row||row.outcome?.settled)return row;
  const s=snapshot||{},minute=finite(s.minute),goals=(finite(s?.goals?.home)||0)+(finite(s?.goals?.away)||0),
    start=(finite(row.score_home)||0)+(finite(row.score_away)||0),out={...(row.outcome||{})};
  if(goals>start&&out.first_goal_min==null)out.first_goal_min=minute??row.minute;
  for(const h of [5,10,15]){
    const k=`goal_${h}m`;
    if(out[k]==null){
      if(out.first_goal_min!=null)out[k]=(Number(out.first_goal_min)-Number(row.minute))<=h;
      else if(minute!=null&&minute>=Number(row.minute)+h)out[k]=false;
    }
  }
  if(ended){
    for(const h of [5,10,15])if(out[`goal_${h}m`]==null)out[`goal_${h}m`]=false;
    out.settled=true;
  }else if([5,10,15].every(h=>typeof out[`goal_${h}m`]==='boolean'))out.settled=true;
  return {...row,outcome:out};
}
