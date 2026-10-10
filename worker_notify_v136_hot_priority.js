import base,{BackgroundWatcher as FullPauseWatcher} from './worker_notify_v135_full_pause.js';

// P1.2 HOT PRIORITY SCHEDULER
// Additive scheduling only. H1 / FT / HC engines, thresholds, crossing semantics,
// Push payloads, validation and D1 behavior remain inherited and unchanged.
// Goal: reduce notification detection delay without starving normal LIVE rotation.
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*',
  'access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'
}});
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,num(n,a)));
const fresh=(ts,now,ms=180000)=>num(ts)>0&&now-num(ts)<=ms;

export class BackgroundWatcher extends FullPauseWatcher{
  schedulerCfg(){
    return {
      hotMs:clamp(this.env.NOTIFY_HOT_INTERVAL_MS||20000,15000,30000),
      normalMs:clamp(this.env.NOTIFY_NORMAL_INTERVAL_MS||30000,20000,60000),
      hotSlots:clamp(this.env.NOTIFY_HOT_SLOTS||6,1,8),
      gapMargin:clamp(this.env.NOTIFY_HOT_GAP_MARGIN||10,3,20),
      h1Margin:clamp(this.env.NOTIFY_HOT_H1_MARGIN||8,3,20)
    };
  }

  async hotPriorityCandidates(){
    const now=Date.now(),cfg=this.schedulerCfg();
    const devices=(await this.devices()).filter(d=>d?.prefs?.enabled&&(d?.prefs?.h1||d?.prefs?.goal||d?.prefs?.gap));
    if(!devices.length)return {rows:[],cfg};
    const h1Threshold=Math.min(...devices.filter(d=>d.prefs?.h1).map(d=>num(d.prefs.h1Threshold,72)),72);
    const gapThreshold=Math.min(...devices.filter(d=>d.prefs?.gap).map(d=>num(d.prefs.gapThreshold,70)),70);
    const focusRows=[...(await this.ctx.storage.list({prefix:'watch:'})).values()];
    const focusIds=new Set(focusRows.filter(w=>w?.level==='focus'&&!w?.ended&&num(w?.expires_at,now+1)>now).map(w=>Number(w.fixture_id)));
    const items=[...(await this.ctx.storage.list({prefix:'notify:match:'})).values()];
    const rows=[];
    for(const item of items){
      if(!item?.id)continue;
      const last=item.last||{},lastFresh=fresh(last.at,now),gap=Math.abs(num(last.gap,0)),h1=num(last.h1Score,-999),half=String(item.half||''),goalMode=String(last.goalMode||'');
      let score=0,reason=[];
      if(focusIds.has(Number(item.id))){score+=2000;reason.push('FOCUS')}
      if(lastFresh&&gap>=Math.max(0,gapThreshold-cfg.gapMargin)){score+=1000+gap;reason.push('GAP_NEAR')}
      if(lastFresh&&h1>=Math.max(0,h1Threshold-cfg.h1Margin)&&['1H','LIVE'].includes(half)){score+=900+h1;reason.push('H1_NEAR')}
      if(lastFresh&&half==='2H'&&goalMode==='FULL'){
        const minute=num(item.history?.at?.(-1)?.minute,0);score+=400+minute;reason.push('FT_FULL')
      }
      if(score>0)rows.push({id:Number(item.id),score,reason:reason.join('+'),lastAt:num(item.lastAt,0),lastSignalAt:num(last.at,0)});
    }
    rows.sort((a,b)=>b.score-a.score||a.lastAt-b.lastAt);
    return {rows:rows.slice(0,cfg.hotSlots),cfg,totalHot:rows.length};
  }

  async applyHotPriority(){
    const now=Date.now(),hot=await this.hotPriorityCandidates();
    for(const h of hot.rows){
      const key='notify:match:'+h.id,item=await this.ctx.storage.get(key);if(!item)continue;
      // v130 sorts by lastAt ascending. Boost only a bounded number of HOT rows so
      // at least 12-hotSlots positions remain available to normal oldest-first rotation.
      // Persist a boost only when it is absent or stale. Rewriting every HOT
      // fixture on every 20s tick exhausts Durable Object Free write quota.
      const previousBoost=num(item.scheduler?.boosted_at,0);
      if(item.scheduler?.hot&&item.scheduler?.reason===h.reason&&now-previousBoost<120000)continue;
      item.lastAt=Math.min(num(item.lastAt,now),now-86400000-h.score);
      item.scheduler={hot:true,reason:h.reason,boosted_at:now};
      await this.ctx.storage.put(key,item);
    }
    const status={
      at:now,mode:hot.rows.length?'HOT':'NORMAL',hot_selected:hot.rows.length,hot_total:hot.totalHot||0,
      hot_ids:hot.rows.map(x=>x.id),hot_reasons:hot.rows.map(x=>({fixture_id:x.id,reason:x.reason})),
      hot_interval_ms:hot.cfg.hotMs,normal_interval_ms:hot.cfg.normalMs,hot_slots:hot.cfg.hotSlots
    };
    const previous=await this.ctx.storage.get('notify:scheduler-status');
    // Status is observational, not an engine input. Throttle its persistence.
    if(!previous||now-num(previous.at,0)>=120000)await this.ctx.storage.put('notify:scheduler-status',status);
    return hot;
  }

  async send(device,payload){
    const detectedAt=num(payload?.created_at,Date.now()),fixtureId=num(payload?.fixture_id,0);
    const prev=fixtureId?await this.ctx.storage.get('notify:match:'+fixtureId):null;
    const previousDeepAt=num(prev?.last?.at||prev?.lastAt,0),sendStartedAt=Date.now();
    const ok=await super.send(device,payload),acceptedAt=Date.now();
    if(ok){
      const row={
        at:acceptedAt,fixture_id:fixtureId,fe_mode:String(payload?.fe_mode||''),signals:payload?.signals||null,
        detected_at:detectedAt,push_started_at:sendStartedAt,push_accepted_at:acceptedAt,
        push_transport_ms:acceptedAt-sendStartedAt,
        previous_deep_scan_at:previousDeepAt||null,
        detection_window_upper_ms:previousDeepAt?Math.max(0,detectedAt-previousDeepAt):null
      };
      const hist=await this.ctx.storage.get('notify:latency-history')||[];hist.push(row);
      await this.ctx.storage.put({'notify:latency-last':row,'notify:latency-history':hist.slice(-100)});
    }
    return ok;
  }

  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==='/api/notify/latency'&&request.method==='GET'){
      const last=await this.ctx.storage.get('notify:latency-last')||null,hist=await this.ctx.storage.get('notify:latency-history')||[],scheduler=await this.ctx.storage.get('notify:scheduler-status')||null;
      return reply({ok:true,schema:'FE_NOTIFY_LATENCY_V1',scheduler,last,history:hist.slice(-50)});
    }
    if(url.pathname==='/api/notify/status'&&request.method==='GET'){
      const r=await super.fetch(request),d=await r.json().catch(()=>({})),scheduler=await this.ctx.storage.get('notify:scheduler-status')||null,last=await this.ctx.storage.get('notify:latency-last')||null;
      return reply({...d,priority_scheduler:scheduler,push_latency:last},r.status);
    }
    return super.fetch(request);
  }

  async alarm(){
    const control=typeof this.scanControl==='function'?await this.scanControl():{enabled:true};
    if(control?.enabled===false)return super.alarm();
    let hot={rows:[],cfg:this.schedulerCfg()};
    try{hot=await this.applyHotPriority()}catch(e){console.log('HOT priority preflight failed',String(e?.message||e).slice(0,160))}
    const started=Date.now();
    await super.alarm();
    try{
      const after=typeof this.scanControl==='function'?await this.scanControl():{enabled:true};
      if(after?.enabled===false)return;
      const devices=(await this.devices()).filter(d=>d?.prefs?.enabled&&(d?.prefs?.h1||d?.prefs?.goal||d?.prefs?.gap));
      if(devices.length){
        const interval=hot.rows.length?hot.cfg.hotMs:hot.cfg.normalMs;
        await this.ctx.storage.setAlarm(Math.max(Date.now()+1000,started+interval));
      }
    }catch(e){console.log('HOT cadence reschedule failed',String(e?.message||e).slice(0,160))}
  }
}

export default base;
