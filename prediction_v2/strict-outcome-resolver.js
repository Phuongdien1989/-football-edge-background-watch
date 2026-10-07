/* FOOTBALL EDGE — Prediction V2 / Batch 02 strict outcome resolver
 * received_at determines availability/provenance; event minute determines football outcome.
 * A late score change without exact goal time creates an interval, never an invented goal minute.
 */
import {timestampIso,timestampMs,STRICT_VALID,UNKNOWN_PROVENANCE,normalizeMarketPeriod} from './observation-contract.js';
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const totalGoals=s=>{const h=finite(s?.goals?.home??s?.score_home),a=finite(s?.goals?.away??s?.score_away);return h==null||a==null?null:h+a};
const periodEnd=p=>normalizeMarketPeriod(p)==='H1'?45:90;
function eventMinute(e){
  const base=finite(e?.event_minute??e?.minute??e?.time?.elapsed??(typeof e?.time==='number'?e.time:null)),extra=finite(e?.extra??e?.time?.extra);
  return base==null?null:base+(extra&&extra>0?extra:0);
}
function isGoal(e){return String(e?.type??e?.event_type??'').toUpperCase()==='GOAL'&&!/CANCEL|CANCELLED|MISSED|NO GOAL/i.test(String(e?.detail??e?.event_detail??''))}
function evidenceRef(kind,row){return {kind,received_at:timestampIso(row?.received_at??row?.__received_at),provider_updated_at:timestampIso(row?.provider_updated_at??row?.update),source_id:row?.source_id??row?.request_id??row?.id??null}}
function evidenceStrict(refs){return refs.length>0&&refs.every(r=>timestampMs(r?.received_at)!=null)}
function windowKey(h){return `goal_${h}m`}
function windowStatus(value){return value===true?'RESOLVED_TRUE':value===false?'RESOLVED_FALSE':'UNRESOLVED'}
function compactOutcome(out){return {goal_5m:out.goal_5m,goal_10m:out.goal_10m,goal_15m:out.goal_15m,first_goal_min:out.first_goal_min,first_goal_interval:out.first_goal_interval,status:out.status,provenance_status:out.provenance_status}}

export function normalizeOutcomeEvents(events=[]){
  return (events||[]).filter(isGoal).map(e=>({minute:eventMinute(e),received_at:timestampIso(e?.received_at??e?.__received_at),provider_updated_at:timestampIso(e?.provider_updated_at??e?.update),raw:e}))
    .filter(e=>e.minute!=null).sort((a,b)=>a.minute-b.minute||(timestampMs(a.received_at)??Infinity)-(timestampMs(b.received_at)??Infinity));
}
export function normalizeOutcomeSnapshots(snapshots=[]){
  return (snapshots||[]).map(s=>({minute:finite(s?.minute??s?.fixture?.status?.elapsed),goals_total:totalGoals(s),received_at:timestampIso(s?.received_at??s?.__received_at),
    status:s?.status??s?.fixture?.status?.short??null,raw:s})).filter(s=>s.minute!=null&&s.goals_total!=null)
    .sort((a,b)=>a.minute-b.minute||(timestampMs(a.received_at)??Infinity)-(timestampMs(b.received_at)??Infinity));
}
function firstScoreIncreaseInterval(row,snapshots){
  const start=finite(row?.minute),startGoals=(finite(row?.score_home)||0)+(finite(row?.score_away)||0);if(start==null)return null;
  let prev={minute:start,goals_total:startGoals,received_at:null,raw:null};
  for(const s of snapshots){
    if(s.minute<start)continue;
    if(s.goals_total>startGoals)return {after_min:prev.minute,before_or_at_min:s.minute,upper_received_at:s.received_at,lower_received_at:prev.received_at,upper_snapshot:s.raw,lower_snapshot:prev.raw};
    if(s.goals_total===startGoals)prev=s;
  }
  return null;
}
function noGoalProofAt(row,snapshots,endMinute,ended){
  const startGoals=(finite(row?.score_home)||0)+(finite(row?.score_away)||0),candidates=snapshots.filter(s=>s.minute>=endMinute&&s.goals_total===startGoals);
  if(candidates.length){const s=candidates[0];return {value:false,refs:[evidenceRef('SCORE_SNAPSHOT',s.raw||s)],reason:'SCORE_UNCHANGED_THROUGH_WINDOW'}}
  if(ended){const last=snapshots.at(-1);if(last&&last.goals_total===startGoals)return {value:false,refs:[evidenceRef('TERMINAL_SNAPSHOT',last.raw||last)],reason:'TERMINAL_SCORE_UNCHANGED'}}
  return null;
}
export function resolveStrictGoalWindows(row,{events=[],snapshots=[],currentSnapshot=null,ended=false,changedAt=Date.now()}={}){
  if(!row)return row;const start=finite(row.minute),period=normalizeMarketPeriod(row.market_period??row?.observation?.market_period),end=periodEnd(period),
    ev=normalizeOutcomeEvents(events),sn=normalizeOutcomeSnapshots([...(snapshots||[]),...(currentSnapshot?[currentSnapshot]:[])]),
    firstEvent=ev.find(x=>x.minute>start&&x.minute<=end),interval=firstScoreIncreaseInterval(row,sn),prior=row.outcome||{},next={...prior},used=[];
  next.first_goal_min=firstEvent?.minute??null;
  next.first_goal_interval=firstEvent?null:(interval?{after_min:interval.after_min,before_or_at_min:interval.before_or_at_min}:null);
  next.window_status={...(prior.window_status||{})};next.window_evidence={...(prior.window_evidence||{})};
  for(const h of [5,10,15]){
    const k=windowKey(h),windowEnd=Math.min(end,start+h);let value=null,refs=[],reason='INSUFFICIENT_EVIDENCE';
    if(firstEvent&&firstEvent.minute<=windowEnd){value=true;refs=[evidenceRef('GOAL_EVENT',firstEvent.raw)];reason='EXACT_EVENT_TIME_IN_WINDOW'}
    else if(interval){
      if(interval.before_or_at_min<=windowEnd){value=true;refs=[evidenceRef('SCORE_SNAPSHOT',interval.upper_snapshot||{received_at:interval.upper_received_at})];reason='SCORE_INTERVAL_FULLY_WITHIN_WINDOW'}
      else if(interval.after_min>=windowEnd){value=false;refs=[evidenceRef('SCORE_SNAPSHOT',interval.lower_snapshot||{received_at:interval.lower_received_at})];reason='NO_GOAL_THROUGH_WINDOW_BOUNDARY'}
      else{value=null;refs=[evidenceRef('SCORE_SNAPSHOT',interval.upper_snapshot||{received_at:interval.upper_received_at})];reason='GOAL_INTERVAL_CROSSES_WINDOW_BOUNDARY'}
    }else{
      const proof=noGoalProofAt(row,sn,windowEnd,ended);if(proof){value=proof.value;refs=proof.refs;reason=proof.reason}
    }
    next[k]=value;next.window_status[k]=windowStatus(value);next.window_evidence[k]={reason,refs,strict_provenance:evidenceStrict(refs)};used.push(...refs);
  }
  next.settled=[5,10,15].every(h=>typeof next[windowKey(h)]==='boolean');
  next.status=next.settled?'SETTLED':([5,10,15].some(h=>typeof next[windowKey(h)]==='boolean')?'PARTIAL':'UNRESOLVED');
  const resolvedEvidence=[5,10,15].flatMap(h=>next.window_evidence[windowKey(h)]?.refs||[]).filter(Boolean);
  next.provenance_status=next.settled&&evidenceStrict(resolvedEvidence)?STRICT_VALID:UNKNOWN_PROVENANCE;
  next.strict_outcome_eligible=next.settled&&next.provenance_status===STRICT_VALID;
  const changed=JSON.stringify(compactOutcome(prior))!==JSON.stringify(compactOutcome(next));
  if(!changed)return row;
  const revision=(finite(prior.revision)||0)+1,history=[...(prior.history||[]),{revision,changed_at:timestampIso(changedAt),reason:'OUTCOME_EVIDENCE_UPDATE',prior:compactOutcome(prior),next:compactOutcome(next)}];
  next.revision=revision;next.history=history;
  return {...row,outcome:next,strict_metrics_eligible:row?.observation?.strict_metrics_eligible===true&&next.strict_outcome_eligible===true};
}

export function confirmedPeriodResult({period,snapshot=null,home=null,away=null,status=null,receivedAt=null,confirmed=false}={}){
  const p=normalizeMarketPeriod(period),h=finite(home??snapshot?.goals?.home??snapshot?.score_home),a=finite(away??snapshot?.goals?.away??snapshot?.score_away),
    st=String(status??snapshot?.status??snapshot?.fixture?.status?.short??'').toUpperCase(),recv=timestampIso(receivedAt??snapshot?.received_at??snapshot?.__received_at);
  return {period:p,home:h,away:a,status:st,received_at:recv,confirmed:confirmed===true&&!!p&&h!=null&&a!=null,provenance_status:recv?STRICT_VALID:UNKNOWN_PROVENANCE};
}