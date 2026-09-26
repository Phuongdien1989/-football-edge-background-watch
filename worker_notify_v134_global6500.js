import base,{BackgroundWatcher as AdaptiveWatcher} from './worker_notify_v133_quota6500.js';

// Q6500 GLOBAL ENVELOPE
// One hard/paced API-Football gate for ALL background-worker traffic:
// Smart Follow, Evidence, Push Validation and H1/FT/HC notification scan.
// No scoring, threshold, signal or D1 schema changes.
const GLOBAL_KEY='api:q6500:background:v1';
const DAY_MS=86400000;
const DEFAULT_BACKGROUND_BUDGET=5000;
const DEFAULT_TOTAL_TARGET=6500;
const DEFAULT_FOREGROUND_RESERVE=1000;
const DEFAULT_SAFETY_RESERVE=500;
const DEFAULT_VALIDATION_BUDGET=500;
const BUCKET_CAP=20;
const INITIAL_TOKENS=12;
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*',
  'access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'
}});
function mode(used,limit){const r=limit>0?used/limit:1;if(r>=1)return 'STOP';if(r>=.92)return 'CRITICAL';if(r>=.80)return 'TIGHT';if(r>=.60)return 'CONSERVE';return 'NORMAL'}
function cadence(m){if(m==='STOP')return 300000;if(m==='CRITICAL')return 120000;if(m==='TIGHT')return 90000;if(m==='CONSERVE')return 75000;return 60000}
function errText(e){return String(e?.message||e||'UNKNOWN')}

export class BackgroundWatcher extends AdaptiveWatcher{
  q6500Cfg(){
    const background=Math.max(1000,Number(this.env.BACKGROUND_DAILY_BUDGET)||DEFAULT_BACKGROUND_BUDGET);
    const total=Math.max(background,Number(this.env.API_TOTAL_DAILY_BUDGET)||DEFAULT_TOTAL_TARGET);
    const foreground=Math.max(0,Number(this.env.API_FOREGROUND_RESERVE)||DEFAULT_FOREGROUND_RESERVE);
    const safety=Math.max(0,Number(this.env.API_SAFETY_RESERVE)||DEFAULT_SAFETY_RESERVE);
    const validation=Math.max(1,Number(this.env.VALIDATION_DAILY_BUDGET)||DEFAULT_VALIDATION_BUDGET);
    return {background,total,foreground,safety,validation};
  }
  async loadGlobal(now=Date.now()){
    const cfg=this.q6500Cfg(),day=new Date(now).toISOString().slice(0,10);
    let q=await this.ctx.storage.get(GLOBAL_KEY);
    if(!q||q.day!==day){
      const [nb,vb]=await Promise.all([
        this.ctx.storage.get('notify:budget'),
        this.ctx.storage.get('notify:validation-budget')
      ]);
      const notifyUsed=nb?.day===day?Math.max(0,Number(nb.used||0)):0;
      const validationUsed=vb?.day===day?Math.max(0,Number(vb.used||0)):0;
      q={day,used:Math.min(cfg.background,notifyUsed+validationUsed),pools:{notify:notifyUsed,validation:validationUsed,base:0},tokens:INITIAL_TOKENS,lastRefill:now};
    }
    q.pools=q.pools&&typeof q.pools==='object'?q.pools:{notify:0,validation:0,base:0};
    const last=Number(q.lastRefill||now),elapsed=Math.max(0,Math.min(DAY_MS,now-last));
    const d=new Date(now),resetAt=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1);
    const timeLeft=Math.max(60000,resetAt-now),remaining=Math.max(0,cfg.background-Math.max(0,Number(q.used)||0));
    const rate=remaining/timeLeft;
    q.tokens=Math.min(BUCKET_CAP,Math.max(0,Number(q.tokens)||0)+elapsed*rate);
    q.lastRefill=now;q.refillRatePerMinute=rate*60000;q.resetAt=resetAt;
    return q;
  }
  async reserveApi(pool='base'){
    const task=(this._q6500Chain||Promise.resolve()).then(async()=>{
      const cfg=this.q6500Cfg(),q=await this.loadGlobal(Date.now());
      if(Number(q.used||0)>=cfg.background)throw new Error('BACKGROUND_DAILY_BUDGET_REACHED');
      if(Number(q.tokens||0)<1)throw new Error('BACKGROUND_QUOTA_PACED');
      q.tokens=Math.max(0,Number(q.tokens||0)-1);q.used=Number(q.used||0)+1;
      const p=pool==='notify'||pool==='validation'?pool:'base';q.pools[p]=Number(q.pools[p]||0)+1;
      await this.ctx.storage.put(GLOBAL_KEY,q);
      return q;
    });
    this._q6500Chain=task.catch(()=>{});
    return task;
  }
  async api(path,params={},strict=false,pool='base'){
    await this.reserveApi(pool);
    return super.api(path,params,strict);
  }
  async validationApi(path,params={}){
    const cfg=this.q6500Cfg(),day=new Date().toISOString().slice(0,10);
    let b=await this.ctx.storage.get('notify:validation-budget');if(b?.day!==day)b={day,used:0};
    if(Number(b.used||0)>=cfg.validation)throw new Error('VALIDATION_DAILY_BUDGET_REACHED');
    try{
      const out=await this.api(path,params,false,'validation');
      b.used=Number(b.used||0)+1;await this.ctx.storage.put('notify:validation-budget',b);return out;
    }catch(e){
      if(!/BACKGROUND_(?:DAILY_BUDGET_REACHED|QUOTA_PACED)/.test(errText(e))){b.used=Number(b.used||0)+1;await this.ctx.storage.put('notify:validation-budget',b)}
      throw e;
    }
  }
  async quotaStatus(){
    const cfg=this.q6500Cfg(),q=await this.loadGlobal(Date.now());
    return {schema:'FE_API_QUOTA_6500_GLOBAL_V1',day:q.day,total_target:cfg.total,
      background_budget:cfg.background,foreground_reserve:cfg.foreground,safety_reserve:cfg.safety,
      validation_budget:cfg.validation,background_used:Number(q.used||0),background_remaining:Math.max(0,cfg.background-Number(q.used||0)),
      by_pool:q.pools||{},mode:mode(Number(q.used||0),cfg.background),tokens:Math.round(Number(q.tokens||0)*100)/100,
      refill_per_minute:Math.round(Number(q.refillRatePerMinute||0)*100)/100,reset_at:q.resetAt||null,
      next_cadence_ms:cadence(mode(Number(q.used||0),cfg.background))};
  }
  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==='/api/notify/quota-status'&&request.method==='GET')return reply({ok:true,quota:await this.quotaStatus()});
    return super.fetch(request);
  }
  async notifyTick(){
    await super.notifyTick();
    try{
      const q=await this.quotaStatus(),st=await this.ctx.storage.get('notify:status');
      if(st){
        const patched={...st,
          notifyApiToday:Number(st.apiToday||0),notifyApiLimit:Number(st.apiLimit||0),
          apiToday:q.background_used,apiLimit:q.background_budget,
          quotaMode:q.mode,quotaTokens:q.tokens,quotaPools:q.by_pool,
          quotaEnvelope:{total:q.total_target,background:q.background_budget,foregroundReserve:q.foreground_reserve,safetyReserve:q.safety_reserve,validation:q.validation_budget},
          quotaGlobal:true};
        await this.ctx.storage.put('notify:status',patched);
      }
    }catch(e){console.log('Q6500 telemetry patch failed',errText(e).slice(0,140))}
  }
}

export default base;
