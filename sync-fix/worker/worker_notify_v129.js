import base,{BackgroundWatcher as DeepLinkWatcher} from './worker_notify_v128.js';
import {createEngine} from './notify-core-h1.js';
import {crossing} from './worker_notify.js';

// P0.7: one LIVE snapshot -> H1 Watch + FT Goal Radar + HC LIVE GAP -> threshold -> aggregated Push.
// Stable H1 scoring is copied unchanged into notify-core-h1.js; FT/HC remain inherited from notify-core.js.
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*',
  'access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'
}});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)));
const errText=e=>String(e?.message||e||'UNKNOWN').slice(0,120);
const h1Default=72;
function prefs(p={}){
  return {
    enabled:p.enabled!==false,
    h1:p.h1!==false,goal:p.goal!==false,gap:p.gap!==false,
    h1Threshold:Number.isFinite(Number(p.h1Threshold))?clamp(p.h1Threshold,1,100):h1Default,
    goalThreshold:Number.isFinite(Number(p.goalThreshold))?clamp(p.goalThreshold,1,100):70,
    gapThreshold:Number.isFinite(Number(p.gapThreshold))?clamp(p.gapThreshold,1,100):70
  };
}
function bestOver(markets){
  const rows=[];
  for(const m of markets||[])for(const v of m.values||[]){
    if(v.suspended)continue;const raw=String(v.value||'');if(!/\bover\b|\btài\b|\btai\b/i.test(raw))continue;
    const odd=Number(v.odd),line=Number(v.handicap);if(Number.isFinite(odd)&&odd>1)rows.push({line:Number.isFinite(line)?line:null,odd,main:v.main===true,label:raw});
  }
  rows.sort((a,b)=>Number(b.main)-Number(a.main)||Math.abs((a.odd||2)-1.9)-Math.abs((b.odd||2)-1.9));return rows[0]||null;
}
function overPrice(map){for(const [k,v] of Object.entries(map||{})){if(/over|tài|tai/i.test(k)&&Number.isFinite(Number(v)))return Number(v)}return null}
function h1MarketInfo(markets,history=null){
  const raw=(markets||[]).filter(r=>r.category==='h1_total'||/first half.*(over|under|total)|1st half.*(over|under|total)|half time.*total|1h.*total/i.test(String(r.market||r.bet||'')));
  const valid=raw.filter(r=>r.integrity?.valid!==false&&!r.status?.blocked&&!r.status?.stopped&&!r.status?.finished&&(r.values||[]).some(v=>!v.suspended));
  const move=history?.categories?.h1_total||null,fp=move?overPrice(move.from_prices):null,tp=move?overPrice(move.to_prices):null;
  return {raw_count:raw.length,valid_count:valid.length,invalid_count:Math.max(0,raw.length-valid.length),has_over:valid.length>0,best_over:bestOver(valid),history,
    move:{line_delta:move?.line_delta??null,from_line:move?.from_line??null,to_line:move?.to_line??null,over_price_delta:fp!=null&&tp!=null?Math.round((tp-fp)*1000)/1000:null,from_over_price:fp,to_over_price:tp}};
}
function h1Gate(e,threshold){
  if(!e||e.scoreMode!=='FULL'||e.hardVeto||Number(e.baselineAge||0)<2)return false;
  const score=Number(e.score);if(!Number.isFinite(score)||score<threshold)return false;
  if(threshold>=79)return !!(e.core?.available&&e.core?.pass&&e.mature&&e.market_available);
  if(threshold>=72)return !!(e.core?.available&&Number(e.core?.strongCount||0)>=2);
  return true;
}
function resetType(prev,cur){
  if(!prev)return null;
  const pg=(Number(prev.goals?.home)||0)+(Number(prev.goals?.away)||0),cg=(Number(cur.goals?.home)||0)+(Number(cur.goals?.away)||0);if(cg>pg)return 'GOAL';
  const pr=Number(prev.metrics?.total?.red||0),cr=Number(cur.metrics?.total?.red||0);if(cr>pr)return 'RED_CARD';return null;
}
function payloadFor(f,s,id,signals){
  const order=['h1','goal','gap'],active=order.filter(k=>signals[k]);
  const title=active.length>1?`Football Edge • ${active.length} tín hiệu đạt ngưỡng`:active[0]==='h1'?'Football Edge • H1 WATCH':active[0]==='goal'?'Football Edge • Goal Radar FT':'Football Edge • LIVE GAP';
  const lines=[];
  if(signals.h1)lines.push(`H1 ${signals.h1.value}/100 ≥ ${signals.h1.threshold}`);
  if(signals.goal)lines.push(`FT ${signals.goal.value}/100 (${signals.goal.source}) ≥ ${signals.goal.threshold}`);
  if(signals.gap)lines.push(`GAP ${signals.gap.actual} ≥ ${signals.gap.threshold}`);
  const mode=signals.h1?'H1':signals.goal?'FT':'HC';
  return {title,body:`${f.teams.home.name} – ${f.teams.away.name} | ${s.minute}′ | ${s.score}\n${lines.join(' • ')}`,url:`/?fe_fixture=${id}&fe_mode=${mode}#analysisCard`,tag:`fe-${id}-${active.join('-')}`,created_at:s.stamp};
}

export class BackgroundWatcher extends DeepLinkWatcher{
  async fetch(request){
    const path=new URL(request.url).pathname,method=request.method;
    if(path==='/api/notify/status'&&method==='GET'){
      const r=await super.fetch(request),d=await r.json().catch(()=>({}));
      if(Array.isArray(d?.devices))d.devices=d.devices.map(x=>({...x,prefs:prefs(x?.prefs||{})}));
      return reply(d,r.status);
    }
    if((path==='/api/notify/subscribe'||path==='/api/notify/settings')&&method==='POST'){
      let body={};try{body=await request.clone().json()}catch{}
      const r=await super.fetch(request),rd=await r.clone().json().catch(()=>({}));
      if(r.ok){
        const id=path.endsWith('/subscribe')?rd?.id:body?.id;
        if(id){const d=await this.ctx.storage.get('notify:device:'+id);if(d){d.prefs={...prefs(d.prefs||{}),...prefs(body?.prefs||{})};d.updated=Date.now();await this.ctx.storage.put('notify:device:'+id,d)}}
      }
      return r;
    }
    return super.fetch(request);
  }

  async notifyTick(){
    const control=await this.scanControl();if(!control.enabled)return;
    const rawDevices=await this.devices(),devices=rawDevices.map(d=>({...d,prefs:prefs(d.prefs||{})})).filter(d=>d.prefs.enabled&&(d.prefs.h1||d.prefs.goal||d.prefs.gap));if(!devices.length)return;
    const now=Date.now(),day=new Date(now).toISOString().slice(0,10),budgetMax=Number(this.env.NOTIFY_DAILY_BUDGET)||5000;
    let budget=await this.ctx.storage.get('notify:budget');if(budget?.day!==day)budget={day,used:0};
    const api=async(path,params,strict=true)=>{if(budget.used>=budgetMax)throw Error('NOTIFY_DAILY_BUDGET_REACHED');budget.used++;return this.api(path,params,strict)};
    const status={at:now,apiToday:budget.used,apiLimit:budgetMax,live:0,scanned:0,signalEligible:0,degraded:0,alertsAccepted:0,signalCrossings:0,mechanisms:{h1:0,ft:0,hc:0},errors:[],warnings:[]};
    try{
      const live=(await api('/fixtures',{live:'all'},true)).filter(f=>['1H','2H','LIVE'].includes(f.fixture?.status?.short)&&Number(f.fixture?.status?.elapsed)>=1&&Number(f.fixture?.status?.elapsed)<=90);
      status.live=live.length;
      const all=[...(await this.ctx.storage.list({prefix:'notify:match:'})).values()],byId=new Map(all.map(x=>[x.id,x]));
      const batch=live.sort((a,b)=>(byId.get(a.fixture.id)?.lastAt||0)-(byId.get(b.fixture.id)?.lastAt||0)).slice(0,12);
      const activeIds=new Set(live.map(f=>f.fixture.id));for(const old of all)if(!activeIds.has(old.id)&&now-old.lastAt>3600000)await this.ctx.storage.delete('notify:match:'+old.id);
      const calibrations={};for(const d of devices){const cal={FT:[],legacyFT:[]};for(const key of Object.keys(cal))for(let i=0;i<5;i++)cal[key].push(...(await this.ctx.storage.get(`notify:cal:${d.id}:${key}:${i}`)||[]));calibrations[d.id]=createEngine(cal)}
      const engine=createEngine();
      for(const f of batch){
        const id=f.fixture.id,item=byId.get(id)||{id,history:[],h1History:[],hcHistory:[],oddsHistory:[],alerts:{}};
        item.history=item.history||[];item.h1History=item.h1History||[];item.hcHistory=item.hcHistory||[];item.oddsHistory=item.oddsHistory||[];item.alerts=item.alerts||{};
        try{
          const health={},sourceWarnings=[];
          const read=async(name,path,params)=>{try{const rows=await api(path,params,false);if(!Array.isArray(rows)){health[name]='INVALID';sourceWarnings.push(`${name}:INVALID_RESPONSE`);return []}health[name]=rows.length?'OK':'EMPTY';return rows}catch(e){health[name]='ERROR';sourceWarnings.push(`${name}:${errText(e)}`);return []}};
          const [stats,events,odds,half]=await Promise.all([read('stats','/fixtures/statistics',{fixture:id}),read('events','/fixtures/events',{fixture:id}),read('odds','/odds/live',{fixture:id}),read('half','/fixtures/statistics',{fixture:id,half:true})]);
          if(sourceWarnings.length){status.warnings.push({fixture:id,sources:sourceWarnings.slice(0,4)});if(status.warnings.length>20)status.warnings.shift()}
          if(Date.now()-now>60000)throw Error('FIXTURE_SNAPSHOT_STALE');
          if(!stats.length){item.last={goalMode:null,h1Score:null,gap:null,at:Date.now(),sourceHealth:health,reason:'STATS_UNAVAILABLE'};status.scanned++;status.degraded++}
          else{
            const sm=engine.statMap(stats),presence=engine.watchStatsPresence(sm,f),metric=engine.watchAggregate(sm,f),hcMetrics=engine.handicapAggregate(sm,f);
            const markets=engine.normalizeLiveMarkets(odds,{homeName:f.teams.home.name,awayName:f.teams.away.name}),compact=markets.map(m=>({...m,market:m.bet,status:m.feed_status}));
            const stamp=Date.now(),score=`${f.goals.home}-${f.goals.away}`,red=metric.total.red,prevScore=item.score,prevRed=item.red,prevHalf=item.half;
            const fingerprint=JSON.stringify([f.fixture.status.elapsed,score,metric]);if(item.fingerprint!==fingerprint){item.fingerprint=fingerprint;item.changedAt=stamp}if(stamp-item.changedAt>180000)throw Error('PROVIDER_STATE_NOT_ADVANCING');
            const stateChanged=item.score!=null&&(prevScore!==score||prevRed!==red||prevHalf!==f.fixture.status.short);
            if(stateChanged){item.history=[];item.hcHistory=[];item.oddsHistory=[];item.cooldown=stamp+300000}
            item.half=f.fixture.status.short;item.score=score;item.red=red;
            const marketSnapshot=engine.createLiveOddsSnapshot(id,f,compact),last=item.oddsHistory.at(-1);if(!last||engine.liveSnapshotFingerprint(last)!==engine.liveSnapshotFingerprint(marketSnapshot)||stamp-last.captured_at>=180000)item.oddsHistory.push(marketSnapshot);item.oddsHistory=item.oddsHistory.filter(x=>stamp-x.captured_at<=1800000).slice(-30);
            const historySummary=engine.summarizeLiveOddsHistory(item.oddsHistory),halves=engine.normalizeHalfStatistics(half,stats),coverage=engine.groupCoverageScore('FT',{live_statistics:sm,events:engine.eventsCompact(events),live_odds:compact});
            const s={captured_at:stamp,fresh_at:stamp,minute:f.fixture.status.elapsed,status:f.fixture.status.short,goals:f.goals,metrics:metric,stats_presence:presence,h1:engine.watchAggregate(halves.first_half,f),h2:engine.watchAggregate(halves.second_half,f),market:engine.watchMarketInfo(compact,historySummary),dq:coverage.score,integrity:coverage.integrity_score};
            const slim={captured_at:stamp,minute:s.minute,goals:s.goals,metrics:metric,stats_presence:presence};
            item.history=item.history.filter(x=>stamp-x.captured_at<=1800000).concat(slim).slice(-40);
            const ft={...item,initialDQ:coverage.score,initialIntegrity:coverage.integrity_score,latest:s};ft.eval=engine.watchEvaluate(ft,s);
            const hs={...slim,metrics:hcMetrics},hi={history:item.hcHistory,preBaseline:{adv:0}},w3=engine.hcWindow(hi,hs,3),w5=engine.hcWindow(hi,hs,5),w10=engine.hcWindow(hi,hs,10),gap=engine.hcTeamStates(hi,hs,w3,w5,w10,engine.hcGameRegime(hs,w3,w5)).liveGap;
            item.hcHistory=item.hcHistory.filter(x=>stamp-x.captured_at<=1800000).concat(hs).slice(-40);

            let h1Eval=null;
            const h1Route=['1H','LIVE'].includes(s.status)&&Number(s.minute)>=20&&Number(s.minute)<=45;
            if(h1Route){
              const h1s={...slim,status:s.status,fresh_at:stamp,market:h1MarketInfo(compact,historySummary),dq:coverage.score,integrity:coverage.integrity_score};
              const prev=item.h1History.at(-1),ev=resetType(prev,h1s);
              if(ev){item.h1History=[];item.h1ResetAt=stamp;item.h1CooldownUntil=stamp+(ev==='GOAL'?120000:180000)}
              item.h1History=item.h1History.filter(x=>stamp-x.captured_at<=1800000).concat(slim).slice(-40);
              const h1Item={history:item.h1History,resetAt:item.h1ResetAt||0,initialDQ:coverage.score,initialIntegrity:coverage.integrity_score};
              h1Eval=engine.h1WatchEvaluate(h1Item,h1s);
              if(!item.h1CooldownUntil||stamp>=item.h1CooldownUntil)status.mechanisms.h1++;
            }
            const hcReady=hcMetrics.dataTier==='FULL'&&(w3.usable||w5.usable);if(hcReady)status.mechanisms.hc++;
            if(s.status==='2H')status.mechanisms.ft++;

            for(const d of devices){
              const dp=d.prefs,signals={};
              if(dp.h1&&h1Eval&&(!item.h1CooldownUntil||stamp>=item.h1CooldownUntil)){
                const candidate=h1Gate(h1Eval,dp.h1Threshold)?Number(h1Eval.score):null,check=crossing(item.alerts[d.id+':h1'],candidate,dp.h1Threshold,stamp);item.alerts[d.id+':h1']=check.state;if(check.send)signals.h1={value:candidate,threshold:dp.h1Threshold};
              }
              if(dp.goal){
                const goal=s.status==='2H'?calibrations[d.id].grEstimate(ft,'FT'):null,candidate=presence.core&&(!item.cooldown||stamp>=item.cooldown)?goal?.prob:null,check=crossing(item.alerts[d.id+':goal'],candidate,dp.goalThreshold,stamp);item.alerts[d.id+':goal']=check.state;if(check.send)signals.goal={value:candidate,threshold:dp.goalThreshold,source:goal?.source||'MODEL'};
              }
              if(dp.gap){
                const candidate=presence.core&&(!item.cooldown||stamp>=item.cooldown)&&hcReady?Math.abs(gap):null,check=crossing(item.alerts[d.id+':gap'],candidate,dp.gapThreshold,stamp);item.alerts[d.id+':gap']=check.state;if(check.send)signals.gap={value:candidate,threshold:dp.gapThreshold,actual:`${gap>0?'+':''}${gap} • ${gap>0?f.teams.home.name:f.teams.away.name}`};
              }
              const kinds=Object.keys(signals);if(kinds.length){status.signalCrossings+=kinds.length;const packet=payloadFor(f,{minute:s.minute,score,stamp},id,signals);if(await this.send(d,packet)){for(const kind of kinds)item.alerts[d.id+':'+kind]={armed:false,lastSent:stamp};status.alertsAccepted++}}
            }
            status.signalEligible+=Number(!!h1Eval)+Number(s.status==='2H')+Number(hcReady);
            if(!presence.core)status.degraded++;
            item.last={goalMode:ft.eval.scoreMode,h1Score:h1Eval?.score??null,h1Mode:h1Eval?.scoreMode??null,gap,at:stamp,sourceHealth:health};status.scanned++;
          }
        }catch(e){status.errors.push({fixture:id,error:errText(e)})}
        item.lastAt=Date.now();const bytes=()=>new TextEncoder().encode(JSON.stringify(item)).byteLength;
        while(item.oddsHistory.length>2&&bytes()>100000)item.oddsHistory.shift();while(item.history.length>2&&bytes()>100000){item.history.shift();if(item.h1History.length>2)item.h1History.shift();if(item.hcHistory.length>2)item.hcHistory.shift()}
        await this.ctx.storage.put('notify:match:'+id,item);
      }
      status.rotationEstimateSeconds=Math.ceil(live.length/12)*30;
    }catch(e){status.errors.push({error:errText(e)})}
    status.apiToday=budget.used;await this.ctx.storage.put({'notify:status':status,'notify:budget':budget});
  }
}

export default base;
