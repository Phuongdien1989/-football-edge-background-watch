import {createEngine as createBaseEngine} from './notify-core.js';

// H1 WATCH evaluator copied from the stable Football Edge frontend baseline.
// This module is additive: notify-core.js remains unchanged.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const metricAvailable=(s,k)=>k==='red'||s?.stats_presence?.[k]===true;
function metricDelta(cur,old){
  const out={};
  for(const k of ['shots','sot','inbox','corners','xg','red']){
    if(k!=='red'&&(!metricAvailable(cur,k)||!metricAvailable(old,k))){out[k]=null;continue}
    out[k]=Math.max(0,(Number(cur?.metrics?.total?.[k])||0)-(Number(old?.metrics?.total?.[k])||0));
  }
  return out;
}
function findBaseline(item,cur,minutes){
  const rows=(item.history||[]).filter(s=>Number(s.captured_at)<Number(cur.captured_at)&&(!item.resetAt||s.captured_at>=item.resetAt));
  if(!rows.length)return null;
  const target=cur.captured_at-minutes*60000;let pick=rows[0],best=Infinity;
  for(const r of rows){const diff=Math.abs(Number(r.captured_at)-target);if(diff<best){pick=r;best=diff}}
  return pick;
}
function windowFor(item,cur,minutes){
  const base=findBaseline(item,cur,minutes);
  if(!base)return {mature:false,window_min:0,delta:{shots:0,sot:0,inbox:0,corners:0,xg:0,red:0},base:null};
  const win=Math.max(.1,(cur.captured_at-base.captured_at)/60000);
  return {mature:win>=Math.min(1,minutes*.4),window_min:Math.round(win*10)/10,delta:metricDelta(cur,base),base};
}
function historyAge(item,cur){
  const rows=(item.history||[]).filter(s=>Number(s.captured_at)<=Number(cur.captured_at)&&(!item.resetAt||Number(s.captured_at)>=Number(item.resetAt)));
  if(rows.length<2)return 0;
  const first=rows.reduce((a,b)=>Number(a.captured_at)<=Number(b.captured_at)?a:b);
  return Math.max(0,Math.round(((Number(cur.captured_at)-Number(first.captured_at))/60000)*10)/10);
}
function displayWindow(item,cur,minutes){
  const age=historyAge(item,cur);
  if(age<2)return {status:'baseline',target:minutes,age,window_min:0,delta:null};
  const w=windowFor(item,cur,minutes);
  if(!w.base)return {status:'baseline',target:minutes,age,window_min:0,delta:null};
  if(w.window_min>minutes*1.30)return {status:'gap',target:minutes,age,window_min:w.window_min,delta:null};
  const complete=w.window_min>=minutes*.80;
  return {status:complete?'complete':'partial',target:minutes,age,window_min:w.window_min,delta:w.delta};
}
function gameScore(s){
  const m=Number(s.minute||0),h=Number(s.goals?.home||0),a=Number(s.goals?.away||0),gap=Math.abs(h-a),tg=h+a;let x=0;
  x+=m>=28&&m<=38?7:m>=39&&m<=42?6:m>=23&&m<=27?5:m>=43&&m<=44?4:m>=20&&m<=22?3:2;
  x+=gap===0?4:gap===1?3:gap===2?1:0;
  x+=tg<=1?3:tg<=2?2:1;
  x+=s.status==='1H'?1:0;
  return clamp(Math.round(x),0,15);
}
function pressure(item,s){
  const w5=windowFor(item,s,5),w10=windowFor(item,s,10),m=Math.max(20,Number(s.minute||30)),t=s.metrics?.total||{};let x=0;
  const d=w5.mature?w5.delta:w10.delta,win=Math.max(1,w5.mature?w5.window_min:w10.window_min||5),scale=5/win;
  if(w5.mature||w10.mature){
    x+=clamp(d.shots*scale/4*6,0,6);x+=clamp(d.sot*scale/1.5*7,0,7);x+=clamp(d.inbox*scale/3*4,0,4);x+=clamp(d.corners*scale/1.5*2,0,2);
    if(Number(t.xg)>0)x+=clamp(d.xg*scale/.28*3,0,3);
  }else{
    const p=45/m;x+=clamp((Number(t.shots)||0)*p/9*5,0,5);x+=clamp((Number(t.sot)||0)*p/3.5*6,0,6);x+=clamp((Number(t.inbox)||0)*p/5.5*4,0,4);x+=clamp((Number(t.corners)||0)*p/4*2,0,2);
    if(Number(t.xg)>0)x+=clamp((Number(t.xg)||0)*p/1.05*3,0,3);
  }
  return {score:clamp(Math.round(x),0,22),w5,w10};
}
function chance(item,s,p){
  const t=s.metrics?.total||{},shots=Math.max(1,Number(t.shots)||0),sot=Number(t.sot)||0,inbox=Number(t.inbox)||0,xg=Number(t.xg)||0,w=p?.w5?.mature?p.w5:p?.w10,d=w?.delta||{};let x=0;
  x+=clamp((sot/shots)/.40*4,0,4);x+=clamp((inbox/shots)/.60*3,0,3);if(xg>0)x+=clamp((xg/shots)/.12*4,0,4);
  if(w?.mature){const scale=5/Math.max(1,w.window_min);x+=clamp((Number(d.sot)||0)*scale/1.4*3,0,3);x+=clamp((Number(d.inbox)||0)*scale/2.8*2,0,2);if(xg>0)x+=clamp((Number(d.xg)||0)*scale/.28*4,0,4)}else x+=clamp(sot/3.5*2,0,2);
  return clamp(Math.round(x),0,20);
}
function momentum(item,s){
  const w3=windowFor(item,s,3),w6=windowFor(item,s,6);
  if(!w3.mature)return {score:5,mature:false,window_min:w3.window_min,delta:w3.delta,accel:0};
  const d=w3.delta,scale=3/Math.max(.5,w3.window_min);let x=0;
  x+=clamp(d.shots*scale/3*4,0,4);x+=clamp(d.sot*scale/1.15*6,0,6);x+=clamp((Number(d.inbox)||0)*scale/2.1*3,0,3);x+=clamp((Number(d.corners)||0)*scale/1.3*2,0,2);
  if(s.stats_presence?.xg===true)x+=clamp((Number(d.xg)||0)*scale/.20*3,0,3);
  let accel=0;
  if(w6.mature&&w6.base&&w3.base){
    const prev=metricDelta(w3.base,w6.base),rw=Math.max(.5,(w3.base.captured_at-w6.base.captured_at)/60000),recentRate=(d.sot*2+d.shots*.35+d.xg*5)/Math.max(.5,w3.window_min),prevRate=(prev.sot*2+prev.shots*.35+prev.xg*5)/rw;
    accel=prevRate>0?(recentRate-prevRate)/prevRate:(recentRate>0?1:0);if(accel>.35)x+=2;else if(accel<-.4)x-=2;
  }
  return {score:clamp(Math.round(x),0,18),mature:w3.window_min>=1,window_min:w3.window_min,delta:d,accel:Math.round(accel*100)/100};
}
function marketScore(s){
  const m=s.market||{},mv=m.move||{};let x=0;if(m.has_over)x+=6;if(m.valid_count>=1)x+=1;
  const bo=m.best_over;if(bo&&bo.odd>=1.45&&bo.odd<=2.40)x+=3;else if(bo&&bo.odd>=1.30&&bo.odd<=2.60)x+=1;
  if(Number(mv.line_delta)>0)x+=4;else if(Number(mv.over_price_delta)<=-.05)x+=4;else if(Number(mv.over_price_delta)<=-.02)x+=2;else if(m.history?.snapshot_count>=2)x+=1;
  return {score:clamp(Math.round(x),0,15),available:m.valid_count>0,over_available:m.has_over,best_over:bo,movement:mv};
}
function contextScore(s){
  const m=Number(s.minute||0),gap=Math.abs(Number(s.goals?.home||0)-Number(s.goals?.away||0));let x=0;
  x+=m>=25&&m<=39?2:m<=42?1:0;x+=gap<=1?1:0;x+=Number(s.metrics?.total?.red||0)===0?1:0;if((Number(s.metrics?.total?.sot)||0)>=2)x+=1;
  return clamp(x,0,5);
}
function qualityScore(item,s){
  const dq=Number(item.initialDQ||s.dq||60),integ=Number(s.integrity??item.initialIntegrity??100);let x=clamp(Math.round(dq/25),0,4);if(integ>=85)x+=1;x=clamp(x,0,5);
  const p=s.stats_presence,age=(Date.now()-Number(s.fresh_at||Date.now()))/1000;if(p&&p.core===false)x=Math.min(x,p.pressure?2:1);else if(p&&p.coverage<3)x=Math.min(x,3);if(age>55)x=Math.min(x,1);return clamp(x,0,5);
}
function core(e){
  const dims=[{name:'PRESS',value:e.pressure,strong:13,weak:6},{name:'CHANCE',value:e.chance,strong:12,weak:6},{name:'MOM',value:e.momentum,strong:10,weak:4}],available=dims.filter(x=>x.value!=null);
  if(available.length<2)return {available:false,complete:false,availableCount:available.length,strongCount:available.length?0:null,weakCount:available.length?0:null,pass:false,partialPass:false};
  const strongCount=available.filter(x=>Number(x.value)>=x.strong).length,weakCount=available.filter(x=>Number(x.value)<x.weak).length,complete=available.length===3;
  return {available:true,complete,availableCount:available.length,strongCount,weakCount,pass:complete&&strongCount>=2&&weakCount===0,partialPass:!complete&&strongCount>=2&&weakCount===0};
}
function h1WatchEvaluate(item,s){
  const game=gameScore(s),pr=pressure(item,s),rawChance=chance(item,s,pr),mom=momentum(item,s),mk=marketScore(s),context=contextScore(s),quality=qualityScore(item,s),baselineAge=historyAge(item,s),presence=s.stats_presence||null,veto=[],warnings=[];
  const statTotal=(Number(s.metrics?.total?.shots)||0)+(Number(s.metrics?.total?.sot)||0)+(Number(s.metrics?.total?.inbox)||0)+(Number(s.metrics?.total?.corners)||0)+(Number(s.metrics?.total?.xg)||0),noStats=presence?presence.pressure===false:(Number(s.minute)>=25&&statTotal===0),partialStats=presence?presence.pressure===true&&presence.core===false:false,baselineIncomplete=baselineAge<2;
  if(noStats)veto.push('NO_H1_LIVE_STATS');else if(partialStats)warnings.push('H1_PARTIAL_LIVE_STATS');if(s.market?.raw_count>0&&s.market?.valid_count===0)veto.push('H1_MARKET_INTEGRITY_INVALID');
  let press=pr.score,ch=rawChance,momScore=mom.score,scoreMode='FULL';
  if(noStats){press=null;ch=null;momScore=null;scoreMode='DATA_INCOMPLETE'}else if(baselineIncomplete){press=null;ch=null;momScore=null;scoreMode='BASELINE'}else if(partialStats){press=presence?.pressure?pr.score:null;ch=presence?.chance?rawChance:null;momScore=presence?.momentum?mom.score:null;scoreMode='PARTIAL_STATS'}
  const c=core({pressure:press,chance:ch,momentum:momScore}),rawScore=clamp(game+pr.score+rawChance+mom.score+mk.score+context+quality,0,100),partialRaw=clamp(game+(press??0)+(ch??0)+(momScore??0)+mk.score+context+quality,0,100),score=scoreMode==='FULL'?rawScore:scoreMode==='PARTIAL_STATS'?Math.min(68,partialRaw):clamp(game+mk.score+context+quality,0,100),recent3=displayWindow(item,s,3),recent5d=displayWindow(item,s,5),recent10d=displayWindow(item,s,10);
  return {score,rawScore,partialRaw,scoreMode,dataIncomplete:['DATA_INCOMPLETE','BASELINE'].includes(scoreMode),partialData:scoreMode==='PARTIAL_STATS',game,pressure:press,chance:ch,momentum:momScore,market:mk.score,context,quality,mature:mom.mature,delta:mom.delta,window_min:mom.window_min,accel:mom.accel,recent3,recent5:recent5d,recent10:recent10d,pressure5:pr.w5,pressure10:pr.w10,core:c,baselineAge,stats_presence:presence,market_available:mk.available,over_available:mk.over_available,best_over:mk.best_over,market_movement:mk.movement,hardVeto:veto.length>0,vetoReasons:veto,dataWarnings:warnings};
}

export function createEngine(calibration={}){
  return {...createBaseEngine(calibration),h1WatchEvaluate};
}
