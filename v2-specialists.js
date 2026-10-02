import {createEngine} from './notify-core.js';

const eng=createEngine();
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
const parse=(s,f={})=>{try{return typeof s==='string'?JSON.parse(s):s??f}catch{return f}};
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};

function nearestCapture(captures,ts){
  const t=Date.parse(ts||0);let best=null;
  for(const c of captures||[]){const ct=Date.parse(c.received_at||0);if(!Number.isFinite(ct)||!Number.isFinite(t)||ct>t)continue;if(!best||ct>best.t)best={t:ct,row:c};}
  return best?.row||captures?.at(-1)||captures?.[0]||null;
}
function fixtureAt(captures,ts,fallback){
  const r=nearestCapture(captures,ts);return r?parse(r.fixture_json,fallback):fallback;
}
function marketAt(marketRows,ts,item){
  const t=Date.parse(ts||0),eligible=(marketRows||[]).filter(r=>Date.parse(r.received_at||0)<=t).sort((a,b)=>Date.parse(a.received_at)-Date.parse(b.received_at));
  if(!eligible.length)return {raw_count:0,valid_count:0,has_over:false,best_over:null,history:null,move:{}};
  const row=eligible.at(-1),p=parse(row.payload_json,{}),markets=eng.normalizeLiveMarkets(Array.isArray(p?.response)?p.response:[],{homeName:item?.teams?.home?.name,awayName:item?.teams?.away?.name});
  const compact=markets.map(m=>({...m,market:m.bet,status:m.feed_status}));
  return eng.watchMarketInfo(compact,null);
}
function h1MarketAt(marketRows,ts,item){
  const t=Date.parse(ts||0),eligible=(marketRows||[]).filter(r=>Date.parse(r.received_at||0)<=t).sort((a,b)=>Date.parse(a.received_at)-Date.parse(b.received_at));
  if(!eligible.length)return {raw_count:0,valid_count:0,has_over:false,best_over:null,history:null,move:{}};
  const row=eligible.at(-1),p=parse(row.payload_json,{}),markets=eng.normalizeLiveMarkets(Array.isArray(p?.response)?p.response:[],{homeName:item?.teams?.home?.name,awayName:item?.teams?.away?.name});
  const h1=markets.filter(m=>m.category==='h1_total'&&m.integrity?.valid!==false&&!m.feed_status?.blocked&&!m.feed_status?.stopped&&!m.feed_status?.finished);
  const vals=[];
  for(const m of h1)for(const v of (m.values||[])){if(v.suspended)continue;if(!/over|tài|tai/i.test(String(v.value||'')))continue;const odd=Number(v.odd);if(Number.isFinite(odd)&&odd>1)vals.push({line:n(v.handicap),odd,main:v.main===true,label:v.value});}
  vals.sort((a,b)=>Number(b.main)-Number(a.main)||Math.abs(a.odd-1.9)-Math.abs(b.odd-1.9));
  return {raw_count:h1.length,valid_count:h1.length,has_over:h1.length>0,best_over:vals[0]||null,history:null,move:{}};
}
function buildSnapshots(item,captures,statsRows,marketRows){
  const rows=[];
  for(const r of statsRows||[]){
    const p=parse(r.payload_json,{}),resp=Array.isArray(p?.response)?p.response:[];
    if(!resp.length)continue;
    const fx=fixtureAt(captures,r.received_at,item),sm=eng.statMap(resp),presence=eng.watchStatsPresence(sm,fx),metrics=eng.watchAggregate(sm,fx);
    const ts=Date.parse(r.received_at),status=fx?.fixture?.status?.short||'',minute=Number(fx?.fixture?.status?.elapsed||0);
    rows.push({captured_at:Number.isFinite(ts)?ts:Date.now(),fresh_at:Number.isFinite(ts)?ts:Date.now(),minute,status,
      goals:{home:Number(fx?.goals?.home||0),away:Number(fx?.goals?.away||0)},metrics,stats_presence:presence,
      market:marketAt(marketRows,r.received_at,fx),h1_market:h1MarketAt(marketRows,r.received_at,fx),dq:0,integrity:100});
  }
  return rows.sort((a,b)=>a.captured_at-b.captured_at);
}

function tierFT(score){return score>=80?'STRONG':score>=73?'READY':score>=65?'CANDIDATE':score>=55?'WATCH':'LOW'}
function buildFT(snapshots,dq){
  if(!snapshots.length)return {status:'INSUFFICIENT_DATA',profile:'FT',version:'LEGACY_V1.16.2',reason:'NO_STATS'};
  const latest=snapshots.at(-1),item={history:snapshots.slice(0,-1),initialDQ:dq?.dq_score||0,initialIntegrity:dq?.integrity??100,latest};
  const evalResult=eng.watchEvaluate(item,latest),full={...item,history:snapshots,eval:evalResult};
  const goal=(latest.status==='2H'||latest.minute>=45)?eng.grEstimate(full,'FT'):{prob:null,source:'H1_NOT_FT_WINDOW',n:0};
  return {status:'OK',profile:'FT',version:'LEGACY_V1.16.2',score:evalResult.score,score_mode:evalResult.scoreMode,tier:tierFT(evalResult.score),core:evalResult.core,hard_veto:evalResult.hardVeto,veto_reasons:evalResult.vetoReasons||[],goal_radar:goal,components:{game:evalResult.game,pressure:evalResult.pressure,chance:evalResult.chance,momentum:evalResult.momentum,market:evalResult.market,context:evalResult.context,quality:evalResult.quality},independent_of_lrs:true};
}

function h1MetricAvailable(s,k){if(k==='red')return true;return s?.stats_presence?.[k]===true}
function h1Delta(cur,old){const out={};for(const k of ['shots','sot','inbox','corners','xg','red']){if(k!=='red'&&(!h1MetricAvailable(cur,k)||!h1MetricAvailable(old,k))){out[k]=null;continue}out[k]=Math.max(0,(Number(cur?.metrics?.total?.[k])||0)-(Number(old?.metrics?.total?.[k])||0));}return out}
function h1FindBase(history,cur,minutes){const rows=(history||[]).filter(x=>x.captured_at<cur.captured_at);if(!rows.length)return null;const target=cur.captured_at-minutes*60000;let best=null,dist=Infinity;for(const r of rows){const d=Math.abs(r.captured_at-target);if(d<dist){best=r;dist=d}}return best}
function h1Window(history,cur,minutes){const base=h1FindBase(history,cur,minutes);if(!base)return {mature:false,window_min:0,delta:{shots:0,sot:0,inbox:0,corners:0,xg:0,red:0},base:null};const win=Math.max(.1,(cur.captured_at-base.captured_at)/60000);return {mature:win>=Math.min(1,minutes*.4),window_min:Math.round(win*10)/10,delta:h1Delta(cur,base),base}}
function h1Age(history,cur){const rows=(history||[]).filter(x=>x.captured_at<=cur.captured_at);if(rows.length<2)return 0;return Math.max(0,Math.round(((cur.captured_at-rows[0].captured_at)/60000)*10)/10)}
function h1Display(history,cur,minutes){const age=h1Age(history,cur);if(age<2)return {status:'baseline',target:minutes,age,window_min:0,delta:null};const w=h1Window(history,cur,minutes);if(!w.base)return {status:'baseline',target:minutes,age,window_min:0,delta:null};if(w.window_min>minutes*1.30)return {status:'gap',target:minutes,age,window_min:w.window_min,delta:null};return {status:w.window_min>=minutes*.8?'complete':'partial',target:minutes,age,window_min:w.window_min,delta:w.delta}}
function h1Game(s){const m=Number(s.minute||0),h=Number(s.goals?.home||0),a=Number(s.goals?.away||0),gap=Math.abs(h-a),tg=h+a;let x=0;x+=m>=28&&m<=38?7:m>=39&&m<=42?6:m>=23&&m<=27?5:m>=43&&m<=44?4:m>=20&&m<=22?3:2;x+=gap===0?4:gap===1?3:gap===2?1:0;x+=tg<=1?3:tg<=2?2:1;x+=s.status==='1H'?1:0;return clamp(Math.round(x),0,15)}
function h1Pressure(history,s){const w5=h1Window(history,s,5),w10=h1Window(history,s,10),m=Math.max(20,Number(s.minute||30)),t=s.metrics?.total||{};let x=0,d=w5.mature?w5.delta:w10.delta,win=Math.max(1,w5.mature?w5.window_min:w10.window_min||5),scale=5/win;if(w5.mature||w10.mature){x+=clamp((d.shots||0)*scale/4*6,0,6);x+=clamp((d.sot||0)*scale/1.5*7,0,7);x+=clamp((d.inbox||0)*scale/3*4,0,4);x+=clamp((d.corners||0)*scale/1.5*2,0,2);if(Number(t.xg)>0)x+=clamp((d.xg||0)*scale/.28*3,0,3)}else{const p=45/m;x+=clamp((Number(t.shots)||0)*p/9*5,0,5);x+=clamp((Number(t.sot)||0)*p/3.5*6,0,6);x+=clamp((Number(t.inbox)||0)*p/5.5*4,0,4);x+=clamp((Number(t.corners)||0)*p/4*2,0,2);if(Number(t.xg)>0)x+=clamp((Number(t.xg)||0)*p/1.05*3,0,3)}return {score:clamp(Math.round(x),0,22),w5,w10}}
function h1Chance(s,p){const t=s.metrics?.total||{},shots=Math.max(1,Number(t.shots)||0),sot=Number(t.sot)||0,inbox=Number(t.inbox)||0,xg=Number(t.xg)||0,w=p?.w5?.mature?p.w5:p?.w10,d=w?.delta||{};let x=0;x+=clamp((sot/shots)/.40*4,0,4);x+=clamp((inbox/shots)/.60*3,0,3);if(xg>0)x+=clamp((xg/shots)/.12*4,0,4);if(w?.mature){const scale=5/Math.max(1,w.window_min);x+=clamp((Number(d.sot)||0)*scale/1.4*3,0,3);x+=clamp((Number(d.inbox)||0)*scale/2.8*2,0,2);if(xg>0)x+=clamp((Number(d.xg)||0)*scale/.28*4,0,4)}else x+=clamp(sot/3.5*2,0,2);return clamp(Math.round(x),0,20)}
function h1Momentum(history,s){const w3=h1Window(history,s,3),w6=h1Window(history,s,6);if(!w3.mature)return {score:5,mature:false,window_min:w3.window_min,delta:w3.delta,accel:0};const d=w3.delta,scale=3/Math.max(.5,w3.window_min);let x=0;x+=clamp((d.shots||0)*scale/3*4,0,4);x+=clamp((d.sot||0)*scale/1.15*6,0,6);x+=clamp((d.inbox||0)*scale/2.1*3,0,3);x+=clamp((d.corners||0)*scale/1.3*2,0,2);if(s.stats_presence?.xg===true)x+=clamp((d.xg||0)*scale/.20*3,0,3);let accel=0;if(w6.mature&&w6.base&&w3.base){const prev=h1Delta(w3.base,w6.base),rw=Math.max(.5,(w3.base.captured_at-w6.base.captured_at)/60000),rr=((d.sot||0)*2+(d.shots||0)*.35+(d.xg||0)*5)/Math.max(.5,w3.window_min),pr=((prev.sot||0)*2+(prev.shots||0)*.35+(prev.xg||0)*5)/rw;accel=pr>0?(rr-pr)/pr:(rr>0?1:0);if(accel>.35)x+=2;else if(accel<-.4)x-=2}return {score:clamp(Math.round(x),0,18),mature:w3.window_min>=1,window_min:w3.window_min,delta:d,accel:Math.round(accel*100)/100}}
function h1Market(s){const m=s.h1_market||{},mv=m.move||{};let x=0;if(m.has_over)x+=6;if(m.valid_count>=1)x+=1;const bo=m.best_over;if(bo&&bo.odd>=1.45&&bo.odd<=2.40)x+=3;else if(bo&&bo.odd>=1.30&&bo.odd<=2.60)x+=1;if(Number(mv.line_delta)>0)x+=4;else if(Number(mv.over_price_delta)<=-.05)x+=4;else if(Number(mv.over_price_delta)<=-.02)x+=2;else if(m.history?.snapshot_count>=2)x+=1;return {score:clamp(Math.round(x),0,15),available:m.valid_count>0,best_over:bo}}
function h1Context(s){const m=Number(s.minute||0),gap=Math.abs(Number(s.goals?.home||0)-Number(s.goals?.away||0));let x=0;x+=m>=25&&m<=39?2:m<=42?1:0;x+=gap<=1?1:0;x+=Number(s.metrics?.total?.red||0)===0?1:0;if((Number(s.metrics?.total?.sot)||0)>=2)x+=1;return clamp(x,0,5)}
function h1Quality(dq,s){let x=clamp(Math.round(Number(dq?.dq_score||60)/25),0,4);if(Number(dq?.integrity||100)>=85)x+=1;x=clamp(x,0,5);const p=s.stats_presence,age=(Date.now()-Number(s.fresh_at||Date.now()))/1000;if(p&&p.core===false)x=Math.min(x,p.pressure?2:1);else if(p&&p.coverage<3)x=Math.min(x,3);if(age>55)x=Math.min(x,1);return clamp(x,0,5)}
function h1Core(e){const dims=[{value:e.pressure,strong:13,weak:6},{value:e.chance,strong:12,weak:6},{value:e.momentum,strong:10,weak:4}],av=dims.filter(x=>x.value!=null);if(av.length<2)return {available:false,complete:false,availableCount:av.length,strongCount:av.length?0:null,weakCount:av.length?0:null,pass:false,partialPass:false};const strong=av.filter(x=>Number(x.value)>=x.strong).length,weak=av.filter(x=>Number(x.value)<x.weak).length,complete=av.length===3;return {available:true,complete,availableCount:av.length,strongCount:strong,weakCount:weak,pass:complete&&strong>=2&&weak===0,partialPass:!complete&&strong>=2&&weak===0}}
function tierH1(score){return score>=79?'STRONG':score>=72?'READY':score>=64?'CANDIDATE':score>=54?'WATCH':'LOW'}
function buildH1(snapshots,dq){
  const rows=snapshots.filter(s=>s.status==='1H'&&s.minute>=20&&s.minute<=45);if(!rows.length)return {status:'OUT_OF_WINDOW',profile:'H1',version:'LEGACY_V1.16.2',reason:'H1_WINDOW_20_45_ONLY'};
  const cur=rows.at(-1),history=rows.slice(0,-1),presence=cur.stats_presence||{},age=h1Age(rows,cur),pr=h1Pressure(history,cur),chance=h1Chance(cur,pr),mom=h1Momentum(history,cur),mk=h1Market(cur),game=h1Game(cur),ctx=h1Context(cur),quality=h1Quality(dq,cur),noStats=presence.pressure===false,partial=presence.pressure===true&&presence.core===false,baseline=age<2;
  let pressure=pr.score,ch=chance,mo=mom.score,mode='FULL';if(noStats){pressure=ch=mo=null;mode='DATA_INCOMPLETE'}else if(baseline){pressure=ch=mo=null;mode='BASELINE'}else if(partial){pressure=presence.pressure?pr.score:null;ch=presence.chance?chance:null;mo=presence.momentum?mom.score:null;mode='PARTIAL_STATS'}
  const core=h1Core({pressure,chance:ch,momentum:mo}),raw=clamp(game+pr.score+chance+mom.score+mk.score+ctx+quality,0,100),partialRaw=clamp(game+(pressure??0)+(ch??0)+(mo??0)+mk.score+ctx+quality,0,100),score=mode==='FULL'?raw:mode==='PARTIAL_STATS'?Math.min(68,partialRaw):clamp(game+mk.score+ctx+quality,0,100);
  const goal=mode==='FULL'?eng.grEstimate({eval:{score,scoreMode:mode,hardVeto:noStats},latest:cur},'H1'):{prob:null,n:0,source:mode==='BASELINE'?'BASELINE':'DATA_WAIT'};
  return {status:'OK',profile:'H1',version:'LEGACY_V1.16.2',score,score_mode:mode,tier:tierH1(score),core,goal_radar:goal,components:{game,pressure,chance:ch,momentum:mo,market:mk.score,context:ctx,quality},windows:{m3:h1Display(rows,cur,3),m5:h1Display(rows,cur,5),m10:h1Display(rows,cur,10)},independent_of_lrs:true};
}
function buildHC(snapshots,item,dq){
  if(!snapshots.length)return {status:'INSUFFICIENT_DATA',profile:'HC',version:'LEGACY_V1.16.2',reason:'NO_STATS'};
  const hsRows=snapshots.map(s=>{const fx=item,sm=null;return {...s,metrics:s.hcMetrics||null}}).filter(s=>s.metrics);
  if(!hsRows.length)return {status:'INSUFFICIENT_DATA',profile:'HC',version:'LEGACY_V1.16.2',reason:'HC_METRICS_MISSING'};
  const cur=hsRows.at(-1),hi={history:hsRows.slice(0,-1),preBaseline:{adv:0}},w3=eng.hcWindow(hi,cur,3),w5=eng.hcWindow(hi,cur,5),w10=eng.hcWindow(hi,cur,10),regime=eng.hcGameRegime(cur,w3,w5),states=eng.hcTeamStates(hi,cur,w3,w5,w10,regime),gap=states?.liveGap;
  const abs=Number.isFinite(Number(gap))?Math.abs(Number(gap)):null;
  return {status:'OK',profile:'HC',version:'LEGACY_V1.16.2',live_gap:gap,abs_gap:abs,tier:abs==null?'N/A':abs>=30?'HIGH':abs>=22?'QUALIFIED':'WATCH',regime,data_tier:cur.metrics?.dataTier||'MARKET_WATCH',windows:{w3:{usable:w3.usable,window_min:w3.window_min},w5:{usable:w5.usable,window_min:w5.window_min},w10:{usable:w10.usable,window_min:w10.window_min}},qualified:abs!=null&&abs>=22,independent_of_lrs:true};
}

export function buildLegacySpecialists({item,captures,statsRows,marketRows,dq}){
  const snapshots=buildSnapshots(item,captures,statsRows,marketRows);
  for(let i=0;i<snapshots.length;i++){
    const p=parse(statsRows[i]?.payload_json,{}),resp=Array.isArray(p?.response)?p.response:[],fx=fixtureAt(captures,statsRows[i]?.received_at,item),sm=eng.statMap(resp);
    snapshots[i].hcMetrics=eng.handicapAggregate(sm,fx);
  }
  return {status:snapshots.length?'OK':'INSUFFICIENT_DATA',provenance:'LEGACY_V1.16.2_FIXED_ADAPTER',lrs_inclusion:false,H1:buildH1(snapshots,dq),FT:buildFT(snapshots,dq),HC:buildHC(snapshots,item,dq)};
}
