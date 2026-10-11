import base,{BackgroundWatcher as HotPriorityWatcher} from './worker_notify_v136_hot_priority.js';

// P1.3 GLOBAL 50K HARD CAP
// Quota and outbound request pacing only. No H1/FT/HC engine, threshold, HOT scheduler,
// Push, validation semantics or D1 schema changes.
// Every API-Football request made through the BackgroundWatcher shares one
// Durable Object counter so notification + Smart Follow + Evidence + Validation
// cannot collectively exceed the actual 50,000 calls/day plan.
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*',
  'access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'
}});
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;

export class BackgroundWatcher extends HotPriorityWatcher{
  quotaCfg(){
    return {total:Math.max(1000,n(this.env.API_TOTAL_DAILY_BUDGET,50000))};
  }

  quotaWork(fn){
    const p=(this._q50000Chain||Promise.resolve()).then(fn);
    this._q50000Chain=p.catch(()=>{});
    return p;
  }

  // Durable Object serializes reservations. Persist a *prepaid* block before
  // consuming any request. Unused tokens are forfeited on restart: this can
  // underuse the provider quota, but cannot overspend it.
  // D1 migration is opt-in. Legacy DO rows are retained and used as fallback.
  // No D1 schema changes occur while LIVE_STATE_D1_ENABLED is disabled.
  d1LiveEnabled(){return String(this.env.LIVE_STATE_D1_ENABLED||'false')==='true';}
  async ensureLiveTable(){
    if(!this.d1LiveEnabled())return;
    if(!this.env.FOOTBALL_DB)throw Error('LIVE_D1_BINDING_MISSING');
    if(!this._liveTableReady){
      this._liveTableReady=this.env.FOOTBALL_DB.prepare(
        'CREATE TABLE IF NOT EXISTS fe_notify_live_state (fixture_id INTEGER PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL)'
      ).run().catch(e=>{this._liveTableReady=null;throw e});
    }
    await this._liveTableReady;
  }
  async listNotifyMatches(){
    if(this.d1LiveEnabled()&&this._liveStateCache)return [...this._liveStateCache.values()].map(row=>JSON.parse(JSON.stringify(row)));
    const legacy=[...(await this.ctx.storage.list({prefix:'notify:match:'})).values()];
    if(!this.d1LiveEnabled())return legacy;
    await this.ensureLiveTable();
    const result=await this.env.FOOTBALL_DB.prepare('SELECT fixture_id,payload FROM fe_notify_live_state').all();
    const map=new Map(legacy.map(row=>[Number(row.id),row]));
    for(const row of result.results||[]){const state=JSON.parse(row.payload);if(state?.__fe_deleted===true)map.delete(Number(row.fixture_id));else map.set(Number(row.fixture_id),state);}
    this._liveStateCache=map;
    return [...map.values()].map(row=>JSON.parse(JSON.stringify(row)));
  }
  async getNotifyMatch(id){
    if(this.d1LiveEnabled()&&this._liveStateCache){const row=this._liveStateCache.get(Number(id));return row?JSON.parse(JSON.stringify(row)):null;}
    if(!this.d1LiveEnabled())return this.ctx.storage.get('notify:match:'+id);
    await this.ensureLiveTable();
    const row=await this.env.FOOTBALL_DB.prepare('SELECT payload FROM fe_notify_live_state WHERE fixture_id=?').bind(Number(id)).first();
    if(row){const state=JSON.parse(row.payload);return state?.__fe_deleted===true?null:state;}
    return this.ctx.storage.get('notify:match:'+id);
  }
  async putNotifyMatch(id,item){
    if(!this.d1LiveEnabled())return this.ctx.storage.put('notify:match:'+id,item);
    await this.ensureLiveTable();
    await this.env.FOOTBALL_DB.prepare(
      'INSERT INTO fe_notify_live_state(fixture_id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(fixture_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at'
    ).bind(Number(id),JSON.stringify(item),Date.now()).run();
    this._liveStateCache?.set(Number(id),JSON.parse(JSON.stringify(item)));
  }
  async deleteNotifyMatch(id){
    if(!this.d1LiveEnabled())return this.ctx.storage.delete('notify:match:'+id);
    await this.ensureLiveTable();
    // Tombstone in D1 instead of deleting the legacy DO row. This prevents
    // resurrection on restart while keeping original data for rollback.
    await this.env.FOOTBALL_DB.prepare(
      'INSERT INTO fe_notify_live_state(fixture_id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(fixture_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at'
    ).bind(Number(id),JSON.stringify({__fe_deleted:true}),Date.now()).run();
    this._liveStateCache?.delete(Number(id));
  }
  async reserveApiCall(){
    return this.quotaWork(async()=>{
      const cfg=this.quotaCfg(),day=new Date().toISOString().slice(0,10),key='api:q50000:global:v1';
      if(this._apiLease?.day===day&&this._apiLease.remaining>0){
        this._apiLease.remaining--;
        return {day,used:this._apiLease.persistedUsed,limit:cfg.total,leased:true};
      }
      let q=await this.ctx.storage.get(key);
      if(!q||q.day!==day)q={day,used:0,limit:cfg.total,updated:Date.now()};
      if(n(q.used)>=cfg.total){
        const e=new Error('API_TOTAL_DAILY_BUDGET_REACHED');e.code='API_TOTAL_DAILY_BUDGET_REACHED';throw e;
      }
      const configured=Math.floor(n(this.env.API_RESERVATION_BLOCK_SIZE,64));
      const block=Math.max(1,Math.min(256,configured));
      const granted=Math.min(block,cfg.total-n(q.used));
      q.used=n(q.used)+granted;q.limit=cfg.total;q.updated=Date.now();
      // Fail closed: do not expose tokens until this durable write succeeds.
      await this.ctx.storage.put(key,q);
      this._apiLease={day,remaining:granted-1,persistedUsed:q.used};
      return {...q,leased:true,granted};
    });
  }

  async quotaStatus(){
    const cfg=this.quotaCfg(),day=new Date().toISOString().slice(0,10),key='api:q50000:global:v1';
    let q=await this.ctx.storage.get(key);
    if(!q||q.day!==day)q={day,used:0,limit:cfg.total,updated:0};
    const used=n(q.used),remaining=Math.max(0,cfg.total-used);
    return {ok:true,schema:'FE_API_QUOTA_50000_GLOBAL_V1',day,used,limit:cfg.total,remaining,utilization_pct:Math.round((used/cfg.total)*10000)/100,hard_cap:true,pacing:false,accounting:'PREPAID_BLOCK_UPPER_BOUND',usage_note:'used includes prepaid reservations that may not have been sent; unused reservations are forfeited on restart',block_size:Math.max(1,Math.min(256,Math.floor(n(this.env.API_RESERVATION_BLOCK_SIZE,64))))};
  }

  providerPacingCfg(){
    // Bootstrap from the verified subscription, before the first HTTP response.
    // A stricter advertised limit wins; missing/error headers cannot disable pacing.
    const configured=Math.max(1,n(this.env.API_PROVIDER_MINUTE_LIMIT,60));
    const learned=Number(this._providerMinuteLimit||0);
    const rpm=learned>0?Math.min(configured,learned):configured;
    const gap=rpm>=60?Math.ceil(1000/Math.floor(rpm/60)):Math.ceil(60000/rpm);
    return {configured_minute_limit:configured,effective_minute_limit:rpm,start_gap_ms:gap,bootstrap:true};
  }
  async beforeProviderRequest(){
    const run=async()=>{
      if(!this._providerCooldownLoaded){
        const saved=await this.ctx.storage.get('api:provider-cooldown:v2');
        this._providerRetryAt=Math.max(this._providerRetryAt||0,Number(saved?.until||0));
        this._providerRateFailures=Number(saved?.failures||0);
        this._providerCooldownLoaded=true;
      }
      // Recheck after waiting: an in-flight response may extend Retry-After.
      for(;;){
        if(Number(this._providerRetryAt||0)>Date.now()){
          const error=new Error('API_PROVIDER_COOLDOWN');error.retryable=false;
          error.retryAfterMs=this._providerRetryAt-Date.now();throw error;
        }
        const wait=Math.max(0,Number(this._providerNextStart||0)-Date.now());
        if(wait<=0)break;
        await new Promise(resolve=>setTimeout(resolve,wait));
      }
      await this.reserveApiCall();
      const now=Date.now();
      this._providerNextStart=now+this.providerPacingCfg().start_gap_ms;
      this._providerStarts=(this._providerStarts||[]).filter(at=>now-at<1000).concat(now);
      this._providerMaxStartsPerSecond=Math.max(this._providerMaxStartsPerSecond||0,this._providerStarts.length);
      this._providerPhysicalAttempts=(this._providerPhysicalAttempts||0)+1;
    };
    const promise=(this._providerStartWork||Promise.resolve()).then(run);
    this._providerStartWork=promise.catch(()=>{});
    return promise;
  }
  async recordProviderObservation(observation){
    this._providerObservation=observation;
    const rpm=observation.limits.minute_limit;
    if(Number.isFinite(rpm)&&rpm>0)this._providerMinuteLimit=rpm;
    if(observation.code==='API_PROVIDER_RATE_LIMIT'){
      const active=Number(this._providerRetryAt||0)>Date.now();
      if(!active)this._providerRateFailures=(this._providerRateFailures||0)+1;
      // HTTP 200 rate errors with no exhausted-minute header may be brief
      // proxy protection. Give original strict LIVE retries 1s/2s recovery,
      // then stop all branches for a full minute if all three attempts fail.
      const soft=observation.http===200&&observation.limits.minute_remaining!==0;
      const failures=this._providerRateFailures||1;
      const fallback=soft&&failures<3?1000*failures:Math.min(300000,60000*2**Math.min(3,Math.max(0,failures-(soft?3:1))));
      const delay=observation.retry_after_ms||fallback;
      const previousUntil=Number(this._providerRetryAt||0);
      // Responses from one in-flight batch share a single cooldown episode.
      if(!active||observation.retry_after_ms)this._providerRetryAt=Math.max(previousUntil,Date.now()+delay);
      if(this._providerRetryAt!==previousUntil)await this.ctx.storage.put('api:provider-cooldown:v2',{until:this._providerRetryAt,failures:this._providerRateFailures});
    }else if(observation.code==='OK'&&this._providerRateFailures&&Date.now()>=Number(this._providerRetryAt||0)){
      this._providerRateFailures=0;this._providerRetryAt=0;
      await this.ctx.storage.put('api:provider-cooldown:v2',{until:0,failures:0});
    }
    if(observation.code!=='OK'){
      const previous=await this.ctx.storage.get('api:last-provider-error:v1');
      if(!previous||previous.code!==observation.code||Date.now()-previous.at>=120000)await this.ctx.storage.put('api:last-provider-error:v1',observation);
    }else if(!this._providerSuccessSavedAt||Date.now()-this._providerSuccessSavedAt>=120000){
      await this.ctx.storage.put('api:last-provider-success:v1',observation);
      this._providerSuccessSavedAt=Date.now();
    }
  }

  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==='/api/notify/quota-status'&&request.method==='GET')return reply(await this.quotaStatus());
    if(url.pathname==='/api/notify/status'&&request.method==='GET'){
      const r=await super.fetch(request),d=await r.json().catch(()=>({}));
      return reply({...d,global_api_quota:await this.quotaStatus()},r.status);
    }
    return super.fetch(request);
  }
}

export default base;
