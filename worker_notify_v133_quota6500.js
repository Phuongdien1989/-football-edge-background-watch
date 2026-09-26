import base,{BackgroundWatcher as NativeWatcher} from './worker_notify_v132_native.js';
import {createEngine} from './notify-core-h1.js';
import {crossing} from './worker_notify.js';

// P1.0 / Q6500 — adaptive API quota pacing for the notification scanner.
// ADDITIVE / NON-REGRESSION:
// - Inherits Web Push, Native Push, scan-control, validation, D1 and all scoring logic.
// - Does NOT change H1/FT/HC scoring or user notification thresholds.
// - Replaces only notifyTick cadence/breadth so a 6,500-call/day operating envelope
//   spends API calls on HOT/WARM fixtures before cold breadth.
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*',
  'access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'
}});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)));
const errText=e=>String(e?.message||e||'UNKNOWN').slice(0,140);
const DAY_MS=86400000;
const PACER_KEY='notify:q6500:pacer:v1';
const PACER_BUCKET_CAP=9;
const PACER_INITIAL_TOKENS=5;
const DEFAULT_NOTIFY_BUDGET=4500;
const DEFAULT_VALIDATION_BUDGET=500;
const DEFAULT_TOTAL_TARGET=6500;
const DEFAULT_FOREGROUND_RESERVE=1000;
const DEFAULT_SAFETY_RESERVE=500;
const h1Default=72;
function prefs(p={}){return {enabled:p.enabled!==false,h1:p.h1!==false,goal:p.goal!==false,gap:p.gap!==false,h1Threshold:Number.isFinite(Number(p.h1Threshold))?clamp(p.h1Threshold,1,100):h1Default,goalThreshold:Number.isFinite(Number(p.goalThreshold))?clamp(p.goalThreshold,1,100):70,gapThreshold:Number.isFinite(Number(p.gapThreshold))?clamp(p.gapThreshold,1,100):70}}
function bestOver(markets){const rows=[];for(const m of markets||[])for(const v of m.values||[]){if(v.suspended)continue;const raw=String(v.value||'');if(!/\bover\b|\btài\b|\btai\b/i.test(raw))continue;const odd=Number(v.odd),line=Number(v.handicap);if(Number.isFinite(odd)&&odd>1)rows.push({line:Number.isFinite(line)?line:null,odd,main:v.main===true,label:raw})}rows.sort((a,b)=>Number(b.main)-Number(a.main)||Math.abs((a.odd||2)-1.9)-Math.abs((b.odd||2)-1.9));return rows[0]||null}
function overPrice(map){for(const [k,v] of Object.entries(map||{})){if(/over|tài|tai/i.test(k)&&Number.isFinite(Number(v)))return Number(v)}return null}
function h1MarketInfo(markets,history=null){const raw=(markets||[]).filter(r=>r.category==='h1_total'||/first half.*(over|under|total)|1st half.*(over|under|total)|half time.*total|1h.*total/i.test(String(r.market||r.bet||'')));const valid=raw.filter(r=>r.integrity?.valid!==false&&!r.status?.blocked&&!r.status?.stopped&&!r.status?.finished&&(r.values||[]).some(v=>!v.suspended));const move=history?.categories?.h1_total||null,fp=move?overPrice(move.from_prices):null,tp=move?overPrice(move.to_prices):null;return {raw_count:raw.length,valid_count:valid.length,invalid_count:Math.max(0,raw.length-valid.length),has_over:valid.length>0,best_over:bestOver(valid),history,move:{line_delta:move?.line_delta??null,from_line:move?.from_line??null,to_line:move?.to_line??null,over_price_delta:fp!=null&&tp!=null?Math.round((tp-fp)*1000)/1000:null,from_over_price:fp,to_over_price:tp}}}
function h1Gate(e,threshold){if(!e||e.scoreMode!=='FULL'||e.hardVeto||Number(e.baselineAge||0)<2)return false;if(Number(e.score)<Number(threshold))return false;return true}
function resetType(prev,cur){if(!prev)return null;const pg=Number(prev.goals?.home||0)+Number(prev.goals?.away||0),cg=Number(cur.goals?.home||0)+Number(cur.goals?.away||0);if(cg>pg)return 'GOAL';const pr=Number(prev.metrics?.total?.red||0),cr=Number(cur.metrics?.total?.red||0);if(cr>pr)return 'RED';return null}
function payloadFor(f,s,id,signals){const rows=[];if(signals.h1)rows.push(`H1 ${Math.round(signals.h1.value)}/100 ≥ ${signals.h1.threshold}`);if(signals.goal)rows.push(`Goal FT ${Math.round(signals.goal.value)}/100 ≥ ${signals.goal.threshold}`);if(signals.gap)rows.push(`GAP ${signals.gap.actual} ≥ ${signals.gap.threshold}`);const modes=[];if(signals.h1)modes.push('H1');if(signals.goal)modes.push('FT');if(signals.gap)modes.push('HC');return {title:rows.length>1?'Football Edge • NHIỀU TÍN HIỆU':signals.h1?'Football Edge • H1 Watch':signals.goal?'Football Edge • Goal Radar FT':'Football Edge • LIVE GAP',body:`${f.teams.home.name} – ${f.teams.away.name} | ${s.minute}′ | ${s.score}\n${rows.join(' • ')}`,url:`https://ancient-butterfly-f4b0.ngophuonghuy.workers.dev/?fe_fixture=${id}&fe_mode=${modes[0]||'FT'}#analysisCard`,tag:`fe-${id}-${modes.join('-').toLowerCase()}`,created_at:s.stamp,fixture_id:id,fe_mode:modes[0]||'FT',signals}}
function finite(v){if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null}
function quotaMode(used,max){const r=max>0?used/max:1;if(r>=1)return 'STOP';if(r>=0.92)return 'CRITICAL';if(r>=0.80)return 'TIGHT';if(r>=0.60)return 'CONSERVE';return 'NORMAL'}
function alarmMsForMode(mode){if(mode==='CRITICAL')return 120000;if(mode==='TIGHT')return 90000;if(mode==='CONSERVE')return 75000;if(mode==='STOP')return 300000;return 60000}
function priorityInfo(f,item,now){const last=item?.last||{},gap=Math.abs(finite(last.gap)||0),h1=finite(last.h1Score)||0,goal=finite(last.goalScore)||0;const unseen=!Number(item?.lastAt),age=unseen?Infinity:Math.max(0,now-Number(item.lastAt||0));let tier='COLD',score=0,dueMs=600000;if(unseen){tier='NEW';score=85;dueMs=0}if(gap>=60||h1>=65||goal>=65){tier='HOT';score=120+Math.max(gap,h1,goal);dueMs=90000}else if(gap>=45||h1>=55||goal>=55){tier='WARM';score=90+Math.max(gap,h1,goal);dueMs=240000}const minute=Number(f?.fixture?.status?.elapsed||0);if(minute>=20&&minute<=45)score+=8;if(minute>=55&&minute<=85)score+=6;score+=Math.min(30,Number.isFinite(age)?age/60000:30);return {tier,score,dueMs,age,due:unseen||age>=dueMs}}

export class BackgroundWatcher extends NativeWatcher{
  qcfg(){const notify=Math.max(500,Number(this.env.NOTIFY_DAILY_BUDGET)||DEFAULT_NOTIFY_BUDGET);const validation=Math.max(0,Number(this.env.VALIDATION_DAILY_BUDGET)||DEFAULT_VALIDATION_BUDGET);const total=Math.max(notify+validation,Number(this.env.API_TOTAL_DAILY_BUDGET)||DEFAULT_TOTAL_TARGET);const foreground=Math.max(0,Number(this.env.API_FOREGROUND_RESERVE)||DEFAULT_FOREGROUND_RESERVE);const safety=Math.max(0,Number(this.env.API_SAFETY_RESERVE)||DEFAULT_SAFETY_RESERVE);return {notify,validation,total,foreground,safety}}
  async loadPacer(now,budgetMax,used=0){const day=new Date(now).toISOString().slice(0,10);let p=await this.ctx.storage.get(PACER_KEY);if(!p||p.day!==day)p={day,tokens:PACER_INITIAL_TOKENS,lastRefill:now};const last=Number(p.lastRefill||now),elapsed=Math.max(0,Math.min(DAY_MS,now-last));const d=new Date(now),resetAt=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1),timeLeft=Math.max(60000,resetAt-now);const remaining=Math.max(0,budgetMax-Math.max(0,Number(used)||0)),rate=remaining/timeLeft;p.tokens=Math.min(PACER_BUCKET_CAP,Math.max(0,Number(p.tokens)||0)+elapsed*rate);p.lastRefill=now;p.refillRatePerMinute=rate*60000;p.resetAt=resetAt;return p}
  async quotaStatus(){const now=Date.now(),day=new Date(now).toISOString().slice(0,10),cfg=this.qcfg();let b=await this.ctx.storage.get('notify:budget');if(b?.day!==day)b={day,used:0};const p=await this.loadPacer(now,cfg.notify,Number(b.used||0)),mode=quotaMode(Number(b.used||0),cfg.notify);return {schema:'FE_API_QUOTA_6500_V1',day,total_target:cfg.total,notify_budget:cfg.notify,validation_budget:cfg.validation,foreground_reserve:cfg.foreground,safety_reserve:cfg.safety,notify_used:Number(b.used||0),notify_remaining:Math.max(0,cfg.notify-Number(b.used||0)),mode,tokens:Math.round(Number(p.tokens||0)*100)/100,refill_per_minute:Math.round(Number(p.refillRatePerMinute||0)*100)/100,reset_at:p.resetAt||null,next_cadence_ms:alarmMsForMode(mode)}}
  async fetch(request){const url=new URL(request.url);if(url.pathname==='/api/notify/quota-status'&&request.method==='GET')return reply({ok:true,quota:await this.quotaStatus()});return super.fetch(request)}
  async notifyTick(){
    const control=typeof this.scanControl==='function'?await this.scanControl():{enabled:true};if(control?.enabled===false)return;
    const devices=(await this.devices()).filter(d=>d.prefs.enabled&&(d.prefs.h1||d.prefs.goal||d.prefs.gap));if(!devices.length)return;
    const now=Date.now(),day=new Date(now).toISOString().slice(0,10),cfg=this.qcfg(),budgetMax=cfg.notify;
    let budget=await this.ctx.storage.get('notify:budget');if(budget?.day!==day)budget={day,used:0};
    const pacer=await this.loadPacer(now,budgetMax,Number(budget.used||0)),mode=quotaMode(Number(budget.used||0),budgetMax);
    const status={at:now,apiToday:Number(budget.used||0),apiLimit:budgetMax,live:0,scanned:0,signalEligible:0,degraded:0,alertsAccepted:0,signalCrossings:0,mechanisms:{h1:0,ft:0,hc:0},errors:[],warnings:[],quotaMode:mode,quotaTokens:Math.round(pacer.tokens*100)/100,quotaEnvelope:{total:cfg.total,notify:cfg.notify,validation:cfg.validation,foregroundReserve:cfg.foreground,safetyReserve:cfg.safety},quotaPaced:false};
    const persist=async()=>{status.apiToday=Number(budget.used||0);status.quotaTokens=Math.round(pacer.tokens*100)/100;status.at=Date.now();await this.ctx.storage.put({'notify:status':status,'notify:budget':budget,[PACER_KEY]:pacer})};
    if(mode==='STOP'){status.quotaPaced=true;status.errors.push({error:'NOTIFY_DAILY_BUDGET_REACHED'});await persist();return}
    if(pacer.tokens<1){status.quotaPaced=true;status.nextTokenMs=Math.ceil((1-pacer.tokens)/Math.max(1e-9,Number(pacer.refillRatePerMinute||0)/60000));await persist();return}
    const api=async(path,params,strict=true)=>{if(Number(budget.used||0)>=budgetMax)throw Error('NOTIFY_DAILY_BUDGET_REACHED');if(pacer.tokens<1)throw Error('NOTIFY_QUOTA_PACED');pacer.tokens=Math.max(0,pacer.tokens-1);budget.used=Number(budget.used||0)+1;return this.api(path,params,strict)};
    try{
      const live=(await api('/fixtures',{live:'all'},true)).filter(f=>['1H','2H','LIVE'].includes(f.fixture?.status?.short)&&Number(f.fixture?.status?.elapsed)>=1&&Number(f.fixture?.status?.elapsed)<=90);
      status.live=live.length;
      const all=[...(await this.ctx.storage.list({prefix:'notify:match:'})).values()],byId=new Map(all.map(x=>[x.id,x]));
      const ranked=live.map(f=>({f,item:byId.get(f.fixture.id),p:priorityInfo(f,byId.get(f.fixture.id),now)})).sort((a,b)=>Number(b.p.due)-Number(a.p.due)||b.p.score-a.p.score||(Number(a.item?.lastAt||0)-Number(b.item?.lastAt||0)));
      const modeMax=mode==='NORMAL'?2:1,tokenMax=Math.floor(pacer.tokens/4),deepSlots=Math.max(0,Math.min(modeMax,tokenMax));
      let candidates=ranked.filter(x=>x.p.due);if(!candidates.length&&pacer.tokens>=8)candidates=ranked;
      const batch=candidates.slice(0,deepSlots).map(x=>x.f);
      status.deepSlots=deepSlots;status.batchSize=batch.length;status.hot=ranked.filter(x=>x.p.tier==='HOT').length;status.warm=ranked.filter(x=>x.p.tier==='WARM').length;
      const activeIds=new Set(live.map(f=>f.fixture.id));for(const old of all)if(!activeIds.has(old.id)&&now-old.lastAt>3600000)await this.ctx.storage.delete('notify:match:'+old.id);
      const calibrations={};for(const d of devices){const cal={FT:[],legacyFT:[]};for(const key of Object.keys(cal))for(let i=0;i<5;i++)cal[key].push(...(await this.ctx.storage.get(`notify:cal:${d.id}:${key}:${i}`)||[]));calibrations[d.id]=createEngine(cal)}
      const engine=createEngine();
      for(const f of batch){
        const fixtureStarted=Date.now();const id=f.fixture.id,item=byId.get(id)||{id,history:[],h1History:[],hcHistory:[],oddsHistory:[],alerts:{}};
        item.history=item.history||[];item.h1History=item.h1History||[];item.hcHistory=item.hcHistory||[];item.oddsHistory=item.oddsHistory||[];item.alerts=item.alerts||{};
        try{
          if(pacer.tokens<4)break;
          const health={},sourceWarnings=[];
          const read=async(name,path,params)=>{try{const rows=await api(path,params,false);if(!Array.isArray(rows)){health[name]='INVALID';sourceWarnings.push(`${name}:INVALID_RESPONSE`);return []}health[name]=rows.length?'OK':'EMPTY';return rows}catch(e){health[name]='ERROR';sourceWarnings.push(`${name}:${errText(e)}`);return []}};
          const [stats,events,odds,half]=await Promise.all([read('stats','/fixtures/statistics',{fixture:id}),read('events','/fixtures/events',{fixture:id}),read('odds','/odds/live',{fixture:id}),read('half','/fixtures/statistics',{fixture:id,half:true})]);
          if(sourceWarnings.length){status.warnings.push({fixture:id,sources:sourceWarnings.slice(0,4)});if(status.warnings.length>20)status.warnings.shift()}
          if(Date.now()-fixtureStarted>60000)throw Error('FIXTURE_SNAPSHOT_STALE');
          if(!stats.length){item.last={goalMode:null,goalScore:null,h1Score:null,gap:null,at:Date.now(),sourceHealth:health,reason:'STATS_UNAVAILABLE'};status.scanned++;status.degraded++}
          else{
            const sm=engine.statMap(stats),presence=engine.watchStatsPresence(sm,f),metric=engine.watchAggregate(sm,f),hcMetrics=engine.handicapAggregate(sm,f);
            const markets=engine.normalizeLiveMarkets(odds,{homeName:f.teams.home.name,awayName:f.teams.away.name}),compact=markets.map(m=>({...m,market:m.bet,status:m.feed_status}));
            const stamp=Date.now(),score=`${f.goals.home}-${f.goals.away}`,red=metric.total.red,prevScore=item.score,prevRed=item.red,prevHalf=item.half;
            const fingerprint=JSON.stringify([f.fixture.status.elapsed,score,metric]);if(item.fingerprint!==fingerprint){item.fingerprint=fingerprint;item.changedAt=stamp}if(stamp-item.changedAt>180000)throw Error('PROVIDER_STATE_NOT_ADVANCING');
            const stateChanged=item.score!=null&&(prevScore!==score||prevRed!==red||prevHalf!==f.fixture.status.short);if(stateChanged){item.history=[];item.hcHistory=[];item.oddsHistory=[];item.cooldown=stamp+300000}
            item.half=f.fixture.status.short;item.score=score;item.red=red;
            const marketSnapshot=engine.createLiveOddsSnapshot(id,f,compact),last=item.oddsHistory.at(-1);if(!last||engine.liveSnapshotFingerprint(last)!==engine.liveSnapshotFingerprint(marketSnapshot)||stamp-last.captured_at>=180000)item.oddsHistory.push(marketSnapshot);item.oddsHistory=item.oddsHistory.filter(x=>stamp-x.captured_at<=1800000).slice(-30);
            const historySummary=engine.summarizeLiveOddsHistory(item.oddsHistory),halves=engine.normalizeHalfStatistics(half,stats),coverage=engine.groupCoverageScore('FT',{live_statistics:sm,events:engine.eventsCompact(events),live_odds:compact});
            const s={captured_at:stamp,fresh_at:stamp,minute:f.fixture.status.elapsed,status:f.fixture.status.short,goals:f.goals,metrics:metric,stats_presence:presence,h1:engine.watchAggregate(halves.first_half,f),h2:engine.watchAggregate(halves.second_half,f),market:engine.watchMarketInfo(compact,historySummary),dq:coverage.score,integrity:coverage.integrity_score};
            const slim={captured_at:stamp,minute:s.minute,goals:s.goals,metrics:metric,stats_presence:presence};item.history=item.history.filter(x=>stamp-x.captured_at<=1800000).concat(slim).slice(-40);
            const ft={...item,initialDQ:coverage.score,initialIntegrity:coverage.integrity_score,latest:s};ft.eval=engine.watchEvaluate(ft,s);
            const hs={...slim,metrics:hcMetrics},hi={history:item.hcHistory,preBaseline:{adv:0}},w3=engine.hcWindow(hi,hs,3),w5=engine.hcWindow(hi,hs,5),w10=engine.hcWindow(hi,hs,10),gap=engine.hcTeamStates(hi,hs,w3,w5,w10,engine.hcGameRegime(hs,w3,w5)).liveGap;item.hcHistory=item.hcHistory.filter(x=>stamp-x.captured_at<=1800000).concat(hs).slice(-40);
            let h1Eval=null;const h1Route=['1H','LIVE'].includes(s.status)&&Number(s.minute)>=20&&Number(s.minute)<=45;
            if(h1Route){const h1s={...slim,status:s.status,fresh_at:stamp,market:h1MarketInfo(compact,historySummary),dq:coverage.score,integrity:coverage.integrity_score};const prev=item.h1History.at(-1),ev=resetType(prev,h1s);if(ev){item.h1History=[];item.h1ResetAt=stamp;item.h1CooldownUntil=stamp+(ev==='GOAL'?120000:180000)}item.h1History=item.h1History.filter(x=>stamp-x.captured_at<=1800000).concat(slim).slice(-40);const h1Item={history:item.h1History,resetAt:item.h1ResetAt||0,initialDQ:coverage.score,initialIntegrity:coverage.integrity_score};h1Eval=engine.h1WatchEvaluate(h1Item,h1s);if(!item.h1CooldownUntil||stamp>=item.h1CooldownUntil)status.mechanisms.h1++}
            const hcReady=hcMetrics.dataTier==='FULL'&&(w3.usable||w5.usable);if(hcReady)status.mechanisms.hc++;if(s.status==='2H')status.mechanisms.ft++;
            let goalPeak=null;
            for(const d of devices){const dp=prefs(d.prefs),signals={};if(dp.h1&&h1Eval&&(!item.h1CooldownUntil||stamp>=item.h1CooldownUntil)){const candidate=h1Gate(h1Eval,dp.h1Threshold)?Number(h1Eval.score):null,check=crossing(item.alerts[d.id+':h1'],candidate,dp.h1Threshold,stamp);item.alerts[d.id+':h1']=check.state;if(check.send)signals.h1={value:candidate,threshold:dp.h1Threshold}}
              if(dp.goal){const goal=s.status==='2H'?calibrations[d.id].grEstimate(ft,'FT'):null,candidate=presence.core&&(!item.cooldown||stamp>=item.cooldown)?goal?.prob:null;if(candidate!==null&&candidate!==undefined&&candidate!==''&&Number.isFinite(Number(candidate)))goalPeak=Math.max(goalPeak??-Infinity,Number(candidate));const check=crossing(item.alerts[d.id+':goal'],candidate,dp.goalThreshold,stamp);item.alerts[d.id+':goal']=check.state;if(check.send)signals.goal={value:candidate,threshold:dp.goalThreshold,source:goal?.source||'MODEL'}}
              if(dp.gap){const candidate=presence.core&&(!item.cooldown||stamp>=item.cooldown)&&hcReady?Math.abs(gap):null,check=crossing(item.alerts[d.id+':gap'],candidate,dp.gapThreshold,stamp);item.alerts[d.id+':gap']=check.state;if(check.send)signals.gap={value:candidate,threshold:dp.gapThreshold,actual:`${gap>0?'+':''}${gap} • ${gap>0?f.teams.home.name:f.teams.away.name}`}}
              const kinds=Object.keys(signals);if(kinds.length){status.signalCrossings+=kinds.length;const packet=payloadFor(f,{minute:s.minute,score,stamp},id,signals);if(await this.send(d,packet)){for(const kind of kinds)item.alerts[d.id+':'+kind]={armed:false,lastSent:stamp};status.alertsAccepted++}}}
            status.signalEligible+=Number(!!h1Eval)+Number(s.status==='2H')+Number(hcReady);if(!presence.core)status.degraded++;item.last={goalMode:ft.eval.scoreMode,goalScore:Number.isFinite(goalPeak)?goalPeak:null,h1Score:h1Eval?.score??null,h1Mode:h1Eval?.scoreMode??null,gap,at:stamp,sourceHealth:health};status.scanned++;
          }
        }catch(e){status.errors.push({fixture:id,error:errText(e)})}
        item.lastAt=Date.now();const bytes=()=>new TextEncoder().encode(JSON.stringify(item)).byteLength;while(item.oddsHistory.length>2&&bytes()>100000)item.oddsHistory.shift();while(item.history.length>2&&bytes()>100000){item.history.shift();if(item.h1History.length>2)item.h1History.shift();if(item.hcHistory.length>2)item.hcHistory.shift()}await this.ctx.storage.put('notify:match:'+id,item);
      }
      const cadenceSec=alarmMsForMode(mode)/1000,deepPerRound=Math.max(1,batch.length||deepSlots||1);status.rotationEstimateSeconds=live.length?Math.ceil(live.length/deepPerRound)*cadenceSec:null;
    }catch(e){status.errors.push({error:errText(e)})}
    status.apiToday=Number(budget.used||0);status.durationMs=Date.now()-now;status.targetCadenceMs=alarmMsForMode(quotaMode(status.apiToday,budgetMax));status.startedAt=now;status.at=Date.now();await persist();
  }
  async alarm(){const started=Date.now();await super.alarm();try{const control=typeof this.scanControl==='function'?await this.scanControl():{enabled:true};const devices=(await this.devices()).filter(d=>d?.prefs?.enabled&&(d?.prefs?.h1||d?.prefs?.goal||d?.prefs?.gap));if(control?.enabled!==false&&devices.length){const q=await this.quotaStatus(),delay=alarmMsForMode(q.mode);await this.ctx.storage.setAlarm(Math.max(Date.now()+1000,started+delay))}}catch(e){console.log('Q6500 cadence reschedule failed',errText(e))}}
}
export default base;
