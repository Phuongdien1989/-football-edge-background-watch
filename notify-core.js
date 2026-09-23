// Generated unchanged functions from the backed-up Football Edge baseline.
const LIVE_ODDS_HISTORY_MAX_SNAPSHOTS=30;
const MARKET_PRIORITY=[
    'asian_handicap','match_winner','over_under',
    'h1_handicap','h1_total','h2_handicap','h2_total',
    'team_total','handicap_result','h1_handicap_result','h2_handicap_result','corners'
  ];
const ASIAN_HANDICAP_CATEGORIES=new Set(['asian_handicap','h1_handicap','h2_handicap']);
const HANDICAP_RESULT_CATEGORIES=new Set(['handicap_result','h1_handicap_result','h2_handicap_result']);
const ALL_HANDICAP_CATEGORIES=new Set([...ASIAN_HANDICAP_CATEGORIES,...HANDICAP_RESULT_CATEGORIES]);
const XIEN_ALLOWED_PRE=new Set(['asian_handicap','over_under','match_winner','h1_handicap','h1_total','team_total']);
const XIEN_ALLOWED_LIVE=new Set(['asian_handicap','over_under','match_winner','h1_handicap','h1_total','h2_handicap','h2_total','team_total','corners']);
export function createEngine(calibration={}){
const watchState={calibration:calibration.legacyFT||[]},h1WatchState={calibration:[]};
const qsigRead=engine=>calibration[engine]||[];
function watchEvaluate(item,s){
    const game=watchGameStateScore(s),pr=watchPressureScore(item,s),rawChance=watchChanceScore(item,s,pr),mom=watchMomentum(item,s),mk=watchMarketScore(s),context=watchContextScore(s),quality=watchQualityScore(item,s),baselineAge=watchHistoryAge(item,s),presence=s.stats_presence||null,veto=[],warnings=[];
    const statTotal=(Number(s.metrics?.total?.shots)||0)+(Number(s.metrics?.total?.sot)||0)+(Number(s.metrics?.total?.inbox)||0)+(Number(s.metrics?.total?.corners)||0)+(Number(s.metrics?.total?.xg)||0),noStats=presence?presence.pressure===false:(Number(s.minute)>=55&&statTotal===0),partialStats=presence?presence.pressure===true&&presence.core===false:false,baselineIncomplete=baselineAge<2;
    if(noStats)veto.push('NO_LIVE_STATS');else if(partialStats)warnings.push('PARTIAL_LIVE_STATS');if(s.market?.raw_count>0&&s.market?.valid_count===0)veto.push('MARKET_INTEGRITY_INVALID');
    let pressure=pr.score,chance=rawChance,momentum=mom.score,scoreMode='FULL';
    if(noStats){pressure=null;chance=null;momentum=null;scoreMode='DATA_INCOMPLETE'}
    else if(baselineIncomplete){pressure=null;chance=null;momentum=null;scoreMode='BASELINE'}
    else if(partialStats){pressure=presence?.pressure?pr.score:null;chance=presence?.chance?rawChance:null;momentum=presence?.momentum?mom.score:null;scoreMode='PARTIAL_STATS'}
    const core=watchCore({pressure,chance,momentum}),rawScore=watchClamp(game+pr.score+rawChance+mom.score+mk.score+context+quality,0,100),partialRaw=watchClamp(game+(pressure??0)+(chance??0)+(momentum??0)+mk.score+context+quality,0,100),score=scoreMode==='FULL'?rawScore:scoreMode==='PARTIAL_STATS'?Math.min(68,partialRaw):watchClamp(game+mk.score+context+quality,0,100);
    return {score,rawScore,partialRaw,scoreMode,dataIncomplete:['DATA_INCOMPLETE','BASELINE'].includes(scoreMode),partialData:scoreMode==='PARTIAL_STATS',baselineAge,game,pressure,chance,momentum,market:mk.score,context,quality,mature:mom.mature,delta:mom.delta,window_min:mom.window_min,accel:mom.accel,recent5:pr.w5,recent10:pr.w10,core,stats_presence:presence,market_available:mk.available,over_available:mk.over_available,best_over:mk.best_over,market_movement:mk.movement,hardVeto:veto.length>0,vetoReasons:veto,dataWarnings:warnings}
  }

function watchGameStateScore(s){
    const m=Number(s.minute||0),h=Number(s.goals?.home||0),a=Number(s.goals?.away||0),gap=Math.abs(h-a),tg=h+a;let x=0;
    x+=m>=55&&m<=82?6:m>=48&&m<=87?4:2;x+=gap===1?5:gap===0?4:gap===2?2:0;x+=tg<=3?3:tg<=5?2:1;x+=s.status==='2H'?1:0;return watchClamp(Math.round(x),0,15);
  }

function watchClamp(n,a,b){return Math.max(a,Math.min(b,n))}

function watchPressureScore(item,s){
    const w5=watchWindow(item,s,5),w10=watchWindow(item,s,10),m=Math.max(45,Number(s.minute||60)),t=s.metrics?.total||{};let x=0;
    const d=w5.mature?w5.delta:w10.delta,win=Math.max(1,w5.mature?w5.window_min:w10.window_min||5),scale=5/win;
    if(w5.mature||w10.mature){x+=watchClamp(d.shots*scale/4*5,0,5);x+=watchClamp(d.sot*scale/1.6*6,0,6);x+=watchClamp(d.inbox*scale/3*4,0,4);x+=watchClamp(d.corners*scale/1.5*2,0,2);if(Number(t.xg)>0)x+=watchClamp(d.xg*scale/.30*3,0,3)}
    else{const p=90/m;x+=watchClamp((Number(t.shots)||0)*p/18*4,0,4);x+=watchClamp((Number(t.sot)||0)*p/7*5,0,5);x+=watchClamp((Number(t.inbox)||0)*p/11*3,0,3);x+=watchClamp((Number(t.corners)||0)*p/8*2,0,2);if(Number(t.xg)>0)x+=watchClamp((Number(t.xg)||0)*p/2*2,0,2)}
    if(s.h1&&s.h2){const h1=Number(s.h1.total?.sot||0)/45,h2m=Math.max(1,m-45),h2=Number(s.h2.total?.sot||0)/h2m;if(h2>h1*1.15)x+=2;else if(h1>0&&h2<h1*.65)x-=2}
    return {score:watchClamp(Math.round(x),0,20),w5,w10};
  }

function watchWindow(item,cur,minutes){const base=watchFindBaseline(item,cur,minutes);if(!base)return {mature:false,window_min:0,delta:{shots:0,sot:0,inbox:0,corners:0,xg:0,red:0},base:null};const win=Math.max(.1,(cur.captured_at-base.captured_at)/60000);return {mature:win>=Math.min(1,minutes*.4),window_min:Math.round(win*10)/10,delta:watchMetricDelta(cur,base),base}}

function watchFindBaseline(item,cur,minutes){
    const rows=(item.history||[]).filter(s=>Number(s.captured_at)<Number(cur.captured_at)&&(!item.resetAt||s.captured_at>=item.resetAt));if(!rows.length)return null;
    const target=cur.captured_at-minutes*60000;let pick=rows[0],best=Infinity;for(const r of rows){const diff=Math.abs(Number(r.captured_at)-target);if(diff<best){pick=r;best=diff}}return pick;
  }

function watchMetricDelta(cur,old){
    const out={};
    ['shots','sot','inbox','corners','xg','red'].forEach(k=>{
      if(k!=='red'&&(!watchMetricAvailable(cur,k)||!watchMetricAvailable(old,k))){out[k]=null;return}
      out[k]=Math.max(0,(Number(cur?.metrics?.total?.[k])||0)-(Number(old?.metrics?.total?.[k])||0));
    });
    return out;
  }

function watchMetricAvailable(s,k){
    if(k==='red')return true;
    return s?.stats_presence?.[k]===true;
  }

function watchChanceScore(item,s,p){
    const t=s.metrics?.total||{},shots=Math.max(1,Number(t.shots)||0),sot=Number(t.sot)||0,inbox=Number(t.inbox)||0,xg=Number(t.xg)||0,w=p?.w5?.mature?p.w5:p?.w10,d=w?.delta||{};let x=0;
    x+=watchClamp((sot/shots)/.42*4,0,4);x+=watchClamp((inbox/shots)/.62*3,0,3);if(xg>0)x+=watchClamp((xg/shots)/.12*4,0,4);
    if(w?.mature){const scale=5/Math.max(1,w.window_min);x+=watchClamp((Number(d.sot)||0)*scale/1.5*3,0,3);x+=watchClamp((Number(d.inbox)||0)*scale/3*2,0,2);if(xg>0)x+=watchClamp((Number(d.xg)||0)*scale/.30*4,0,4)}else{x+=watchClamp(sot/6*2,0,2)}
    return watchClamp(Math.round(x),0,20);
  }

function watchMomentum(item,s){
    const w3=watchWindow(item,s,3),w6=watchWindow(item,s,6);if(!w3.mature)return {score:4,mature:false,window_min:w3.window_min,delta:w3.delta,accel:0};
    const d=w3.delta,scale=3/Math.max(.5,w3.window_min);let x=0;x+=watchClamp(d.shots*scale/3*4,0,4);x+=watchClamp(d.sot*scale/1.2*5,0,5);x+=watchClamp((Number(d.inbox)||0)*scale/2.2*2,0,2);x+=watchClamp((Number(d.corners)||0)*scale/1.3*2,0,2);if(s.stats_presence?.xg===true)x+=watchClamp((Number(d.xg)||0)*scale/.22*2,0,2);
    let accel=0;if(w6.mature&&w6.base&&w3.base){const prev=watchMetricDelta(w3.base,w6.base),rw=Math.max(.5,(w3.base.captured_at-w6.base.captured_at)/60000),recentRate=((Number(d.sot)||0)*2+(Number(d.shots)||0)*.35+(Number(d.corners)||0)*.45+(Number(d.xg)||0)*5)/Math.max(.5,w3.window_min),prevRate=((Number(prev.sot)||0)*2+(Number(prev.shots)||0)*.35+(Number(prev.corners)||0)*.45+(Number(prev.xg)||0)*5)/rw;accel=prevRate>0?(recentRate-prevRate)/prevRate:(recentRate>0?1:0);if(accel>.35)x+=2;else if(accel<-.4)x-=2}
    return {score:watchClamp(Math.round(x),0,15),mature:w3.window_min>=1.0,window_min:w3.window_min,delta:d,accel:Math.round(accel*100)/100};
  }

function watchMarketScore(s){
    const m=s.market||{},mv=m.move||{};let x=0;if(m.has_over)x+=5;else if(m.valid_count)x+=2;if(m.valid_count>=2)x+=1;
    const bo=m.best_over;if(bo&&bo.odd>=1.45&&bo.odd<=2.35)x+=2;else if(bo&&bo.odd>=1.30&&bo.odd<=2.55)x+=1;
    if(Number(mv.line_delta)>0)x+=4;else if(Number(mv.over_price_delta)<=-.05)x+=4;else if(Number(mv.over_price_delta)<=-.02)x+=2;else if(m.history?.snapshot_count>=2)x+=1;
    return {score:watchClamp(Math.round(x),0,15),available:m.valid_count>0,over_available:m.has_over,best_over:bo,movement:mv};
  }

function watchContextScore(s){
    const m=Number(s.minute||0),gap=Math.abs(Number(s.goals?.home||0)-Number(s.goals?.away||0));let x=0;x+=gap===1?4:gap===0?3:gap===2?1:0;x+=m>=55&&m<=80?3:m<=86?2:1;
    const h2=s.h2?.total||{},h1=s.h1?.total||{};if(Number(h2.sot||0)>=Number(h1.sot||0))x+=2;if(Number(h2.inbox||0)>=Number(h1.inbox||0))x+=1;return watchClamp(x,0,10);
  }

function watchQualityScore(item,s){
    const dq=Number(item.initialDQ||s.dq||60),integ=Number(s.integrity??item.initialIntegrity??100);let x=watchClamp(Math.round(dq/25),0,4);if(integ>=85)x+=1;x=watchClamp(x,0,5);
    const p=s.stats_presence,age=(Date.now()-Number(s.fresh_at||Date.now()))/1000;if(p&&p.core===false)x=Math.min(x,p.pressure?2:1);else if(p&&p.coverage<3)x=Math.min(x,3);if(age>60)x=Math.min(x,1);return watchClamp(x,0,5)
  }

function watchHistoryAge(item,cur){
    const rows=(item.history||[]).filter(s=>Number(s.captured_at)<=Number(cur.captured_at)&&(!item.resetAt||Number(s.captured_at)>=Number(item.resetAt)));
    if(rows.length<2)return 0;const first=rows.reduce((a,b)=>Number(a.captured_at)<=Number(b.captured_at)?a:b);
    return Math.max(0,Math.round(((Number(cur.captured_at)-Number(first.captured_at))/60000)*10)/10);
  }

function watchCore(e){
    const dims=[
      {name:'PRESS',value:e.pressure,strong:12,weak:6},
      {name:'CHANCE',value:e.chance,strong:12,weak:6},
      {name:'MOM',value:e.momentum,strong:9,weak:4}
    ],available=dims.filter(x=>x.value!=null);
    if(available.length<2)return {available:false,complete:false,availableCount:available.length,strongCount:available.length?0:null,weakCount:available.length?0:null,pass:false,partialPass:false};
    const strongCount=available.filter(x=>Number(x.value)>=x.strong).length,weakCount=available.filter(x=>Number(x.value)<x.weak).length,complete=available.length===3;
    return {available:true,complete,availableCount:available.length,strongCount,weakCount,pass:complete&&strongCount>=2&&weakCount===0,partialPass:!complete&&strongCount>=2&&weakCount===0};
  }

function grEstimate(item,engine){
    const e=item?.eval||{},s=item?.latest||{},score=Number(e.score||0),minute=Number(s.minute||0),fallback=grFallback(score,engine);
    if(e.scoreMode!=='FULL'||e.hardVeto||!Number.isFinite(score))return {prob:null,n:0,source:e.scoreMode==='BASELINE'?'BASELINE':'DATA_WAIT',raw:null,basis:'NONE',reliability:grReliability(0)};
    const all=grResolved(engine),minuteWin=engine==='H1'?4:7;
    let near=all.filter(r=>Math.abs(Number(r.score||0)-score)<=5&&Math.abs(Number(r.minute||0)-minute)<=minuteWin);
    if(near.length<12)near=all.filter(r=>Math.abs(Number(r.score||0)-score)<=8&&Math.abs(Number(r.minute||0)-minute)<=minuteWin*1.75);
    if(near.length<8){const tier=engine==='H1'?h1WatchTier(score):watchTierForScore(score);near=all.filter(r=>String(r.tier||'')===String(tier)&&Math.abs(Number(r.minute||0)-minute)<=minuteWin*2.4)}
    if(!near.length)return {prob:fallback,n:0,source:'MODEL',raw:null,basis:'MODEL',reliability:grReliability(0)};
    const qsigN=near.filter(r=>r.__basis==='QSIG').length,basis=qsigN>=Math.ceil(near.length*.5)?'QSIG':'LEGACY';
    const basePool=all.filter(r=>Math.abs(Number(r.minute||0)-minute)<=minuteWin*2.5),baseHits=basePool.filter(r=>r.__hit).length;
    const empiricalPrior=basePool.length>=20?baseHits/basePool.length:fallback/100;
    const hits=near.filter(r=>r.__hit).length,n=near.length,priorWeight=basis==='QSIG'?14:20;
    const post=(hits+priorWeight*empiricalPrior)/(n+priorWeight),prob=Math.round(grClamp(post*100,8,94)),rel=grReliability(n,basis);
    return {prob,n,source:n>=40?'CAL_STRONG':n>=20?'CAL':n>=8?'CAL_EARLY':'MODEL',raw:hits/n,basis,reliability:rel,qsig_n:qsigN,prior:empiricalPrior};
  }

function grFallback(score,engine){
    const x=Number(score||0),pivot=engine==='H1'?64:65,scale=11.5;
    const p=100/(1+Math.exp(-(x-pivot)/scale));
    return grClamp(Math.round(18+p*.72),18,91);
  }

function grClamp(v,a=0,b=100){return Math.max(a,Math.min(b,Number(v)||0))}

function grReliability(n,basis='MODEL'){
    n=Number(n||0);
    if(!n)return {level:'MODEL',label:'ƯỚC TÍNH',rank:0};
    let rank=n>=80?4:n>=40?3:n>=20?2:1;
    if(basis!=='QSIG')rank=Math.max(1,rank-1);
    return rank>=4?{level:'VERY_GOOD',label:'RẤT TỐT',rank}:rank===3?{level:'GOOD',label:'TỐT',rank}:rank===2?{level:'MEDIUM',label:'TRUNG BÌNH',rank}:{level:'LOW',label:'MẪU THẤP',rank};
  }

function grResolved(engine){
    const key=engine==='H1'?'goal_before_ht':'goal_ft';
    let official=[];
    try{official=(qsigRead(engine)||[]).filter(r=>typeof r?.[key]==='boolean').map(r=>({...r,__hit:!!r[key],__basis:'QSIG',tier:r.level==='HIGH_CONFIRMATION'?'STRONG':'READY'}))}catch(_){official=[]}
    if(official.length>=8)return official;
    const legacyRows=engine==='H1'?(h1WatchState.calibration||[]):(watchState.calibration||[]);
    const legacy=legacyRows.filter(r=>typeof r?.[key]==='boolean').map(r=>({...r,__hit:!!r[key],__basis:'LEGACY'}));
    return official.length?[...official,...legacy]:legacy;
  }

function h1WatchTier(score){const t=h1WatchThresholds();return score>=t.strong?'STRONG':score>=t.ready?'READY':score>=t.candidate?'CANDIDATE':score>=t.watch?'WATCH':'LOW'}

function h1WatchThresholds(){
    const shadow=h1WatchLearnedStrong();
    return {watch:54,candidate:64,ready:72,strong:79,learned:{...shadow,shadow_only:true,active_threshold:79}}
  }

function h1WatchLearnedStrong(){
    const rows=(h1WatchState.calibration||[]).filter(r=>typeof r.goal_5m==='boolean');
    if(rows.length<300)return {threshold:79,learned:false,n:rows.length};
    const base=rows.filter(r=>r.score>=54),baseRate=base.length?base.filter(r=>r.goal_5m).length/base.length:0,candidates=[];
    for(let t=76;t<=82;t++){const rr=rows.filter(r=>r.score>=t);if(rr.length<50)continue;const rate=rr.filter(r=>r.goal_5m).length/rr.length;if(rate>=baseRate*1.15)candidates.push({t,n:rr.length,rate})}
    if(!candidates.length)return {threshold:79,learned:false,n:rows.length,baseRate};
    const best=Math.max(...candidates.map(x=>x.rate)),near=candidates.filter(x=>x.rate>=best-.02).sort((a,b)=>a.t-b.t)[0];
    return {threshold:near.t,learned:true,n:rows.length,rate:near.rate,baseRate};
  }

function watchTierForScore(score){const t=watchThresholds();return score>=t.strong?'STRONG':score>=t.ready?'READY':score>=t.candidate?'CANDIDATE':score>=t.watch?'WATCH':'LOW'}

function watchThresholds(){
    const shadow=watchLearnedStrong();
    return {watch:55,candidate:65,ready:73,strong:80,learned:{...shadow,shadow_only:true,active_threshold:80}}
  }

function watchLearnedStrong(){
    const rows=(watchState.calibration||[]).filter(r=>typeof r.goal_10m==='boolean');if(rows.length<500)return {threshold:80,learned:false,n:rows.length};const base=rows.filter(r=>r.score>=55),baseRate=base.length?base.filter(r=>r.goal_10m).length/base.length:0;
    const candidates=[];for(let t=76;t<=84;t++){const rr=rows.filter(r=>r.score>=t);if(rr.length<80)continue;const rate=rr.filter(r=>r.goal_10m).length/rr.length;if(rate>=baseRate*1.15)candidates.push({t,n:rr.length,rate})}
    if(!candidates.length)return {threshold:80,learned:false,n:rows.length,baseRate};const best=Math.max(...candidates.map(x=>x.rate)),near=candidates.filter(x=>x.rate>=best-.02).sort((a,b)=>a.t-b.t)[0];return {threshold:near.t,learned:true,n:rows.length,rate:near.rate,baseRate};
  }

function hcTeamStates(item,s,w3,w5,w10,regime){const h=s.metrics.home,a=s.metrics.away;let liveAdv=0;
    const volH=(h.shots??0)+(h.corners??0)*.5,volA=(a.shots??0)+(a.corners??0)*.5;liveAdv+=(hcShare(volH,volA)-.5)*22;
    const chH=(h.sot??0)*2+(h.inbox??0)*1.2+(h.xg??0)*5,chA=(a.sot??0)*2+(a.inbox??0)*1.2+(a.xg??0)*5;liveAdv+=(hcShare(chH,chA)-.5)*28;
    const mh=hcSideIndex(w5?.usable?w5:w3,'home'),ma=hcSideIndex(w5?.usable?w5:w3,'away');let momAdv=(hcShare(mh,ma)-.5)*20;
    if(regime?.chasing==='HOME'&&momAdv>0)momAdv*=.68;
    if(regime?.chasing==='AWAY'&&momAdv<0)momAdv*=.68;
    liveAdv+=momAdv;
    if(h.possession!=null&&a.possession!=null)liveAdv+=(hcShare(h.possession,a.possession)-.5)*7;
    const hr=Number(h.red||0),ar=Number(a.red||0);liveAdv+=(ar-hr)*10;
    let gameAdj=0;
    const scoreGap=Number(s.goals.home)-Number(s.goals.away);
    if(scoreGap>0&&mh>=ma*.85)gameAdj+=2.5;
    if(scoreGap<0&&ma>=mh*.85)gameAdj-=2.5;
    liveAdv+=gameAdj;
    liveAdv=watchClamp(liveAdv,-38,38);
    const minute=Number(s.minute||0),preRaw=Number(item.preBaseline?.adv||0),preWeight=watchClamp(1-minute/100,.15,.72),preAdv=preRaw*preWeight;
    const adv=watchClamp(liveAdv+preAdv,-44,44),home=watchClamp(Math.round(50+adv),0,100),away=watchClamp(Math.round(50-adv),0,100);
    return {home,away,gap:home-away,direction:Math.abs(home-away)<10?'BALANCED':home>away?'HOME':'AWAY',preAdv:Math.round(preAdv*10)/10,liveAdv:Math.round(liveAdv*10)/10,liveGap:Math.round(liveAdv*2),momentumAdv:Math.round(momAdv*10)/10,gameAdj:Math.round(gameAdj*10)/10,regime:regime?.name||'N/A'}}

function hcShare(a,b,neutral=.5){if(a==null&&b==null)return neutral;const x=Math.max(0,Number(a||0)),y=Math.max(0,Number(b||0));return x+y>0?x/(x+y):neutral}

function hcSideIndex(w,side){if(!w?.usable)return 0;const d=w.delta?.[side]||{},scale=5/Math.max(1,w.window_min);let x=0;if(d.shots!=null)x+=d.shots*scale*1.2;if(d.sot!=null)x+=d.sot*scale*3.2;if(d.inbox!=null)x+=d.inbox*scale*1.8;if(d.corners!=null)x+=d.corners*scale*.9;if(d.xg!=null)x+=d.xg*scale*8;return Math.round(x*100)/100}

function hcWindow(item,cur,mins){const b=hcFindBase(item,cur,mins);if(!b)return {usable:false,mature:false,window_min:0,delta:null};const wm=Math.max(.05,(cur.captured_at-b.captured_at)/60000);return {usable:wm>=Math.min(1.5,mins*.55),mature:wm>=mins*.8,window_min:Math.round(wm*10)/10,delta:hcMetricDelta(cur,b)}}

function hcFindBase(item,cur,mins){const rows=(item.history||[]).filter(x=>Number(x.captured_at)<Number(cur.captured_at)&&(!item.resetAt||Number(x.captured_at)>=Number(item.resetAt)));if(!rows.length)return null;const target=Number(cur.captured_at)-mins*60000;let best=null,d=Infinity;for(const r of rows){const z=Math.abs(Number(r.captured_at)-target);if(z<d){d=z;best=r}}return best}

function hcMetricDelta(cur,old){const out={home:{},away:{}};for(const side of ['home','away'])for(const k of ['shots','sot','inbox','corners','xg']){const a=cur?.metrics?.[side]?.[k],b=old?.metrics?.[side]?.[k];out[side][k]=(a==null||b==null)?null:Math.max(0,Number(a)-Number(b))}return out}

function hcGameRegime(s,w3,w5){
    const hg=Number(s.goals.home||0),ag=Number(s.goals.away||0),m=Number(s.minute||0),hr=Number(s.metrics.home.red||0),ar=Number(s.metrics.away.red||0);
    const mh=hcSideIndex(w5?.usable?w5:w3,'home'),ma=hcSideIndex(w5?.usable?w5:w3,'away');
    if(hr>ar)return {name:'HOME 10v11',chasing:null};
    if(ar>hr)return {name:'AWAY 10v11',chasing:null};
    if(hg===ag)return {name:'LEVEL GAME',chasing:null};
    const homeTrailing=hg<ag,trailing=homeTrailing?'HOME':'AWAY',tm=homeTrailing?mh:ma,lm=homeTrailing?ma:mh;
    if(m>=75&&tm>=Math.max(1.5,lm*1.2))return {name:`${trailing} LATE CHASE`,chasing:trailing};
    if(tm>=Math.max(1.8,lm*1.28))return {name:`${trailing} TRAILING CHASE`,chasing:trailing};
    return {name:homeTrailing?'AWAY LEADING':'HOME LEADING',chasing:null}
  }

function handicapAggregate(sm,meta){const h=handicapSideMetrics(sm?.[meta?.teams?.home?.id]),a=handicapSideMetrics(sm?.[meta?.teams?.away?.id]);const available=['shots','sot','inbox','corners','xg','possession'].filter(k=>h[k]!=null||a[k]!=null);const chance=['sot','inbox','xg'].filter(k=>h[k]!=null||a[k]!=null);return {home:h,away:a,available,coverage:available.length,chanceCoverage:chance.length,dataTier:available.length>=4&&chance.length>=1?'FULL':available.length>=1?'PARTIAL':'MARKET_WATCH'}}

function handicapSideMetrics(side){return {shots:hcStat(side,['Total Shots']),sot:hcStat(side,['Shots on Goal','Shots on Target']),inbox:hcStat(side,['Shots insidebox','Shots inside box']),corners:hcStat(side,['Corner Kicks','Corners']),xg:hcStat(side,['expected_goals','Expected Goals']),possession:hcStat(side,['Ball Possession','Possession']),red:hcStat(side,['Red Cards'])}}

function hcStat(side,names){const v=getAnyStat(side,names);return v==null?null:watchNum(v)}

function getAnyStat(side,names){
    const s=side?.stats||{};const keys=Object.keys(s);
    for(const name of names){
      const hit=keys.find(k=>String(k).toLowerCase()===String(name).toLowerCase())||keys.find(k=>String(k).toLowerCase().includes(String(name).toLowerCase()));
      if(hit!=null&&s[hit]!=null)return compactNum(s[hit]);
    }
    return null;
  }

function compactNum(v){
    if(v===null||v===undefined||v==='')return null;
    if(typeof v==='number')return Number.isInteger(v)?String(v):String(Math.round(v*100)/100);
    return String(v).replace(/\s+/g,' ').trim();
  }

function watchNum(v){const n=Number(String(v??'').replace('%','').trim());return Number.isFinite(n)?n:null}

function statMap(statsResponse){const out={};(statsResponse||[]).forEach(side=>{const key=side.team?.id;if(key==null)return;out[key]={team:side.team,stats:statListToObject(side.statistics)}});return out}

function statListToObject(arr){const o={};(arr||[]).forEach(s=>{if(s?.type!=null)o[s.type]=s.value});return o}

function normalizeLiveMarkets(resp,ctx={}){
    const out=[];
    (resp||[]).forEach(r=>{
      const rctx=marketContextFromResponse(r,ctx);
      const status={
        stopped:!!r.status?.stopped,
        blocked:!!r.status?.blocked,
        finished:!!r.status?.finished
      };
      const bets=Array.isArray(r.odds)?r.odds:[];
      bets.forEach(bet=>{
        const ident=marketIdentity(bet.name,bet.id,'live',ctx.betRefs?.live);
        const category=ident.category;
        if(!category)return;
        const values=compactOddsValues(bet.values,true,category,rctx);
        const integrity=marketIntegrity(values,category,rctx);
        const usable=integrity.valid?values.filter(v=>!v.suspended):[];
        const mainV=usable.find(v=>v.main===true)||usable[0]||null;
        out.push({
          source:'live',fixture_id:r.fixture?.id??null,fixture_status:r.fixture?.status??null,
          feed_status:status,update:r.update??null,bet_id:bet.id??null,
          bet:ident.canonical_name||bet.name,feed_bet_name:bet.name||null,
          bet_reference:{mapped_by:ident.mapped_by,canonical_name:ident.canonical_name,reference_source:ident.reference_source},
          category,integrity,main_line:mainV?.handicap??mainV?.value??null,values
        });
      });
    });
    return out.sort((a,b)=>MARKET_PRIORITY.indexOf(a.category)-MARKET_PRIORITY.indexOf(b.category)).slice(0,24);
  }

function marketContextFromResponse(r,fallback={}){
    return {
      homeName:r?.teams?.home?.name||r?.fixture?.teams?.home?.name||fallback.homeName||null,
      awayName:r?.teams?.away?.name||r?.fixture?.teams?.away?.name||fallback.awayName||null
    };
  }

function marketIdentity(name,betId,source='prematch',betRefs=null){
    const ref=betReferenceLookup(betRefs,betId);
    const canonical=ref?.name||name||'';
    return {
      category:marketCategoryFromName(canonical),
      canonical_name:canonical||null,
      feed_name:name||null,
      bet_id:betId??null,
      mapped_by:ref?'BET_ID_REFERENCE':'NAME_FALLBACK',
      reference_source:ref?.source||source
    };
  }

function betReferenceLookup(ref,betId){
    if(betId==null||!ref?.byId)return null;
    return ref.byId[String(betId)]||null;
  }

function marketCategoryFromName(name){
    const s=String(name||'').toLowerCase().replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();

    if(/corner/.test(s))return 'corners';

    if(/first half|1st half|half time|halftime|first-half/.test(s)){
      if(/handicap result|european handicap|3[- ]?way handicap/.test(s))return 'h1_handicap_result';
      if(/asian handicap/.test(s)||(/\bhandicap\b/.test(s)&&!/result/.test(s)))return 'h1_handicap';
      if(/over|under|total|goal/.test(s))return 'h1_total';
    }

    if(/second half|2nd half|second-half/.test(s)){
      if(/handicap result|european handicap|3[- ]?way handicap/.test(s))return 'h2_handicap_result';
      if(/asian handicap/.test(s)||(/\bhandicap\b/.test(s)&&!/result/.test(s)))return 'h2_handicap';
      if(/over|under|total|goal/.test(s))return 'h2_total';
    }

    if(/team.*total|total.*team|home.*over|away.*over|home.*under|away.*under/.test(s))return 'team_total';
    if(/handicap result|european handicap|3[- ]?way handicap/.test(s))return 'handicap_result';
    if(/asian handicap/.test(s))return 'asian_handicap';
    if(/^handicap$/.test(s))return 'handicap_result';
    if(/match winner|winner|1x2|home\/draw\/away/.test(s))return 'match_winner';
    if(/over|under|total goals|goals over|goals under|over\/under/.test(s))return 'over_under';
    return null;
  }

function compactOddsValues(values,isLive=false,category=null,ctx={}){
    const src=(values||[]).map(v=>{
      const value=v?.value??v?.name??v?.label??'';
      const raw=v?.handicap??null;
      const parsed=numericHandicap(raw)??(ALL_HANDICAP_CATEGORIES.has(category)?handicapFromLabel(value):null);
      return {
        value,
        odd:v?.odd??v?.price??null,
        handicap:parsed,
        raw_handicap:raw,
        selection_outcome:ALL_HANDICAP_CATEGORIES.has(category)?selectionOutcome(value,ctx):null,
        selection_side:ASIAN_HANDICAP_CATEGORIES.has(category)?selectionSide(value,ctx):null,
        main:v?.main??null,
        suspended:!!v?.suspended
      };
    });

    let picked;
    if(!isLive){
      picked=src.slice(0,10);
    }else{
      const mains=src.filter(v=>v.main===true);
      if(mains.length){
        if(ASIAN_HANDICAP_CATEGORIES.has(category)){
          const absLines=new Set(mains.map(v=>numericHandicap(v.handicap)).filter(Number.isFinite).map(Math.abs));
          picked=src.filter(v=>v.main===true||absLines.has(Math.abs(numericHandicap(v.handicap)))).slice(0,10);
        }else if(HANDICAP_RESULT_CATEGORIES.has(category)){
          const lineSet=new Set(mains.map(v=>String(v.handicap??'')));
          picked=src.filter(v=>v.main===true||lineSet.has(String(v.handicap??''))).slice(0,10);
        }else{
          const hs=new Set(mains.map(v=>String(v.handicap??'')));
          picked=src.filter(v=>v.main===true||hs.has(String(v.handicap??''))).slice(0,10);
        }
      }else if(ALL_HANDICAP_CATEGORIES.has(category)){
        picked=src.slice(0,8);
      }else{
        const firstH=src.find(v=>v.handicap!=null)?.handicap;
        if(firstH!=null){
          const group=src.filter(v=>String(v.handicap)===String(firstH));
          picked=group.length?group.slice(0,8):src.slice(0,8);
        }else picked=src.slice(0,8);
      }
    }
    return picked;
  }

function numericHandicap(v){
    if(v===null||v===undefined||v==='')return null;
    const n=Number(String(v).replace(',','.').replace(/[^0-9+\-.]/g,''));
    return Number.isFinite(n)?n:null;
  }

function handicapFromLabel(label){
    const s=String(label||'').trim();
    const m=s.match(/([+-]?\d+(?:[.,]\d+)?)\s*$/);
    return m?numericHandicap(m[1]):null;
  }

function selectionOutcome(label,ctx={}){
    const s=normalizedKey(label);
    if(!s)return null;

    if(/^(draw|x|tie)(\s|$)/.test(s)||/\bdraw\b/.test(s))return 'draw';
    if(/^(home|home team|team 1)(\s|$)/.test(s)||/\bhome\b/.test(s))return 'home';
    if(/^(away|away team|team 2)(\s|$)/.test(s)||/\baway\b/.test(s))return 'away';
    if(/^1(\s|$)/.test(s))return 'home';
    if(/^x(\s|$)/.test(s))return 'draw';
    if(/^2(\s|$)/.test(s))return 'away';

    const hk=normalizedKey(ctx.homeName),ak=normalizedKey(ctx.awayName);
    if(hk && (s===hk || s.startsWith(hk+' ') || s.includes(' '+hk+' ')))return 'home';
    if(ak && (s===ak || s.startsWith(ak+' ') || s.includes(' '+ak+' ')))return 'away';
    return null;
  }

function normalizedKey(v){
    return String(v||'')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  }

function selectionSide(label,ctx={}){
    const o=selectionOutcome(label,ctx);
    return o==='home'||o==='away'?o:null;
  }

function isLive(f){const s=f.fixture?.status?.short||'';return ['1H','HT','2H','ET','BT','P','INT','SUSP','LIVE'].includes(s)}

function marketIntegrity(values,category,ctx={}){
    if(ASIAN_HANDICAP_CATEGORIES.has(category))return asianHandicapIntegrity(values,category,ctx);
    if(HANDICAP_RESULT_CATEGORIES.has(category))return handicapResultIntegrity(values,category,ctx);
    return {valid:true,status:'not_applicable',warnings:[],trusted:true,validator:'NONE'};
  }

function asianHandicapIntegrity(values,category,ctx={}){
    if(!ASIAN_HANDICAP_CATEGORIES.has(category)){
      return {valid:true,status:'not_applicable',warnings:[],trusted:true,validator:'ASIAN_HANDICAP'};
    }

    const active=(values||[]).filter(v=>!v.suspended);
    if(!active.length){
      return {valid:false,status:'no_active_values',warnings:['AH_NO_ACTIVE_VALUES'],trusted:false,validator:'ASIAN_HANDICAP'};
    }

    const primary=active.some(v=>v.main===true)?active.filter(v=>v.main===true):active;
    const warnings=[];
    let home=primary.find(v=>v.selection_outcome==='home'||v.selection_side==='home');
    let away=primary.find(v=>v.selection_outcome==='away'||v.selection_side==='away');

    // Some feeds mark only one selection main=true. Find the opposite side on
    // the same absolute line from all active values.
    if(home&&!away){
      const h=numericHandicap(home.handicap);
      away=active.find(v=>(v.selection_outcome==='away'||v.selection_side==='away')&&sameAbs(numericHandicap(v.handicap),h))
        || active.find(v=>v.selection_outcome==='away'||v.selection_side==='away');
    }
    if(away&&!home){
      const a=numericHandicap(away.handicap);
      home=active.find(v=>(v.selection_outcome==='home'||v.selection_side==='home')&&sameAbs(numericHandicap(v.handicap),a))
        || active.find(v=>v.selection_outcome==='home'||v.selection_side==='home');
    }

    if(!home||!away){
      const numeric=primary
        .map(v=>({n:numericHandicap(v.handicap),outcome:v.selection_outcome,value:v.value}))
        .filter(x=>Number.isFinite(x.n));

      if(numeric.length===2){
        const [x,y]=numeric;
        if(Math.abs(x.n+y.n)<1e-9){
          return {
            valid:true,status:'complementary_unlabeled',
            warnings:['AH_PAIR_SIDE_LABEL_NOT_EXPLICIT'],
            trusted:false,validator:'ASIAN_HANDICAP'
          };
        }
        if(sameAbs(x.n,y.n)&&Math.sign(x.n)===Math.sign(y.n)&&x.n!==0){
          return {
            valid:false,status:'same_sign_pair_unlabeled',
            warnings:[`AH_IMPOSSIBLE_PAIR ${x.n} / ${y.n}`],
            trusted:false,validator:'ASIAN_HANDICAP'
          };
        }
      }

      return {
        valid:true,status:'unpaired',
        warnings:['AH_PAIR_NOT_EXPLICIT'],
        trusted:false,validator:'ASIAN_HANDICAP'
      };
    }

    const h=numericHandicap(home.handicap),a=numericHandicap(away.handicap);
    if(h===null||a===null){
      return {
        valid:false,status:'missing_line',
        warnings:['AH_HANDICAP_MISSING'],
        trusted:false,validator:'ASIAN_HANDICAP'
      };
    }

    if(Math.abs(h+a)<1e-9){
      return {valid:true,status:'complementary',warnings, trusted:true,validator:'ASIAN_HANDICAP'};
    }

    if(sameAbs(h,a)&&Math.sign(h)===Math.sign(a)&&h!==0){
      warnings.push(`AH_IMPOSSIBLE_PAIR home ${h} / away ${a}`);
      return {
        valid:false,status:'same_sign_pair',
        warnings,trusted:false,validator:'ASIAN_HANDICAP'
      };
    }

    warnings.push(`AH_NON_COMPLEMENTARY home ${h} / away ${a}`);
    return {
      valid:false,status:'non_complementary',
      warnings,trusted:false,validator:'ASIAN_HANDICAP'
    };
  }

function sameAbs(a,b){
    return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(Math.abs(a)-Math.abs(b))<1e-9;
  }

function handicapResultIntegrity(values,category,ctx={}){
    if(!HANDICAP_RESULT_CATEGORIES.has(category)){
      return {valid:true,status:'not_applicable',warnings:[],trusted:true,validator:'HANDICAP_RESULT'};
    }

    const active=(values||[]).filter(v=>!v.suspended);
    if(!active.length){
      return {
        valid:false,status:'no_active_values',
        warnings:['HR_NO_ACTIVE_VALUES'],
        trusted:false,validator:'HANDICAP_RESULT'
      };
    }

    const outcomes=new Set(active.map(v=>v.selection_outcome).filter(Boolean));
    const numericLines=active.map(v=>numericHandicap(v.handicap)).filter(Number.isFinite);

    // A normal Handicap Result is 3-way. If labels are not explicit, keep it
    // usable only as unverified rather than pretending it is Asian Handicap.
    if(outcomes.has('home')&&outcomes.has('draw')&&outcomes.has('away')){
      return {
        valid:true,status:'three_way_result',
        warnings:[],trusted:true,validator:'HANDICAP_RESULT'
      };
    }

    if(active.length>=3){
      return {
        valid:true,status:'three_way_unlabeled',
        warnings:['HR_SELECTION_LABELS_NOT_EXPLICIT'],
        trusted:false,validator:'HANDICAP_RESULT'
      };
    }

    // Two-way/incomplete feed: do not apply Asian sign logic. Mark as
    // incomplete/untrusted and exclude from main executable lines.
    return {
      valid:false,status:'incomplete_result_market',
      warnings:[`HR_SELECTIONS_INCOMPLETE n=${active.length}`],
      trusted:false,validator:'HANDICAP_RESULT'
    };
  }

function status(el,msg,type=''){el.className='status'+(type?' '+type:'');el.textContent=msg}

function watchMarketInfo(markets,history=null){
    const raw=(markets||[]),valid=raw.filter(r=>r.integrity?.valid!==false&&!r.status?.blocked&&!r.status?.stopped&&!r.status?.finished&&(r.values||[]).some(v=>!v.suspended));
    const over=valid.filter(r=>r.category==='over_under'||/over.?under|total goals|goals over/i.test(String(r.market||r.bet||'')));
    const ah=valid.filter(r=>r.category==='asian_handicap'),txt=xienMarketText(valid,true,2),best=watchBestOver(over);
    const move=history?.categories?.over_under||null,fp=move?watchOverPriceFromMap(move.from_prices):null,tp=move?watchOverPriceFromMap(move.to_prices):null;
    return {raw_count:raw.length,valid_count:valid.length,invalid_count:Math.max(0,raw.length-valid.length),over_count:over.length,ah_count:ah.length,has_over:over.length>0,best_over:best,history,move:{line_delta:move?.line_delta??null,from_line:move?.from_line??null,to_line:move?.to_line??null,over_price_delta:fp!=null&&tp!=null?Math.round((tp-fp)*1000)/1000:null,from_over_price:fp,to_over_price:tp},text:txt.join(' || ')||'Chưa có live main line hợp lệ',movement_text:movementCompactText(history)||''};
  }

function xienMarketText(rows,liveMode,maxMarkets=4){
    const allowed=liveMode?XIEN_ALLOWED_LIVE:XIEN_ALLOWED_PRE;
    const out=[];
    for(const r of (rows||[])){
      if(!allowed.has(r.category))continue;
      if(r.integrity?.valid===false)continue;
      if(r.status?.blocked||r.status?.stopped||r.status?.finished)continue;

      const vals=(r.values||[]).filter(v=>!v.suspended);
      if(!vals.length)continue;

      const mainVals=vals.some(v=>v.main===true)?vals.filter(v=>v.main===true):vals;
      const picked=(mainVals.length?mainVals:vals).slice(0,4);
      const txt=picked.map(v=>{
        const side=v.selection_outcome||v.selection_side||v.value||'';
        const line=v.handicap!==null&&v.handicap!==undefined?` ${Number(v.handicap)>0?'+':''}${v.handicap}`:'';
        const odd=v.odd!==null&&v.odd!==undefined?` @${v.odd}`:'';
        return `${side}${line}${odd}`.trim();
      }).join(', ');
      if(txt)out.push(`${r.category}: ${txt}${r.integrity?.trusted===false?' [UNVERIFIED_SIDE]':''}`);
      if(out.length>=maxMarkets)break;
    }
    return out;
  }

function watchBestOver(overMarkets){
    const rows=[];
    for(const m of (overMarkets||[]))for(const v of (m.values||[])){
      if(v.suspended)continue;const raw=String(v.value||'');if(!/\bover\b|\btài\b|\btai\b/i.test(raw))continue;
      const odd=Number(v.odd),line=numericHandicap(v.handicap)??betTrackerLineFromValue?.(v,'over_under');
      if(Number.isFinite(odd)&&odd>1)rows.push({line:Number.isFinite(Number(line))?Number(line):null,odd,main:v.main===true,label:raw});
    }
    rows.sort((a,b)=>Number(b.main)-Number(a.main)||Math.abs((a.odd||2)-1.9)-Math.abs((b.odd||2)-1.9));return rows[0]||null;
  }

function betTrackerLineFromValue(v,category){
    if(category==='match_winner')return null;
    const h=numericHandicap(v?.handicap);
    if(h!==null)return h;
    const raw=String(v?.value||'');
    const nums=[...raw.matchAll(/([+-]?\d+(?:[.,]\d+)?)/g)].map(m=>Number(m[1].replace(',','.'))).filter(Number.isFinite);
    return nums.length?nums[nums.length-1]:null;
  }

function watchOverPriceFromMap(o){for(const [k,v] of Object.entries(o||{})){if(/over|tài|tai/i.test(k)&&Number.isFinite(Number(v)))return Number(v)}return null}

function movementCompactText(h){
    if(!h||h.snapshot_count<2)return null;
    const parts=[];
    Object.entries(h.categories||{}).forEach(([cat,x])=>{
      if(!x.changed)return;
      const fp=Object.entries(x.from_prices||{}).map(([k,v])=>`${k}@${v}`).join('/');
      const tp=Object.entries(x.to_prices||{}).map(([k,v])=>`${k}@${v}`).join('/');
      parts.push(`${cat}: ${x.from_line??'-'} ${fp||''} → ${x.to_line??'-'} ${tp||''}`.trim());
    });
    return parts.length?`n=${h.snapshot_count} / ${h.window_minutes}m | ${parts.slice(0,3).join(' || ')}`:`n=${h.snapshot_count} / ${h.window_minutes}m | line/price chưa đổi`;
  }

function summarizeLiveOddsHistory(rows){
    const r=(rows||[]).slice(-LIVE_ODDS_HISTORY_MAX_SNAPSHOTS);
    if(!r.length)return {snapshot_count:0,status:'NO_LOCAL_HISTORY',window_minutes:0,categories:{},timeline:[]};
    const first=r[0],last=r[r.length-1];
    const cats=new Set();
    r.forEach(x=>Object.keys(x.lines||{}).forEach(k=>cats.add(k)));
    const categories={};
    cats.forEach(cat=>{
      const f=r.find(x=>x.lines?.[cat])?.lines?.[cat]||null;
      const l=[...r].reverse().find(x=>x.lines?.[cat])?.lines?.[cat]||null;
      if(f&&l)categories[cat]=movementForCategory(f,l);
    });
    return {
      snapshot_count:r.length,
      status:r.length>=2?'HISTORY_AVAILABLE':'BASELINE_ONLY',
      window_minutes:Math.round(((last.captured_at-first.captured_at)/60000)*10)/10,
      first:{captured_at:first.captured_at,minute:first.minute,score:first.score},
      latest:{captured_at:last.captured_at,minute:last.minute,score:last.score},
      categories,
      timeline:r.slice(-10).map(x=>({
        captured_at:x.captured_at,minute:x.minute,score:x.score,
        lines:Object.fromEntries(Object.entries(x.lines||{}).map(([k,v])=>[k,{line:v.line,prices:priceMap(v)}]))
      }))
    };
  }

function movementForCategory(first,last){
    const a=numericMaybe(first?.line),b=numericMaybe(last?.line);
    return {
      from_line:first?.line??null,
      to_line:last?.line??null,
      line_delta:a!=null&&b!=null?Math.round((b-a)*100)/100:null,
      from_prices:priceMap(first),
      to_prices:priceMap(last),
      changed:JSON.stringify({l:first?.line,p:priceMap(first)})!==JSON.stringify({l:last?.line,p:priceMap(last)})
    };
  }

function numericMaybe(v){const n=Number(v);return Number.isFinite(n)?n:null}

function priceMap(line){
    const o={};(line?.values||[]).forEach(v=>{if(v?.odd!=null)o[v.key||v.value||'selection']=v.odd});return o
  }

function createLiveOddsSnapshot(fixtureId,meta,markets){
    const lines={};
    for(const m of (markets||[])){
      if(!m?.category||m?.integrity?.valid===false)continue;
      if(lines[m.category])continue;
      const c=compactMovementLine(m);
      if(c.values.length)lines[m.category]=c;
    }
    const status=meta?.fixture?.status||meta?.status||{};
    const goals=meta?.goals||{};
    return {
      captured_at:Date.now(),
      fixture_id:fixtureId,
      minute:status?.elapsed??null,
      status:status?.short??null,
      score:{home:goals?.home??null,away:goals?.away??null},
      lines
    };
  }

function compactMovementLine(m){
    const vals=(m?.values||[]).filter(v=>!v.suspended).slice(0,4).map(v=>({
      key:marketValueKey(v),
      value:v.value??null,
      handicap:v.handicap??null,
      odd:v.odd??null,
      main:v.main===true
    }));
    return {
      bet:m?.bet??m?.market??null,
      category:m?.category??null,
      line:m?.main_line??vals.find(v=>v.main)?.handicap??vals[0]?.handicap??null,
      update:m?.update??null,
      values:vals
    };
  }

function marketValueKey(v){
    return v?.selection_outcome||v?.selection_side||String(v?.value??'').trim()||'selection';
  }

function liveSnapshotFingerprint(snap){
    try{return JSON.stringify(snap?.lines||{})}catch{return String(Date.now())}
  }

function eventsCompact(events){return (events||[]).slice(-90).map(e=>({time:e.time?.elapsed,extra:e.time?.extra,team:e.team?.name,team_id:e.team?.id,player:e.player?.name,player_id:e.player?.id,assist:e.assist?.name||null,assist_id:e.assist?.id||null,type:e.type,detail:e.detail,comments:e.comments||null}))}

function normalizeHalfStatistics(resp,fullFallback){
    const full=statMap(fullFallback||resp),first={},second={};
    (resp||[]).forEach(side=>{
      const team=side.team;if(!team?.id)return;
      const seg=halfLabel(side.half??side.period??side.time??side.segment);
      if(seg&&Array.isArray(side.statistics)){assignSegment(seg==='first_half'?first:seg==='second_half'?second:full,team,side.statistics)}
      const containers={
        first_half:side.statistics_1half??side.statistics_first_half??side.first_half??side.firstHalf??side.halftime,
        second_half:side.statistics_2half??side.statistics_second_half??side.second_half??side.secondHalf,
        full:side.full??side.fulltime??side.full_time
      };
      if(containers.first_half)assignSegment(first,team,containers.first_half);
      if(containers.second_half)assignSegment(second,team,containers.second_half);
      if(containers.full)assignSegment(full,team,containers.full);
      if(Array.isArray(side.statistics)){
        const f1={},f2={},ft={};
        side.statistics.forEach(s=>{
          const v=s?.value;if(v&&typeof v==='object'){
            const a=v.first_half??v.firstHalf??v.halftime??v.h1,b=v.second_half??v.secondHalf??v.h2,t=v.full??v.fulltime??v.total;
            if(a!==undefined)f1[s.type]=a;if(b!==undefined)f2[s.type]=b;if(t!==undefined)ft[s.type]=t;
          }
          const a=s?.halftime??s?.first_half??s?.firstHalf,b=s?.second_half??s?.secondHalf;
          if(a!==undefined)f1[s.type]=a;if(b!==undefined)f2[s.type]=b;
        });
        if(Object.keys(f1).length)assignSegment(first,team,{stats:f1});if(Object.keys(f2).length)assignSegment(second,team,{stats:f2});if(Object.keys(ft).length)assignSegment(full,team,{stats:ft});
      }
    });
    let derived=false;if(!Object.keys(second).length&&Object.keys(full).length&&Object.keys(first).length){const d=deriveH2(full,first);Object.assign(second,d.map);derived=d.derived}
    return {full,first_half:first,second_half:second,second_half_derived:derived};
  }

function halfLabel(x){const s=String(x??'').toLowerCase();if(/(^|\D)1(\D|$)|first|1st|h1/.test(s))return 'first_half';if(/(^|\D)2(\D|$)|second|2nd|h2/.test(s))return 'second_half';if(/full|ft|total/.test(s))return 'full';return null}

function assignSegment(out,team,stats){if(!team?.id||!stats)return;out[team.id]={team,stats:Array.isArray(stats)?statListToObject(stats):(stats.stats||stats)}}

function deriveH2(full,h1){
    const out={};let any=false;
    Object.keys(full||{}).forEach(id=>{const f=full[id],a=h1?.[id];if(!f||!a)return;const stats={};Object.entries(f.stats||{}).forEach(([k,v])=>{if(!additiveStatName(k))return;const fv=numericStat(v),hv=numericStat(a.stats?.[k]);if(fv==null||hv==null)return;stats[k]=Math.round((fv-hv)*100)/100});if(Object.keys(stats).length){out[id]={team:f.team,stats};any=true}});
    return {map:out,derived:any};
  }

function additiveStatName(k){return /shot|blocked|foul|corner|offside|yellow|red|save|pass|expected[_ ]?goals|throw|free kick|goal kick|attack/i.test(String(k))&&!/%|possession|accuracy/i.test(String(k))}

function numericStat(v){if(v==null||v===''||typeof v==='object')return null;const s=String(v).trim();if(s.endsWith('%'))return null;const n=Number(s);return Number.isFinite(n)?n:null}

function watchAggregate(statMapObj,meta){
    const h=watchSideMetrics(statMapObj?.[meta?.teams?.home?.id]),a=watchSideMetrics(statMapObj?.[meta?.teams?.away?.id]);
    const t={};['shots','sot','inbox','corners','xg','red'].forEach(k=>t[k]=(Number(h[k])||0)+(Number(a[k])||0));
    return {home:h,away:a,total:t};
  }

function watchSideMetrics(statSide){
    const get=(names)=>{const v=getAnyStat(statSide,names);const n=watchNum(v);return n==null?0:n};
    return {shots:get(['Total Shots']),sot:get(['Shots on Goal','Shots on Target']),inbox:get(['Shots insidebox','Shots inside box']),corners:get(['Corner Kicks','Corners']),xg:get(['expected_goals','Expected Goals']),red:get(['Red Cards'])};
  }

function watchStatsPresence(statMapObj,meta){
    const ids=[meta?.teams?.home?.id,meta?.teams?.away?.id].filter(x=>x!=null),keys=[];
    let sideCount=0;
    for(const id of ids){const side=statMapObj?.[id],obj=side?.stats||side||{};const sk=Object.keys(obj);if(sk.length)sideCount++;keys.push(...sk.map(k=>String(k).toLowerCase().replace(/[_-]+/g,' ')))}
    const has=(rx)=>keys.some(k=>rx.test(k));
    const shots=has(/total shots|shots total/),sot=has(/shots on goal|shots on target/),inbox=has(/shots inside ?box|shots insidebox/),corners=has(/corner kicks|corners?/),xg=has(/expected goals|expectedgoals/);
    const pressure=shots||sot||inbox||corners||xg,chance=sot||inbox||xg,coverage=[shots,sot,inbox,corners,xg].filter(Boolean).length;
    return {shots,sot,inbox,corners,xg,pressure,chance,momentum:pressure,core:sideCount>=2&&pressure&&chance,coverage,source_keys:keys.length,side_count:sideCount};
  }

function groupCoverageScore(mode,n){
    let checks,weights;
    if(mode==='PRE'){
      checks={fixture:true,recent:(n.home_recent||[]).length>0&&(n.away_recent||[]).length>0,odds:(n.odds||[]).length>0,standings:(n.standings||[]).length>0,team_stats:!!n.home_team_stats&&!!n.away_team_stats};
      weights={fixture:15,recent:30,odds:25,standings:15,team_stats:15};
    }else{
      checks={fixture:true,statistics:Object.keys(n.live_statistics||{}).length>0,events:(n.events||[]).length>0,live_odds:(n.live_odds||[]).length>0,recent:(n.home_recent||[]).length>0&&(n.away_recent||[]).length>0,odds:(n.odds||[]).length>0,standings:(n.standings||[]).length>0};
      weights={fixture:10,statistics:25,events:15,live_odds:22,recent:15,odds:5,standings:8};
    }
    let got=0,total=0;Object.keys(weights).forEach(k=>{total+=weights[k];if(checks[k])got+=weights[k]});const cov=Math.round(got/Math.max(1,total)*100);return {...dataQuality(mode,n,cov,null),checks};
  }

function dataQuality(mode,n,coverage,meta){
    const live=mode!=='PRE';
    const markets=live?(n.market?.live||n.live_odds||[]):(n.market?.prematch||n.odds||[]);
    const mi=marketIntegrityScore(markets);

    let integrity=mi.score;
    const warnings=[...mi.warnings];

    const hn=(n.home_recent||[]).slice(0,5).length;
    const an=(n.away_recent||[]).slice(0,5).length;
    const minN=Math.min(hn||0,an||0);

    if(minN>0&&minN<3){
      integrity=Math.max(0,integrity-(live?5:10));
      warnings.push(`RECENT_SAMPLE_LOW H=${hn} A=${an}`);
    }

    const fr=marketFreshness(markets,live);
    if(fr.note)warnings.push(fr.note);

    // Coverage owns "market missing". Freshness only evaluates a market that exists.
    const parts=[
      {score:coverage,weight:45},
      {score:integrity,weight:40}
    ];
    if(fr.applicable&&Number.isFinite(fr.score)){
      parts.push({score:fr.score,weight:15});
    }

    const weightSum=parts.reduce((s,p)=>s+p.weight,0);
    const overall=Math.round(parts.reduce((s,p)=>s+p.score*p.weight,0)/Math.max(1,weightSum));

    return {
      score:overall,
      coverage_score:coverage,
      integrity_score:Math.round(integrity),
      freshness_score:fr.applicable?Math.round(fr.score):null,
      freshness_applicable:fr.applicable,
      freshness_status:fr.status,
      freshness_age_min:fr.age_min,
      sample_sizes:{home_recent:hn,away_recent:an},
      market_integrity:{
        applicable:markets.length>0,
        checked:mi.checked,
        invalid:mi.invalid
      },
      warnings:[...new Set(warnings)].slice(0,12)
    };
  }

function marketIntegrityScore(markets){
    const warnings=[];let score=100,checked=0,invalid=0;
    for(const m of (markets||[])){
      if(m.integrity){checked++;if(m.integrity.valid===false){invalid++;score-=45;(m.integrity.warnings||[]).forEach(w=>warnings.push(`${m.category||m.market||'market'}: ${w}`))}}
      for(const v of (m.values||[])){
        const odd=Number(v.odd);if(v.odd!=null&&(!Number.isFinite(odd)||odd<=1)){score-=12;warnings.push(`${m.category||m.market||'market'}: ODD_INVALID ${v.odd}`)}
      }
    }
    return {score:Math.max(0,Math.min(100,score)),warnings,checked,invalid};
  }

function marketFreshness(markets,live){
    const rows=(markets||[]);

    // No market exists at all: this is a COVERAGE issue, not a freshness issue.
    // Do NOT emit NO_MARKET_TIMESTAMP and do NOT manufacture a freshness score.
    if(!rows.length){
      return {
        score:null,
        applicable:false,
        age_min:null,
        note:null,
        status:'NO_MARKET_DATA'
      };
    }

    const times=rows.map(m=>parseUpdateMs(m.update)).filter(Number.isFinite);
    let note=null;
    let score;
    let age=null;

    // Market exists but the feed did not provide an update timestamp.
    if(!times.length){
      score=live?65:75;
      note='NO_MARKET_TIMESTAMP';
    }else{
      age=Math.max(0,(Date.now()-Math.max(...times))/60000);
      if(live)score=age<=2?100:age<=5?90:age<=10?75:age<=20?50:25;
      else score=age<=360?100:age<=1440?85:age<=2880?65:40;
    }

    if(live){
      const feedUnavailable=rows.every(m=>m.status?.blocked||m.status?.stopped||m.status?.finished);
      const allSuspended=rows.every(m=>(m.values||[]).length>0&&(m.values||[]).every(v=>v.suspended));

      if(feedUnavailable){
        score=Math.min(score,35);
        note=note?note+'; LIVE_MARKET_BLOCKED_OR_STOPPED':'LIVE_MARKET_BLOCKED_OR_STOPPED';
      }
      if(allSuspended){
        score=Math.min(score,30);
        note=note?note+'; LIVE_MARKET_ALL_SUSPENDED':'LIVE_MARKET_ALL_SUSPENDED';
      }
    }

    return {
      score,
      applicable:true,
      age_min:age==null?null:Math.round(age*10)/10,
      note,
      status:'MARKET_PRESENT'
    };
  }

function parseUpdateMs(v){if(v===null||v===undefined||v==='')return null;if(typeof v==='number'){const t=v<1e12?v*1000:v;return Number.isFinite(t)?t:null}const n=Number(v);if(Number.isFinite(n)&&String(v).trim()!=='')return n<1e12?n*1000:n;const t=Date.parse(v);return Number.isFinite(t)?t:null}
return {watchEvaluate,grEstimate,hcTeamStates,hcWindow,hcGameRegime,handicapAggregate,statMap,normalizeLiveMarkets,watchMarketInfo,summarizeLiveOddsHistory,createLiveOddsSnapshot,liveSnapshotFingerprint,eventsCompact,normalizeHalfStatistics,watchAggregate,watchStatsPresence,groupCoverageScore};
}
