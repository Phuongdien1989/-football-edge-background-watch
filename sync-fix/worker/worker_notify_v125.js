import base,{BackgroundWatcher as NotifyWatcher,crossing} from './worker_notify.js';
import {createEngine} from './notify-core.js';

// P0.3: notification scan resilience only.
// Stable scoring/threshold engines are inherited unchanged from worker_notify.js / notify-core.js.
const APP='https://ancient-butterfly-f4b0.ngophuonghuy.workers.dev';
const errText=e=>String(e?.message||e||'UNKNOWN').slice(0,120);

export class BackgroundWatcher extends NotifyWatcher{
  async notifyTick(){
    const devices=(await this.devices()).filter(d=>d.prefs.enabled&&(d.prefs.goal||d.prefs.gap));if(!devices.length)return;
    const now=Date.now(),day=new Date(now).toISOString().slice(0,10),budgetMax=Number(this.env.NOTIFY_DAILY_BUDGET)||5000;
    let budget=await this.ctx.storage.get('notify:budget');if(budget?.day!==day)budget={day,used:0};
    const api=async(path,params,strict=true)=>{if(budget.used>=budgetMax)throw Error('NOTIFY_DAILY_BUDGET_REACHED');budget.used++;return this.api(path,params,strict)};
    let status={at:now,apiToday:budget.used,apiLimit:budgetMax,live:0,scanned:0,signalEligible:0,degraded:0,alertsAccepted:0,errors:[],warnings:[]};
    try{
      // Discovery remains strict. If the live fixture catalog itself is invalid, do not invent a scan.
      const live=(await api('/fixtures',{live:'all'},true)).filter(f=>['1H','2H','LIVE'].includes(f.fixture?.status?.short)&&Number(f.fixture?.status?.elapsed)>=1&&Number(f.fixture?.status?.elapsed)<=90);
      status.live=live.length;
      const all=[...(await this.ctx.storage.list({prefix:'notify:match:'})).values()],byId=new Map(all.map(x=>[x.id,x]));
      const batch=live.sort((a,b)=>(byId.get(a.fixture.id)?.lastAt||0)-(byId.get(b.fixture.id)?.lastAt||0)).slice(0,12);
      const activeIds=new Set(live.map(f=>f.fixture.id));for(const old of all)if(!activeIds.has(old.id)&&now-old.lastAt>3600000)await this.ctx.storage.delete('notify:match:'+old.id);
      const calibrations={};for(const d of devices){const cal={FT:[],legacyFT:[]};for(const key of Object.keys(cal))for(let i=0;i<5;i++)cal[key].push(...(await this.ctx.storage.get(`notify:cal:${d.id}:${key}:${i}`)||[]));calibrations[d.id]=createEngine(cal)}
      const engine=createEngine();

      // Each batch is bounded; every live fixture participates in oldest-first rotation.
      for(const f of batch){
        const id=f.fixture.id,item=byId.get(id)||{id,history:[],hcHistory:[],oddsHistory:[],alerts:{}};
        try{
          // Detail/evidence sources are tolerant by design: one provider/source error must not kill the fixture loop.
          const health={},sourceWarnings=[];
          const read=async(name,path,params)=>{
            try{
              const rows=await api(path,params,false);
              if(!Array.isArray(rows)){health[name]='INVALID';sourceWarnings.push(`${name}:INVALID_RESPONSE`);return []}
              health[name]=rows.length?'OK':'EMPTY';return rows;
            }catch(e){health[name]='ERROR';sourceWarnings.push(`${name}:${errText(e)}`);return []}
          };
          const [stats,events,odds,half]=await Promise.all([
            read('stats','/fixtures/statistics',{fixture:id}),
            read('events','/fixtures/events',{fixture:id}),
            read('odds','/odds/live',{fixture:id}),
            read('half','/fixtures/statistics',{fixture:id,half:true})
          ]);
          if(sourceWarnings.length){status.warnings.push({fixture:id,sources:sourceWarnings.slice(0,4)});if(status.warnings.length>20)status.warnings.shift()}
          if(Date.now()-now>60000)throw Error('FIXTURE_SNAPSHOT_STALE');

          // Statistics are the minimum input for Goal/GAP. Mark degraded instead of failing the whole round.
          if(!stats.length){
            item.last={goalMode:null,gap:null,at:Date.now(),sourceHealth:health,reason:'STATS_UNAVAILABLE'};
            status.scanned++;status.degraded++;
          }else{
            const sm=engine.statMap(stats),presence=engine.watchStatsPresence(sm,f),metric=engine.watchAggregate(sm,f),hcMetrics=engine.handicapAggregate(sm,f);
            const markets=engine.normalizeLiveMarkets(odds,{homeName:f.teams.home.name,awayName:f.teams.away.name});
            const compact=markets.map(m=>({...m,market:m.bet,status:m.feed_status}));
            const stamp=Date.now(),score=`${f.goals.home}-${f.goals.away}`,red=metric.total.red;
            const fingerprint=JSON.stringify([f.fixture.status.elapsed,score,metric]);
            if(item.fingerprint!==fingerprint){item.fingerprint=fingerprint;item.changedAt=stamp}
            if(stamp-item.changedAt>180000)throw Error('PROVIDER_STATE_NOT_ADVANCING');
            if(item.score!=null&&(item.score!==score||item.red!==red||item.half!==f.fixture.status.short)){item.history=[];item.hcHistory=[];item.oddsHistory=[];item.cooldown=stamp+300000}
            item.half=f.fixture.status.short;
            item.score=score;item.red=red;
            const marketSnapshot=engine.createLiveOddsSnapshot(id,f,compact),last=item.oddsHistory.at(-1);
            if(!last||engine.liveSnapshotFingerprint(last)!==engine.liveSnapshotFingerprint(marketSnapshot)||stamp-last.captured_at>=180000)item.oddsHistory.push(marketSnapshot);
            item.oddsHistory=item.oddsHistory.filter(x=>stamp-x.captured_at<=1800000).slice(-30);
            const halves=engine.normalizeHalfStatistics(half,stats),coverage=engine.groupCoverageScore('FT',{live_statistics:sm,events:engine.eventsCompact(events),live_odds:compact});
            const s={captured_at:stamp,fresh_at:stamp,minute:f.fixture.status.elapsed,status:f.fixture.status.short,goals:f.goals,metrics:metric,stats_presence:presence,
              h1:engine.watchAggregate(halves.first_half,f),h2:engine.watchAggregate(halves.second_half,f),market:engine.watchMarketInfo(compact,engine.summarizeLiveOddsHistory(item.oddsHistory)),dq:coverage.score,integrity:coverage.integrity_score};
            const slim={captured_at:stamp,minute:s.minute,goals:s.goals,metrics:metric,stats_presence:presence};
            item.history=item.history.filter(x=>stamp-x.captured_at<=1800000).concat(slim).slice(-40);
            const ft={...item,initialDQ:coverage.score,initialIntegrity:coverage.integrity_score,latest:s};ft.eval=engine.watchEvaluate(ft,s);
            const hs={...slim,metrics:hcMetrics},hi={history:item.hcHistory,preBaseline:{adv:0}};
            const w3=engine.hcWindow(hi,hs,3),w5=engine.hcWindow(hi,hs,5),w10=engine.hcWindow(hi,hs,10);
            const gap=engine.hcTeamStates(hi,hs,w3,w5,w10,engine.hcGameRegime(hs,w3,w5)).liveGap;
            item.hcHistory=item.hcHistory.filter(x=>stamp-x.captured_at<=1800000).concat(hs).slice(-40);
            if(presence.core&&(!item.cooldown||stamp>=item.cooldown)){
              status.signalEligible++;
              for(const d of devices){
                const goal=s.status==='2H'?calibrations[d.id].grEstimate(ft,'FT'):null;
                const values={goal:d.prefs.goal?goal?.prob:null,gap:d.prefs.gap&&hcMetrics.dataTier==='FULL'&&(w3.usable||w5.usable)?Math.abs(gap):null};
                for(const kind of ['goal','gap']){
                  const key=d.id+':'+kind,threshold=d.prefs[kind+'Threshold'],check=crossing(item.alerts[key],values[kind],threshold,stamp);item.alerts[key]=check.state;
                  if(!check.send)continue;
                  const actual=kind==='goal'?`${goal.prob}/100 (${goal.source})`:`${gap>0?'+':''}${gap} • ${gap>0?f.teams.home.name:f.teams.away.name}`;
                  const payload={title:kind==='goal'?'Football Edge • Goal Radar FT':'Football Edge • LIVE GAP',body:`${f.teams.home.name} – ${f.teams.away.name} | ${s.minute}′ | ${score}\n${actual} • Đạt ngưỡng ${threshold}`,url:`${APP}/?fe_fixture=${id}&fe_mode=${kind==='goal'?'FT':'HC'}#analysisCard`,tag:`fe-${id}-${kind}`,created_at:stamp};
                  if(await this.send(d,payload)){item.alerts[key]={armed:false,lastSent:stamp};status.alertsAccepted++}
                }
              }
            }else status.degraded++;
            item.last={goalMode:ft.eval.scoreMode,gap,at:stamp,sourceHealth:health};status.scanned++;
          }
        }catch(e){status.errors.push({fixture:id,error:errText(e)})}
        item.lastAt=Date.now();
        // Keep one fixture comfortably below Durable Object's per-value limit.
        const bytes=()=>new TextEncoder().encode(JSON.stringify(item)).byteLength;
        while(item.oddsHistory.length>2&&bytes()>100000)item.oddsHistory.shift();
        while(item.history.length>2&&bytes()>100000){item.history.shift();if(item.hcHistory.length>2)item.hcHistory.shift()}
        await this.ctx.storage.put('notify:match:'+id,item);
      }
      status.rotationEstimateSeconds=Math.ceil(live.length/12)*30;
    }catch(e){status.errors.push({error:errText(e)})}
    status.apiToday=budget.used;await this.ctx.storage.put({'notify:status':status,'notify:budget':budget});
  }
}

export default base;
