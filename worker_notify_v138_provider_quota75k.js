import base,{BackgroundWatcher as HotPriorityWatcher} from './worker_notify_v136_hot_priority.js';

// Prediction V2 / B2 candidate — PROVIDER-AWARE 75K QUOTA.
// NOT PRODUCTION DEPLOYED.
// No H1 / FT / HC / Goal Radar / Push / D1 scoring semantics are changed here.

const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*',
  'access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'
}});
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const dayKey=()=>new Date().toISOString().slice(0,10);

export class BackgroundWatcher extends HotPriorityWatcher{
  quotaCfg(){
    return {
      configuredTotal:Math.max(1000,n(this.env.API_TOTAL_DAILY_BUDGET,75000)),
      providerReserve:Math.max(0,n(this.env.API_PROVIDER_RESERVE_CALLS,60)),
      providerFreshMs:Math.max(30000,n(this.env.API_PROVIDER_STATE_FRESH_MS,5*60*1000)),
      rateBackoffMs:Math.max(5000,n(this.env.API_RATE_BACKOFF_MS,30000))
    };
  }
  quotaWork(fn){const p=(this._q75kChain||Promise.resolve()).then(fn);this._q75kChain=p.catch(()=>{});return p}
  async quotaRecord(){
    const day=dayKey(),cfg=this.quotaCfg(),key='api:q75k:global:v2';let q=await this.ctx.storage.get(key);
    if(!q||q.day!==day){
      const legacy=await this.ctx.storage.get('api:q50000:global:v1'),inherited=legacy?.day===day?Math.max(0,n(legacy.used)):0;
      q={day,used:inherited,configured_limit:cfg.configuredTotal,legacy_inherited:inherited,updated:Date.now()};await this.ctx.storage.put(key,q);
    }
    return q;
  }
  async providerRecord(){
    const day=dayKey(),p=await this.ctx.storage.get('api:provider-quota:v2');
    if(!p||p.day!==day)return {day,observed_at:0,daily_limit:null,daily_remaining:null,minute_limit:null,minute_remaining:null,backoff_until:0,last_http:null};
    return p;
  }
  async quotaView(){
    const cfg=this.quotaCfg(),q=await this.quotaRecord(),p=await this.providerRecord(),now=Date.now(),providerFresh=p.observed_at&&now-p.observed_at<=cfg.providerFreshMs,
      localRemaining=Math.max(0,cfg.configuredTotal-n(q.used)),providerRemaining=providerFresh&&finite(p.daily_remaining)!=null?Math.max(0,Number(p.daily_remaining)):null,
      providerLimit=providerFresh&&finite(p.daily_limit)!=null?Number(p.daily_limit):null,effectiveRemaining=providerRemaining==null?localRemaining:Math.min(localRemaining,providerRemaining),
      effectiveLimit=providerLimit??cfg.configuredTotal;
    return {cfg,q,p,providerFresh,localRemaining,providerRemaining,effectiveRemaining,effectiveLimit};
  }
  async reserveApiCall(){
    return this.quotaWork(async()=>{
      const v=await this.quotaView(),now=Date.now();
      if(Number(v.p.backoff_until||0)>now){const e=new Error('API_PROVIDER_RATE_BACKOFF');e.code='API_PROVIDER_RATE_BACKOFF';e.retry_after_ms=Number(v.p.backoff_until)-now;throw e}
      if(v.localRemaining<=0){const e=new Error('API_TOTAL_DAILY_BUDGET_REACHED');e.code='API_TOTAL_DAILY_BUDGET_REACHED';throw e}
      if(v.providerFresh&&v.providerRemaining!=null&&v.providerRemaining<=v.cfg.providerReserve){const e=new Error('API_PROVIDER_DAILY_RESERVE_REACHED');e.code='API_PROVIDER_DAILY_RESERVE_REACHED';throw e}
      v.q.used=n(v.q.used)+1;v.q.configured_limit=v.cfg.configuredTotal;v.q.updated=now;await this.ctx.storage.put('api:q75k:global:v2',v.q);return v.q;
    });
  }
  async observeProvider(headers,httpStatus){
    const cfg=this.quotaCfg(),day=dayKey(),now=Date.now(),p=await this.providerRecord();
    const read=name=>{try{const v=headers?.get?.(name);return v==null?null:finite(v)}catch{return null}};
    const dailyLimit=read('x-ratelimit-requests-limit'),dailyRemaining=read('x-ratelimit-requests-remaining'),minuteLimit=read('x-ratelimit-limit')??read('X-RateLimit-Limit'),minuteRemaining=read('x-ratelimit-remaining')??read('X-RateLimit-Remaining'),
      next={...p,day,observed_at:now,last_http:httpStatus};
    if(dailyLimit!=null)next.daily_limit=dailyLimit;if(dailyRemaining!=null)next.daily_remaining=dailyRemaining;
    if(minuteLimit!=null)next.minute_limit=minuteLimit;if(minuteRemaining!=null)next.minute_remaining=minuteRemaining;
    if(Number(httpStatus)===429)next.backoff_until=now+cfg.rateBackoffMs;else if(Number(next.backoff_until||0)<=now)next.backoff_until=0;
    await this.ctx.storage.put('api:provider-quota:v2',next);return next;
  }
  async api(path,params={},strict=false){
    await this.reserveApiCall();if(!this.env.APISPORTS_KEY)throw new Error('APISPORTS_KEY secret is not configured');
    const baseUrl=String(this.env.APISPORTS_BASE||'https://v3.football.api-sports.io').replace(/\/$/,''),
      u=new URL(baseUrl+path);for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v));
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
    try{
      const r=await fetch(u,{headers:{'x-apisports-key':this.env.APISPORTS_KEY,'accept':'application/json'},signal:ctl.signal});await this.observeProvider(r.headers,r.status);
      const txt=await r.text();let data={};try{data=JSON.parse(txt)}catch{}
      if(!r.ok)throw new Error(`API HTTP ${r.status}`);
      if(strict&&!Array.isArray(data?.response))throw new Error('EVIDENCE_PROVIDER_INVALID_RESPONSE');
      if(data?.errors&&Object.keys(data.errors).length){if(strict)throw new Error('EVIDENCE_PROVIDER_ERROR');console.log('api warning',JSON.stringify(data.errors).slice(0,500))}
      return data.response||[];
    }finally{clearTimeout(timer)}
  }
  async quotaStatus(){
    const v=await this.quotaView(),used=n(v.q.used),util=v.effectiveLimit?Math.round((1-v.effectiveRemaining/v.effectiveLimit)*10000)/100:null;
    return {ok:true,schema:'FE_API_QUOTA_PROVIDER_AWARE_75K_V2',day:v.q.day,configured_limit:v.cfg.configuredTotal,local_used:used,local_remaining:v.localRemaining,
      provider_fresh:!!v.providerFresh,provider_observed_at:v.p.observed_at||null,provider_limit:v.providerRemaining==null?null:v.p.daily_limit,provider_remaining:v.providerRemaining,
      minute_limit:v.providerFresh?v.p.minute_limit:null,minute_remaining:v.providerFresh?v.p.minute_remaining:null,effective_limit:v.effectiveLimit,effective_remaining:v.effectiveRemaining,
      utilization_pct:util,provider_reserve_calls:v.cfg.providerReserve,legacy_inherited:v.q.legacy_inherited||0,hard_cap:true,pacing:false,candidate:true};
  }
  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==='/api/notify/quota-status'&&request.method==='GET')return reply(await this.quotaStatus());
    if(url.pathname==='/api/notify/status'&&request.method==='GET'){const r=await super.fetch(request),d=await r.json().catch(()=>({}));return reply({...d,global_api_quota:await this.quotaStatus()},r.status)}
    return super.fetch(request);
  }
}
export default base;
