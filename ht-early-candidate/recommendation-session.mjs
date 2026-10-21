// Five-minute recommendation records. No network, timers, bets or Push calls.
export const SESSION_MS=300000;
const copy=x=>JSON.parse(JSON.stringify(x));
const num=x=>typeof x==='number'&&Number.isFinite(x);
const red=item=>num(item.latest?.metrics?.total?.red)?item.latest.metrics.total.red:null;
const score=item=>({home:item.latest?.goals?.home,away:item.latest?.goals?.away});
export function createHTSessionBook({saved=null,onEvent=()=>{}}={}) {
 const sessions=new Map(),history=[];let sequence=0;
 if(saved?.version===1){
  for(const s of saved.sessions||[])if(Number.isSafeInteger(s?.fixtureId)&&num(s.startedAt)&&num(s.expiresAt)&&s.expiresAt-s.startedAt===SESSION_MS&&s.original?.period==='H1')sessions.set(s.fixtureId,copy(s));
  history.push(...(saved.history||[]).slice(-100));sequence=Number.isSafeInteger(saved.sequence)?saved.sequence:0;
 }
 function event(s,type,at){onEvent({id:s.id+':'+type,type,sessionId:s.id,fixtureId:s.fixtureId,at});}
 function close(s,reason,now){
  if(s.closedAt)return;
  s.closedAt=now;s.closeReason=reason;s.state=reason==='EXPIRED'?'EXPIRED':'INVALIDATED';
  history.push(copy(s));if(history.length>100)history.shift();event(s,'CLOSED_'+reason,now);
 }
 function read(id){const s=sessions.get(Number(id));return s?copy(s):null;}
 function update(item,row,now=Date.now()){
  if(!Number.isSafeInteger(item?.id)||!num(now))return null;
  let s=sessions.get(item.id),g=score(item),phase=item.latest?.status;
  if(s&&!s.closedAt){
   const changed=g.home!==s.original.score.home||g.away!==s.original.score.away;
   const redChanged=red(item)!==s.original.red;
   const reset=num(item.resetAt)&&item.resetAt>s.original.snapshotAt;
   if(changed)close(s,'SCORE_CHANGED',now);
   else if(!['1H','LIVE'].includes(phase))close(s,'HALF_ENDED',now);
   else if(redChanged)close(s,'RED_STATE_CHANGED',now);
   else if(reset||item.cooldownUntil>now)close(s,'RESET_OR_COOLDOWN',now);
   else if(now<s.startedAt)close(s,'CLOCK_CHANGED',now);
   else if(now>=s.expiresAt)close(s,'EXPIRED',now);
  }
  // Invalidated sessions require a later source observation; never reopen from
  // the exact snapshot that cancelled them. Expiry may renew from fresh data.
  const canOpen=!s||s.closeReason==='EXPIRED'||(s.closedAt&&item.latest?.fresh_at>Math.max(s.closedAt,s.original.snapshotAt));
  if((!s||s.closedAt)&&canOpen&&row?.action==='TRIAL_OVER'&&row.dataOK&&row.marketOK&&row.modelOK&&row.quote?.ev>0){
   s={id:item.id+':'+now+':'+(++sequence),fixtureId:item.id,startedAt:now,expiresAt:now+SESSION_MS,state:'ACTIVE',
    original:{period:'H1',selection:'OVER',line:row.recommendation.line,odds:row.recommendation.odds,score:g,red:red(item),snapshotAt:row.at,minute:row.minute,
     fairOdds:row.quote.fairOdds,ev:row.quote.ev,modelVersion:row.model?.version??null},current:null};
   sessions.set(item.id,s);event(s,'OPENED',now);
  }
  if(!s)return null;
  if(!s.closedAt){
   const next=!row?.dataOK||!row?.modelOK?'WAIT_DATA':!row.marketOK||row.recommendation.line!==s.original.line||!(row.quote?.ev>0)?'WAIT_PRICE':'ACTIVE';
   if(next!==s.state){s.state=next;event(s,'STATE_'+next+':'+(row?.at??now),now);}
   const current={at:row?.at??null,line:row?.recommendation?.line??null,odds:row?.recommendation?.odds??null,fairOdds:row?.quote?.fairOdds??null,ev:row?.quote?.ev??null,state:next};
   if(JSON.stringify(s.current)!==JSON.stringify(current))s.current=current;
  }
  // Only expose remaining time as a derived view; never extend expiresAt.
  return {...copy(s),remainingMs:s.closedAt?0:Math.max(0,s.expiresAt-now)};
 }
 return {read,update,export(){return {version:1,sequence,sessions:[...sessions.values()].slice(-50).map(copy),history:history.slice(-100).map(copy)};}};
}
