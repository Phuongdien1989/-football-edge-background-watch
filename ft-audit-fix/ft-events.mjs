// FT-only invalidation. No shared HC/HT cooldown, history, alert or score mutation.
const count=v=>Number.isInteger(v)&&v>=0;
const score=v=>v&&count(v.home)&&count(v.away)?{home:v.home,away:v.away}:null;
const same=(a,b)=>a&&b&&a.home===b.home&&a.away===b.away;
export function observeFT(item,fixture,red=null,receivedAt=Date.now()){
 if(!Number.isFinite(receivedAt)||receivedAt<=0)throw Error('INVALID_RECEIVED_AT');
 const nextScore=score(fixture?.goals),phase=fixture?.fixture?.status?.short;
 if(!nextScore||typeof phase!=='string'||!phase)return {changed:false,reason:'INVALID_FIXTURE'};
 let prev=item.ftObservation;
 if(!prev&&item.ui?.fixture)prev={goals:score(item.ui.fixture.goals),phase:item.ui.fixture.fixture?.status?.short,red:count(item.red)?item.red:null,receivedAt:Number(item.ui.captured_at)||0};
 if(prev&&receivedAt<prev.receivedAt)return {changed:false,reason:'OUT_OF_ORDER'};
 const reasons=[];
 if(prev?.goals&&!same(prev.goals,nextScore))reasons.push(nextScore.home+nextScore.away>prev.goals.home+prev.goals.away?'GOAL':'SCORE_CORRECTION');
 if(count(prev?.red)&&count(red)&&prev.red!==red)reasons.push(red>prev.red?'RED_CARD':'RED_CORRECTION');
 if(prev?.phase&&prev.phase!==phase)reasons.push('PHASE_CHANGE');
 item.ftObservation={goals:nextScore,phase,red:count(red)?red:(prev?.red??null),receivedAt};
 if(!reasons.length)return {changed:false};
 const ended=['FT','AET','PEN','CANC','ABD','AWD','WO'].includes(phase);
 item.history=[];item.ftResetAt=receivedAt;
 item.ftCooldownUntil=ended?receivedAt:receivedAt+300000;
 item.ftInvalidation={reasons,at:receivedAt,phase,goals:nextScore,ended};
 if(item.ui){
  item.ui.engines={...item.ui.engines,FT:{...item.ui.engines?.FT,score:null,scoreMode:'DATA_INCOMPLETE',hardVeto:true,dataIncomplete:true,vetoReasons:['FT_EVENT_RECONFIRMATION'],best_over:null}};
  item.ui.goal_estimates=Object.fromEntries(Object.keys(item.ui.goal_estimates||{}).map(k=>[k,{prob:null,n:0,source:'FT_EVENT_RECONFIRMATION'}]));
 }
 return {changed:true,reasons,ended};
}
// Explicit receipt/change clocks; unchanged stats are not automatically stale.
// This never changes model freshness or invents provider timestamps.
export function observeFTStats(item,metrics,receivedAt,sourceAt=null){
 if(!Number.isFinite(receivedAt)||receivedAt<=0)throw Error('INVALID_RECEIVED_AT');
 const prev=item.ftStatsClock;
 if(prev&&receivedAt<prev.receivedAt)return false;
 const fingerprint=JSON.stringify(metrics);
 item.ftStatsClock={receivedAt,sourceAt:Number.isFinite(sourceAt)&&sourceAt>0&&sourceAt<=receivedAt?sourceAt:null,
 changedAt:prev?.fingerprint===fingerprint?prev.changedAt:receivedAt,fingerprint};
 return true;
}
