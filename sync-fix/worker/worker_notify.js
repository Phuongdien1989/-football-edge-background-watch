import base,{BackgroundWatcher as ExistingWatcher} from './worker_v124.js';
import {createEngine} from './notify-core.js';
import {generateVAPIDKeys,generateRequestDetails} from './notify-transport.js';
const APP='https://ancient-butterfly-f4b0.ngophuonghuy.workers.dev';
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'}});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)));
export function preferences(p={}){return {enabled:p.enabled!==false,goal:p.goal!==false,gap:p.gap!==false,goalThreshold:Number.isFinite(Number(p.goalThreshold))?clamp(p.goalThreshold,1,100):70,gapThreshold:Number.isFinite(Number(p.gapThreshold))?clamp(p.gapThreshold,1,100):70}}
export function validSubscription(s){
  try{const u=new URL(s.endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
    (u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com')||u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com')&&
    /^[A-Za-z0-9_-]{86,90}$/.test(s.keys?.p256dh||'')&&/^[A-Za-z0-9_-]{20,24}$/.test(s.keys?.auth||'')}catch{return false}
}
export function crossing(previous,value,threshold,now){
  const r={armed:true,lastSent:0,...previous};if(value==null||!Number.isFinite(value))return {state:r,send:false};
  if(value<threshold-5)r.armed=true;
  return {state:r,send:!!r.armed&&value>=threshold&&now-r.lastSent>=300000};
}
async function deviceId(endpoint){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(endpoint)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
export class BackgroundWatcher extends ExistingWatcher{
  notifyWork(fn){const p=(this.notifyChain||Promise.resolve()).then(fn);this.notifyChain=p.catch(()=>{});return p}
  async devices(){return [...(await this.ctx.storage.list({prefix:'notify:device:'})).values()]}
  async keys(){let keys=await this.ctx.storage.get('notify:vapid');if(!keys){keys=generateVAPIDKeys();await this.ctx.storage.put('notify:vapid',keys)}return keys}
  async send(device,payload){
    const keys=await this.keys();
    const req=generateRequestDetails(device.subscription,JSON.stringify(payload),{TTL:120,urgency:'high',vapidDetails:{subject:APP,publicKey:keys.publicKey,privateKey:keys.privateKey}});
    const response=await fetch(req.endpoint,{method:'POST',headers:req.headers,body:req.body,redirect:'manual',signal:AbortSignal.timeout(12000)});
    if([404,410].includes(response.status)){await this.ctx.storage.delete('notify:device:'+device.id);return false}
    if(!response.ok)throw new Error('PUSH_HTTP_'+response.status);
    return true; // Push service accepted; device display still requires an on-device test.
  }
  async fetch(request){
    const path=new URL(request.url).pathname;if(!path.startsWith('/api/notify/'))return super.fetch(request);
    return this.notifyWork(async()=>{
      try{
        if(path==='/api/notify/key'&&request.method==='GET')return reply({ok:true,publicKey:(await this.keys()).publicKey});
        if(path==='/api/notify/status'&&request.method==='GET'){
          const devices=await this.devices(),st=await this.ctx.storage.get('notify:status');
          return reply({ok:true,devices:devices.map(d=>({id:d.id,prefs:d.prefs,updated:d.updated})),scan:st||null});
        }
        if(request.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405);
        const raw=await request.text();if(raw.length>2000000)return reply({error:'REQUEST_TOO_LARGE'},413);
        const b=JSON.parse(raw||'{}');
        if(path==='/api/notify/subscribe'){
          if(!this.env.APISPORTS_KEY)return reply({error:'APISPORTS_NOT_CONFIGURED'},503);
          if(!validSubscription(b.subscription))return reply({error:'INVALID_PUSH_SUBSCRIPTION'},400);
          const id=await deviceId(b.subscription.endpoint),devices=await this.devices();
          if(devices.length>=10&&!devices.some(d=>d.id===id))return reply({error:'DEVICE_LIMIT_10'},409);
          const cal={FT:[],legacyFT:[]};
          for(const key of Object.keys(cal))cal[key]=(Array.isArray(b.calibration?.[key])?b.calibration[key]:[]).slice(-5000).map(r=>({score:r.score,minute:r.minute,level:r.level,tier:r.tier,goal_ft:r.goal_ft}));
          for(const key of Object.keys(cal))for(let i=0;i<5;i++)await this.ctx.storage.put(`notify:cal:${id}:${key}:${i}`,cal[key].slice(i*1000,(i+1)*1000));
          await this.ctx.storage.put('notify:device:'+id,{id,subscription:b.subscription,prefs:preferences(b.prefs),updated:Date.now()});
          await this.ctx.storage.setAlarm(Date.now()+10000);return reply({ok:true,id});
        }
        if(!/^[a-f0-9]{64}$/.test(b.id||''))return reply({error:'DEVICE_REQUIRED'},400);
        const d=await this.ctx.storage.get('notify:device:'+b.id);if(!d)return reply({error:'DEVICE_NOT_FOUND'},404);
        if(path==='/api/notify/unsubscribe'){
          await this.ctx.storage.delete('notify:device:'+b.id);
          for(const key of ['FT','legacyFT'])for(let i=0;i<5;i++)await this.ctx.storage.delete(`notify:cal:${b.id}:${key}:${i}`);
          return reply({ok:true});
        }
        if(path==='/api/notify/settings'){d.prefs=preferences(b.prefs);d.updated=Date.now();await this.ctx.storage.put('notify:device:'+d.id,d);if(d.prefs.enabled)await this.ctx.storage.setAlarm(Date.now()+10000);return reply({ok:true})}
        if(path==='/api/notify/test')return reply({ok:await this.send(d,{title:'Football Edge • Thông báo thử',body:'Điện thoại đã nhận được thông báo Football Edge.',url:APP+'/#connectCard',tag:'fe-test',created_at:Date.now()})});
        return reply({error:'NOT_FOUND'},404);
      }catch(e){return reply({error:String(e.message||e).slice(0,160)},500)}
    });
  }
  async notifyTick(){
    const devices=(await this.devices()).filter(d=>d.prefs.enabled&&(d.prefs.goal||d.prefs.gap));if(!devices.length)return;
    const now=Date.now(),day=new Date(now).toISOString().slice(0,10),budgetMax=Number(this.env.NOTIFY_DAILY_BUDGET)||5000;
    let budget=await this.ctx.storage.get('notify:budget');if(budget?.day!==day)budget={day,used:0};
    const api=async(path,params)=>{if(budget.used>=budgetMax)throw Error('NOTIFY_DAILY_BUDGET_REACHED');budget.used++;return this.api(path,params,true)};
    let status={at:now,apiToday:budget.used,apiLimit:budgetMax,live:0,scanned:0,alertsAccepted:0,errors:[]};
    try{
      const live=(await api('/fixtures',{live:'all'})).filter(f=>['1H','2H','LIVE'].includes(f.fixture?.status?.short)&&Number(f.fixture?.status?.elapsed)>=1&&Number(f.fixture?.status?.elapsed)<=90);
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
          const [stats,events,odds,half]=await Promise.all([
            api('/fixtures/statistics',{fixture:id}),api('/fixtures/events',{fixture:id}),api('/odds/live',{fixture:id}),api('/fixtures/statistics',{fixture:id,half:true})
          ]);
          if(Date.now()-now>60000)throw Error('FIXTURE_SNAPSHOT_STALE');
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
          }
          item.last={goalMode:ft.eval.scoreMode,gap,at:stamp};status.scanned++;
        }catch(e){status.errors.push({fixture:id,error:String(e.message||e).slice(0,120)})}
        item.lastAt=Date.now();
        // Keep one fixture comfortably below Durable Object's per-value limit.
        const bytes=()=>new TextEncoder().encode(JSON.stringify(item)).byteLength;
        while(item.oddsHistory.length>2&&bytes()>100000)item.oddsHistory.shift();
        while(item.history.length>2&&bytes()>100000){item.history.shift();if(item.hcHistory.length>2)item.hcHistory.shift()}
        await this.ctx.storage.put('notify:match:'+id,item);
      }
      status.rotationEstimateSeconds=Math.ceil(live.length/12)*30;
    }catch(e){status.errors.push({error:String(e.message||e).slice(0,120)})}
    status.apiToday=budget.used;await this.ctx.storage.put({'notify:status':status,'notify:budget':budget});
  }
  async alarm(){
    const results=await Promise.allSettled([super.alarm(),this.notifyWork(()=>this.notifyTick())]);
    for(const r of results)if(r.status==='rejected')console.log('Background task failed',String(r.reason?.message||r.reason));
    if((await this.devices()).some(d=>d.prefs.enabled&&(d.prefs.goal||d.prefs.gap)))await this.ctx.storage.setAlarm(Date.now()+30000);
  }
}
export default base;
