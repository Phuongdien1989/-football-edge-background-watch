/* FOOTBALL EDGE — Prediction V2 / Batch 02.1 strict outcome resolver
 * Temporal rules:
 * - received_at controls what may be trusted as evidence provenance.
 * - football event clock controls the factual outcome.
 * - H1 45+N and H2 minute 45+N are distinct because every clock carries a phase.
 * - period end is evidence-driven (HT/FT/etc.), never assumed to be exactly 45/90.
 * - outcome evidence is accumulated by evidence ID; an omitted event in a later incremental batch is NOT a cancellation.
 * - an explicit correction with the same provider/source ID may replace prior evidence and is audit-trailed.
 */
import {timestampIso,timestampMs,STRICT_VALID,UNKNOWN_PROVENANCE,normalizeMarketPeriod,contentFingerprint} from './observation-contract.js';
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const totalGoals=s=>{const h=finite(s?.goals?.home??s?.score_home),a=finite(s?.goals?.away??s?.score_away);return h==null||a==null?null:h+a};
const TERMINAL_FT=new Set(['FT','AET','PEN','CANC','CANCELLED','ABD','ABANDONED','AWD','WO']);
const normalizePhase=v=>{const s=String(v??'').trim().toUpperCase().replace(/[\s_-]+/g,'');if(['H1','1H','FIRSTHALF','1STHALF'].includes(s))return 'H1';if(['H2','2H','SECONDHALF','2NDHALF'].includes(s))return 'H2';return null};
function phaseFromStatus(v){const s=String(v??'').toUpperCase();if(s==='1H'||s==='HT')return 'H1';if(s==='2H'||TERMINAL_FT.has(s))return 'H2';return null}
function inferPhase({explicit=null,status=null,base=null,extra=null,targetPeriod=null}={}){
  const x=normalizePhase(explicit)||phaseFromStatus(status);if(x)return x;
  const b=finite(base),e=finite(extra);if(b==null)return normalizeMarketPeriod(targetPeriod)==='H1'?'H1':null;
  if(b<45)return 'H1';if(b===45&&e!=null&&e>0)return 'H1';if(b<=45&&normalizeMarketPeriod(targetPeriod)==='H1')return 'H1';return 'H2';
}
export function normalizeMatchClock(input={},targetPeriod=null){
  if(input?.absolute_minute!=null&&input?.period){
    const period=normalizePhase(input.period)||normalizeMarketPeriod(input.period),abs=finite(input.absolute_minute),base=finite(input.regulation_minute??input.minute),extra=finite(input.stoppage_minute??input.extra)||0;
    return abs==null?null:{period,regulation_minute:base,stoppage_minute:extra,absolute_minute:abs,display:input.display||`${base??abs}${extra>0?`+${extra}`:''}`};
  }
  const time=input?.time&&typeof input.time==='object'?input.time:{},base=finite(input?.event_minute??input?.minute??input?.fixture?.status?.elapsed??time?.elapsed??(typeof input?.time==='number'?input.time:null)),
    extra=finite(input?.extra??input?.stoppage??time?.extra)||0,status=input?.status??input?.fixture?.status?.short??null,
    explicit=input?.period??input?.phase??input?.half??input?.match_period??null,period=inferPhase({explicit,status,base,extra,targetPeriod});
  if(base==null||!period)return null;const abs=base+(extra>0?extra:0);return {period,regulation_minute:base,stoppage_minute:extra,absolute_minute:abs,display:`${base}${extra>0?`+${extra}`:''}`};
}
function eventState(e){const type=String(e?.type??e?.event_type??'').toUpperCase(),detail=String(e?.detail??e?.event_detail??'').toUpperCase();if(type!=='GOAL')return null;return /CANCEL|CANCELLED|NO GOAL|DISALLOW/.test(detail)?'CANCELLED':/MISSED/.test(detail)?'NON_GOAL':'ACTIVE'}
function baseEvidenceId(kind,row,clock){const explicit=row?.source_id??row?.event_id??row?.id??row?.request_id??null;if(explicit!=null)return `${kind}:${explicit}`;return `${kind}:${contentFingerprint({clock,team:row?.team?.id??row?.team_id??null,player:row?.player?.id??row?.player_id??null,type:row?.type??null})}`}
function evidenceRef(kind,row){return {kind,evidence_id:row?.evidence_id??null,received_at:timestampIso(row?.received_at??row?.__received_at),provider_updated_at:timestampIso(row?.provider_updated_at??row?.update),source_id:row?.source_id??row?.request_id??row?.id??null,payload_hash:row?.payload_hash??null}}
function evidenceStrict(refs){return refs.length>0&&refs.every(r=>timestampMs(r?.received_at)!=null)}
function allowedForTarget(clock,targetPeriod,startClock){const target=normalizeMarketPeriod(targetPeriod);if(!clock)return false;if(target==='H1'&&clock.period!=='H1')return false;if(target==='H2'&&clock.period!=='H2')return false;if(target==='FT'&&!['H1','H2'].includes(clock.period))return false;if(startClock&&clock.absolute_minute<startClock.absolute_minute)return false;if(startClock&&target!=='FT'&&clock.period!==startClock.period)return false;return true}
function receivedRank(v){const t=timestampMs(v);return t==null?-Infinity:t}
function mergeLedger(prior=[],incoming=[]){const m=new Map();for(const x of prior||[])if(x?.evidence_id)m.set(x.evidence_id,x);for(const x of incoming||[]){if(!x?.evidence_id)continue;const p=m.get(x.evidence_id);if(!p||receivedRank(x.received_at)>=receivedRank(p.received_at))m.set(x.evidence_id,x)}return [...m.values()].sort((a,b)=>(a.clock?.absolute_minute??Infinity)-(b.clock?.absolute_minute??Infinity)||receivedRank(a.received_at)-receivedRank(b.received_at))}
export function normalizeOutcomeEvents(events=[],targetPeriod=null){
  const out=[];for(const e of events||[]){const state=eventState(e);if(!state)continue;const clock=normalizeMatchClock(e,targetPeriod);if(!clock)continue;out.push({evidence_id:baseEvidenceId('EVENT',e,clock),state,clock,received_at:timestampIso(e?.received_at??e?.__received_at),provider_updated_at:timestampIso(e?.provider_updated_at??e?.update),source_id:e?.source_id??e?.request_id??e?.id??null,payload_hash:e?.payload_hash??null,raw:e})}return out;
}
export function normalizeOutcomeSnapshots(snapshots=[],targetPeriod=null){
  const out=[];for(const s of snapshots||[]){const clock=normalizeMatchClock(s,targetPeriod),goals=totalGoals(s);if(!clock||goals==null)continue;const status=String(s?.status??s?.fixture?.status?.short??'').toUpperCase();out.push({evidence_id:baseEvidenceId('SNAPSHOT',s,clock),clock,goals_total:goals,status,received_at:timestampIso(s?.received_at??s?.__received_at),provider_updated_at:timestampIso(s?.provider_updated_at??s?.update),source_id:s?.source_id??s?.request_id??s?.id??null,payload_hash:s?.payload_hash??null,raw:s})}return out;
}
function observationClock(row,target){return normalizeMatchClock(row?.match_clock||{minute:row?.minute,status:row?.status,period:target==='H1'?'H1':target==='H2'?'H2':null},target)}
function firstScoreIncreaseInterval(row,snapshots,startClock,target){
  const startGoals=(finite(row?.score_home)||0)+(finite(row?.score_away)||0);let prev=null;
  for(const s of snapshots.filter(x=>allowedForTarget(x.clock,target,startClock)).sort((a,b)=>a.clock.absolute_minute-b.clock.absolute_minute)){
    if(s.goals_total>startGoals)return {after_clock:prev?.clock||startClock,before_or_at_clock:s.clock,upper:s,lower:prev};
    if(s.goals_total===startGoals)prev=s;
  }return null;
}
function periodEndEvidence(target,snapshots,events,startClock,endedFlag){
  const targetP=normalizeMarketPeriod(target),terms=[];
  for(const s of snapshots){const st=String(s.status||'').toUpperCase(),isEnd=targetP==='H1'?(st==='HT'||st==='2H'||TERMINAL_FT.has(st)):(targetP==='H2'||targetP==='FT'?TERMINAL_FT.has(st):false);if(isEnd)terms.push(s)}
  const matching=[...snapshots,...events].filter(x=>allowedForTarget(x.clock,targetP,startClock)),maxClock=matching.reduce((m,x)=>!m||x.clock.absolute_minute>m.absolute_minute?x.clock:m,null),term=terms.sort((a,b)=>b.clock.absolute_minute-a.clock.absolute_minute)[0]||null;
  if(!term&&!endedFlag)return {ended:false,end_clock:null,ref:null,known:false};
  const endClock=maxClock&&(!term||maxClock.absolute_minute>term.clock.absolute_minute)?maxClock:term?.clock||null,ref=term?evidenceRef('PERIOD_END_SNAPSHOT',term):null;
  return {ended:true,end_clock:endClock,ref,known:!!endClock};
}
function noGoalProofAt(row,snapshots,startClock,target,windowEnd){const startGoals=(finite(row?.score_home)||0)+(finite(row?.score_away)||0),s=snapshots.filter(x=>allowedForTarget(x.clock,target,startClock)&&x.clock.absolute_minute>=windowEnd&&x.goals_total===startGoals).sort((a,b)=>a.clock.absolute_minute-b.clock.absolute_minute)[0];return s?{value:false,refs:[evidenceRef('SCORE_SNAPSHOT',s)],reason:'SCORE_UNCHANGED_THROUGH_WINDOW'}:null}
function windowKey(h){return `goal_${h}m`}
function windowStatus(value,reason){if(reason==='CENSORED_PERIOD_END')return 'CENSORED';return value===true?'RESOLVED_TRUE':value===false?'RESOLVED_FALSE':'UNRESOLVED'}
function compactOutcome(out){return {goal_5m:out.goal_5m,goal_10m:out.goal_10m,goal_15m:out.goal_15m,first_goal_min:out.first_goal_min,first_goal_clock:out.first_goal_clock,first_goal_interval:out.first_goal_interval,status:out.status,provenance_status:out.provenance_status,window_status:out.window_status}}
function targetWindow(row,k,h){const t=row?.observation?.target?.windows?.[k]??row?.target?.windows?.[k]??null;return t||{requested_horizon_min:h,model_horizon_min:null,model_target_compatible:false,mismatch_reason:'TARGET_CONTRACT_MISSING'}}

export function resolveStrictGoalWindows(row,{events=[],snapshots=[],currentSnapshot=null,ended=false,changedAt=Date.now()}={}){
  if(!row)return row;const target=normalizeMarketPeriod(row.market_period??row?.observation?.market_period),startClock=observationClock(row,target);if(!startClock)return row;
  const prior=row.outcome||{},priorLedger=prior.evidence_ledger||{events:[],snapshots:[]},incomingEvents=normalizeOutcomeEvents(events,target),incomingSnapshots=normalizeOutcomeSnapshots([...(snapshots||[]),...(currentSnapshot?[currentSnapshot]:[])],target),
    eventLedger=mergeLedger(priorLedger.events,incomingEvents),snapshotLedger=mergeLedger(priorLedger.snapshots,incomingSnapshots),activeEvents=eventLedger.filter(x=>x.state==='ACTIVE'),
    eligibleGoals=activeEvents.filter(x=>allowedForTarget(x.clock,target,startClock)&&x.clock.absolute_minute>startClock.absolute_minute).sort((a,b)=>a.clock.absolute_minute-b.clock.absolute_minute),
    firstEvent=eligibleGoals[0]||null,interval=firstScoreIncreaseInterval(row,snapshotLedger,startClock,target),periodEnd=periodEndEvidence(target,snapshotLedger,eventLedger,startClock,ended),next={...prior};
  next.evidence_ledger={events:eventLedger,snapshots:snapshotLedger};next.first_goal_min=firstEvent?.clock?.absolute_minute??null;next.first_goal_clock=firstEvent?.clock??null;
  next.first_goal_interval=firstEvent?null:(interval?{after_clock:interval.after_clock,before_or_at_clock:interval.before_or_at_clock}:null);next.window_status={};next.window_evidence={};
  for(const h of [5,10,15]){
    const k=windowKey(h),tw=targetWindow(row,k,h),requested=finite(tw.requested_horizon_min)??h,windowEnd=startClock.absolute_minute+requested;let value=null,refs=[],reason='INSUFFICIENT_EVIDENCE';
    if(firstEvent&&firstEvent.clock.absolute_minute<=windowEnd){value=true;refs=[evidenceRef('GOAL_EVENT',firstEvent)];reason='EXACT_EVENT_CLOCK_IN_WINDOW'}
    else if(interval){const upper=interval.before_or_at_clock.absolute_minute,lower=interval.after_clock.absolute_minute;if(upper<=windowEnd){value=true;refs=[evidenceRef('SCORE_SNAPSHOT',interval.upper)];reason='SCORE_INTERVAL_FULLY_WITHIN_WINDOW'}else if(lower>=windowEnd&&interval.lower){value=false;refs=[evidenceRef('SCORE_SNAPSHOT',interval.lower)];reason='NO_GOAL_THROUGH_WINDOW_BOUNDARY'}else{value=null;refs=[evidenceRef('SCORE_SNAPSHOT',interval.upper)];reason='GOAL_INTERVAL_CROSSES_WINDOW_BOUNDARY'}}
    else{const proof=noGoalProofAt(row,snapshotLedger,startClock,target,windowEnd);if(proof){value=proof.value;refs=proof.refs;reason=proof.reason}else if(periodEnd.ended&&periodEnd.known&&periodEnd.end_clock.absolute_minute<windowEnd){value=null;refs=periodEnd.ref?[periodEnd.ref]:[];reason='CENSORED_PERIOD_END'}else if(periodEnd.ended&&!periodEnd.known){reason='PERIOD_ENDED_CLOCK_UNKNOWN'}}
    const strictProv=value===null?false:evidenceStrict(refs),targetCompatible=tw.model_target_compatible===true;
    next[k]=value;next.window_status[k]=windowStatus(value,reason);next.window_evidence[k]={reason,refs,strict_provenance:strictProv,requested_horizon_min:requested,model_horizon_min:finite(tw.model_horizon_min),model_target_compatible:targetCompatible,mismatch_reason:tw.mismatch_reason??null,
      metric_eligible:typeof value==='boolean'&&strictProv&&targetCompatible,period_end:periodEnd.ended?{known:periodEnd.known,clock:periodEnd.end_clock}:null};
  }
  next.settled=[5,10,15].every(h=>typeof next[windowKey(h)]==='boolean'||next.window_status[windowKey(h)]==='CENSORED');
  next.status=next.settled?'SETTLED_OR_CENSORED':([5,10,15].some(h=>typeof next[windowKey(h)]==='boolean')?'PARTIAL':'UNRESOLVED');
  const strictWindows=[5,10,15].map(h=>next.window_evidence[windowKey(h)]).filter(Boolean);next.provenance_status=strictWindows.some(x=>x.metric_eligible)?STRICT_VALID:UNKNOWN_PROVENANCE;
  next.strict_outcome_eligible=strictWindows.length===3&&strictWindows.every(x=>x.metric_eligible===true)?true:null;next.period_clock_contract='PHASED_MATCH_CLOCK_V1';
  const changed=JSON.stringify(compactOutcome(prior))!==JSON.stringify(compactOutcome(next))||JSON.stringify(priorLedger)!==JSON.stringify(next.evidence_ledger);if(!changed)return row;
  const revision=(finite(prior.revision)||0)+1,history=[...(prior.history||[]),{revision,changed_at:timestampIso(changedAt),reason:'OUTCOME_EVIDENCE_MERGE_OR_CORRECTION',prior:compactOutcome(prior),next:compactOutcome(next)}];next.revision=revision;next.history=history;
  return {...row,outcome:next};
}

export function confirmedPeriodResult({period,snapshot=null,home=null,away=null,status=null,receivedAt=null,confirmed=false,clock=null}={}){
  const p=normalizeMarketPeriod(period),h=finite(home??snapshot?.goals?.home??snapshot?.score_home),a=finite(away??snapshot?.goals?.away??snapshot?.score_away),st=String(status??snapshot?.status??snapshot?.fixture?.status?.short??'').toUpperCase(),recv=timestampIso(receivedAt??snapshot?.received_at??snapshot?.__received_at),mc=clock??normalizeMatchClock(snapshot||{},p);
  return {period:p,home:h,away:a,status:st,received_at:recv,match_clock:mc,confirmed:confirmed===true&&!!p&&h!=null&&a!=null,provenance_status:recv?STRICT_VALID:UNKNOWN_PROVENANCE};
}
