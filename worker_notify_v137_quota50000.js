import base,{BackgroundWatcher as HotPriorityWatcher} from './worker_notify_v136_hot_priority.js';

// P1.3 GLOBAL 50K HARD CAP
// Quota safety only. No pacing and no H1/FT/HC engine, threshold, HOT scheduler,
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
    const legacy=[...(await this.ctx.storage.list({prefix:'notify:match:'})).values()];
    if(!this.d1LiveEnabled())return legacy;
    await this.ensureLiveTable();
    const result=await this.env.FOOTBALL_DB.prepare('SELECT fixture_id,payload FROM fe_notify_live_state').all();
    const map=new Map(legacy.map(row=>[Number(row.id),row]));
    for(const row of result.results||[])map.set(Number(row.fixture_id),JSON.parse(row.payload));
    return [...map.values()];
  }
  async getNotifyMatch(id){
    if(!this.d1LiveEnabled())return this.ctx.storage.get('notify:match:'+id);
    await this.ensureLiveTable();
    const row=await this.env.FOOTBALL_DB.prepare('SELECT payload FROM fe_notify_live_state WHERE fixture_id=?').bind(Number(id)).first();
    return row?JSON.parse(row.payload):this.ctx.storage.get('notify:match:'+id);
  }
  async putNotifyMatch(id,item){
    if(!this.d1LiveEnabled())return this.ctx.storage.put('notify:match:'+id,item);
    await this.ensureLiveTable();
    await this.env.FOOTBALL_DB.prepare(
      'INSERT INTO fe_notify_live_state(fixture_id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(fixture_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at'
    ).bind(Number(id),JSON.stringify(item),Date.now()).run();
  }
  async deleteNotifyMatch(id){
    if(!this.d1LiveEnabled())return this.ctx.storage.delete('notify:match:'+id);
    await this.ensureLiveTable();
    // Remove from both stores so legacy fallback cannot resurrect stale fixtures.
    await this.env.FOOTBALL_DB.prepare('DELETE FROM fe_notify_live_state WHERE fixture_id=?').bind(Number(id)).run();
    await this.ctx.storage.delete('notify:match:'+id);
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

  async api(path,params={},strict=false){
    await this.reserveApiCall();
    return super.api(path,params,strict);
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
