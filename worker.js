import { DurableObject } from "cloudflare:workers";

const VERSION="1.1.0";
const POLICY="WRITE_EFFICIENT_V2";
const LIVE=new Set(["1H","HT","2H","ET","BT","P","INT","SUSP","LIVE"]);
const END=new Set(["FT","AET","PEN","PST","CANC","ABD","AWD","WO"]);

function reply(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{
    "content-type":"application/json; charset=utf-8","cache-control":"no-store",
    "access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers":"authorization,content-type"
  }});
}
function num(v,d=null){const x=Number(v);return Number.isFinite(x)?x:d}
function str(v,n=120){return v==null?null:String(v).slice(0,n)}
function isQuota(e){return /allowed rows written|rows written.*free tier|durable objects free tier/i.test(String(e?.message||e||""))}

function fixtureView(f){
  if(!f)return null;
  return {fixture:{id:num(f.fixture?.id),timestamp:num(f.fixture?.timestamp),date:f.fixture?.date||null,status:{short:f.fixture?.status?.short||null,long:f.fixture?.status?.long||null,elapsed:num(f.fixture?.status?.elapsed,0),extra:num(f.fixture?.status?.extra)}},league:{id:num(f.league?.id),name:str(f.league?.name),country:str(f.league?.country),season:num(f.league?.season)},teams:{home:{id:num(f.teams?.home?.id),name:str(f.teams?.home?.name)},away:{id:num(f.teams?.away?.id),name:str(f.teams?.away?.name)}},goals:{home:num(f.goals?.home,0),away:num(f.goals?.away,0)},score:f.score||null};
}
function fixtureSig(f){return f?JSON.stringify([f.fixture?.status?.short,num(f.fixture?.status?.elapsed),num(f.goals?.home),num(f.goals?.away)]):""}
function compactStats(rows){return (rows||[]).map(x=>({team:{id:num(x.team?.id),name:str(x.team?.name)},statistics:(x.statistics||[]).filter(y=>/shot|corner|expected goals|red card|ball possession|save/i.test(String(y?.type||""))).map(y=>({type:y.type,value:y.value}))}));}
function compactEvents(rows){return (rows||[]).slice(-40).map(e=>({time:e.time||null,team:{id:num(e.team?.id),name:str(e.team?.name)},player:{id:num(e.player?.id),name:str(e.player?.name)},type:str(e.type,40),detail:str(e.detail,80)}));}
function compactOdds(rows){return (rows||[]).slice(0,10).map(r=>({fixture:r.fixture||null,status:r.status||null,update:r.update||null,odds:(r.odds||[]).filter(b=>/over.?under|total goals|asian handicap|handicap/i.test(String(b?.name||""))).slice(0,14)})).filter(x=>x.odds.length);}

export default {
  async fetch(request,env){
    if(request.method==="OPTIONS")return reply({ok:true});
    const url=new URL(request.url);
    if(url.pathname==="/health")return reply({ok:true,service:"football-edge-background-watch",version:VERSION,durable_objects:true,alarm_polling:true,storage_policy:POLICY});
    if(!env.BACKGROUND_TOKEN)return reply({error:"BACKGROUND_TOKEN secret is not configured"},503);
    if((request.headers.get("authorization")||"")!==`Bearer ${env.BACKGROUND_TOKEN}`)return reply({error:"Unauthorized"},401);
    try{
      const id=env.BACKGROUND_WATCHER.idFromName("football-edge-global");
      return await env.BACKGROUND_WATCHER.get(id).fetch(request);
    }catch(e){
      if(isQuota(e))return reply({ok:false,error:"DURABLE_OBJECT_WRITE_QUOTA_EXCEEDED",worker_version:VERSION},429);
      return reply({ok:false,error:"BACKGROUND_WORKER_RUNTIME",message:String(e?.message||e).slice(0,400),worker_version:VERSION},500);
    }
  }
};

export class BackgroundWatcher extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env}
  cfg(k,d){const x=Number(this.env[k]);return Number.isFinite(x)?x:d}
  async api(path,params={}){
    if(!this.env.APISPORTS_KEY)throw new Error("APISPORTS_KEY secret is not configured");
    const u=new URL(String(this.env.APISPORTS_BASE||"https://v3.football.api-sports.io").replace(/\/$/,"")+path);
    Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=="")u.searchParams.set(k,String(v))});
    const r=await fetch(u,{headers:{"x-apisports-key":this.env.APISPORTS_KEY,accept:"application/json"}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(`API HTTP ${r.status}`);
    return d.response||[];
  }
  async watches(){const m=await this.ctx.storage.list({prefix:"watch:"});return [...m.values()].filter(Boolean)}
  async save(w){await this.ctx.storage.put(`watch:${w.fixture_id}`,w)}
  async remove(id){await this.ctx.storage.delete(`watch:${id}`)}
  slot(w,detail,ts){const focus=w.level==="focus",slots=detail?(focus?24:12):(focus?60:30),ms=detail?(focus?30000:120000):60000;return `snapshotv2:${w.fixture_id}:${detail?"d":"h"}:${String(Math.floor(ts/ms)%slots).padStart(2,"0")}`}
  async putSnapshot(w,snap){const sig=JSON.stringify([snap.fixture?.fixture?.status?.short,snap.fixture?.fixture?.status?.elapsed,snap.fixture?.goals?.home,snap.fixture?.goals?.away,snap.detail?snap.stats_raw:null,snap.detail?snap.events_raw:null,snap.detail?snap.odds_raw:null]);const key=snap.detail?"last_detail_sig":"last_heartbeat_sig";if(sig===w[key])return false;w[key]=sig;await this.ctx.storage.put(this.slot(w,!!snap.detail,snap.captured_at),snap);return true}
  async timeline(id,since=0,limit=20){let m=await this.ctx.storage.list({prefix:`snapshotv2:${id}:`}),a=[...m.values()].filter(Boolean);if(!a.length){m=await this.ctx.storage.list({prefix:`snapshot:${id}:`});a=[...m.values()].filter(Boolean)}return a.filter(x=>Number(x?.captured_at||0)>Number(since||0)).sort((a,b)=>a.captured_at-b.captured_at).slice(-Math.max(1,Math.min(60,Number(limit)||20)))}
  async ensureAlarm(ms=null){const old=await this.ctx.storage.getAlarm();if(old!=null)return old;const a=(await this.watches()).filter(x=>!x.ended&&Number(x.expires_at||0)>Date.now());if(!a.length)return null;const d=ms??(a.some(x=>x.level==="focus")?this.cfg("FOCUS_INTERVAL_MS",30000):this.cfg("SCREEN_INTERVAL_MS",60000)),at=Date.now()+Math.max(10000,d);await this.ctx.storage.setAlarm(at);return at}
  async register(body){
    const now=Date.now(),rows=Array.isArray(body?.fixtures)?body.fixtures:[],ttl=Math.max(30,Math.min(720,Number(body?.ttl_minutes)||360))*60000,def=body?.level==="focus"?"focus":"screen",all=await this.watches(),map=new Map(all.map(w=>[String(w.fixture_id),w]));
    const maxA=this.cfg("MAX_ACTIVE_WATCHES",120),maxF=this.cfg("MAX_FOCUS_WATCHES",16);let active=all.filter(x=>!x.ended&&x.expires_at>now).length,focus=all.filter(x=>!x.ended&&x.level==="focus"&&x.expires_at>now).length,registered=0,written=0,skipped_capacity=0;
    for(const x of rows){const id=num(x?.fixture_id);if(!Number.isFinite(id))continue;const old=map.get(String(id))||{},isFocus=old.level==="focus"||x.level==="focus"||def==="focus";if(!old.fixture_id&&(active>=maxA||(isFocus&&focus>=maxF))){skipped_capacity++;continue}if(!old.fixture_id){active++;if(isFocus)focus++}const kickoff=num(x.kickoff,old.kickoff||null),exp=kickoff?Math.max(now+ttl,kickoff*1000+5*3600000):now+ttl,w={...old,fixture_id:id,level:isFocus?"focus":"screen",engine:str(x.engine||body.engine||old.engine||"SCAN",30),home:str(x.home||old.home),away:str(x.away||old.away),league:str(x.league||old.league),country:str(x.country||old.country),kickoff,status:str(x.status||old.status,20),minute:num(x.minute,old.minute||0),registered_at:old.registered_at||now,last_registered_at:now,expires_at:Math.max(Number(old.expires_at||0),exp),ended:false};if(!old.fixture_id||JSON.stringify(old)!==JSON.stringify(w)){await this.save(w);written++}map.set(String(id),w);registered++}
    return {ok:true,registered,written,skipped_capacity,active,next_alarm:await this.ensureAlarm(1000),policy:POLICY};
  }
  async detail(w,f,now){const [st,ev,od]=await Promise.all([this.api("/fixtures/statistics",{fixture:w.fixture_id}).catch(()=>[]),this.api("/fixtures/events",{fixture:w.fixture_id}).catch(()=>[]),this.api("/odds/live",{fixture:w.fixture_id}).catch(()=>[])]);return {id:`${w.fixture_id}:${now}`,fixture_id:w.fixture_id,captured_at:now,level:w.level,engine:w.engine,fixture:fixtureView(f),stats_raw:compactStats(st),events_raw:compactEvents(ev),odds_raw:compactOdds(od),detail:true,source:"BACKGROUND_DURABLE_OBJECT"}}
  async poll(){
    const now=Date.now(),all=await this.watches(),active=[];for(const w of all){if(Number(w.expires_at||0)<=now){await this.remove(w.fixture_id);continue}if(!w.ended)active.push(w)}if(!active.length)return {active:0,policy:POLICY};
    const live=await this.api("/fixtures",{live:"all",timezone:this.env.TZ||"Asia/Ho_Chi_Minh"}).catch(()=>[]),map=new Map(live.map(f=>[String(f.fixture?.id),f])),dirty=new Set(),due=[],persist=Math.max(120000,this.cfg("WATCH_PERSIST_HEARTBEAT_MS",300000));
    for(const w of active){let f=map.get(String(w.fixture_id))||null;if(!f&&now-Number(w.last_lookup_at||0)>=(w.level==="focus"?this.cfg("LOOKUP_FOCUS_MS",120000):this.cfg("LOOKUP_SCREEN_MS",300000))){const r=await this.api("/fixtures",{id:w.fixture_id}).catch(()=>[]);w.last_lookup_at=now;f=r[0]||null;dirty.add(String(w.fixture_id))}if(!f)continue;const st=String(f.fixture?.status?.short||""),sig=fixtureSig(f);w.status=st;w.minute=num(f.fixture?.status?.elapsed,0);if(END.has(st)){w.ended=true;w.ended_at=w.ended_at||now;w.expires_at=Math.min(w.expires_at||now+3600000,now+3600000);dirty.add(String(w.fixture_id))}if(sig!==w.last_fixture_sig||now-Number(w.last_snapshot_at||0)>=(w.level==="focus"?300000:600000)){const snap={id:`${w.fixture_id}:${now}`,fixture_id:w.fixture_id,captured_at:now,level:w.level,engine:w.engine,fixture:fixtureView(f),stats_raw:[],events_raw:[],odds_raw:[],detail:false,source:"BACKGROUND_DURABLE_OBJECT"};if(await this.putSnapshot(w,snap))w.last_snapshot_at=now;w.last_fixture_sig=sig;dirty.add(String(w.fixture_id))}if(!w.ended&&LIVE.has(st)&&now-Number(w.last_detail_at||0)>=(w.level==="focus"?this.cfg("DETAIL_FOCUS_MS",60000):this.cfg("DETAIL_SCREEN_MS",180000)))due.push({w,f})}
    for(const {w,f} of due.slice(0,Math.max(1,Math.min(12,this.cfg("MAX_DETAIL_PER_TICK",6))))){const snap=await this.detail(w,f,Date.now());if(await this.putSnapshot(w,snap))w.last_snapshot_at=snap.captured_at;w.last_detail_at=snap.captured_at;dirty.add(String(w.fixture_id))}
    let writes=0;for(const w of active)if(dirty.has(String(w.fixture_id))||now-Number(w.last_persist_at||0)>=persist){w.last_persist_at=now;await this.save(w);writes++}
    return {active:active.filter(x=>!x.ended&&x.expires_at>Date.now()).length,detail_polled:due.length,live_feed_count:live.length,watch_writes:writes,policy:POLICY};
  }
  async alarm(){try{await this.poll()}finally{const a=(await this.watches()).filter(x=>!x.ended&&x.expires_at>Date.now());if(a.length)await this.ctx.storage.setAlarm(Date.now()+(a.some(x=>x.level==="focus")?this.cfg("FOCUS_INTERVAL_MS",30000):this.cfg("SCREEN_INTERVAL_MS",60000)))}}
  async fetch(request){
    if(request.method==="OPTIONS")return reply({ok:true});const u=new URL(request.url);
    if(u.pathname==="/api/watch/register"&&request.method==="POST")return reply(await this.register(await request.json().catch(()=>({}))));
    if(u.pathname==="/api/watch/list"&&request.method==="GET"){const now=Date.now(),w=await this.watches();return reply({ok:true,watches:w,active:w.filter(x=>!x.ended&&x.expires_at>now).length,next_alarm:await this.ctx.storage.getAlarm(),worker_version:VERSION,policy:POLICY})}
    if(u.pathname==="/api/watch/unregister"&&request.method==="POST"){const b=await request.json().catch(()=>({})),ids=Array.isArray(b.fixture_ids)?b.fixture_ids:[];for(const id of ids)await this.remove(Number(id));return reply({ok:true,removed:ids.length})}
    if(u.pathname==="/api/timeline"&&request.method==="GET"){const id=num(u.searchParams.get("fixture_id"));if(!Number.isFinite(id))return reply({error:"fixture_id required"},400);return reply({ok:true,fixture_id:id,snapshots:await this.timeline(id,num(u.searchParams.get("since"),0),num(u.searchParams.get("limit"),30))})}
    if(u.pathname==="/api/watch/sync"&&request.method==="POST"){const b=await request.json().catch(()=>({})),ids=(Array.isArray(b.fixture_ids)?b.fixture_ids:[]).map(Number).filter(Number.isFinite).slice(0,300),out=[];for(const id of ids)out.push(...await this.timeline(id,Number(b.since_by_fixture?.[String(id)]||0),Math.min(30,Number(b.max_snapshots_per_fixture)||12)));return reply({ok:true,fixtures:ids.length,snapshots:out.sort((a,b)=>a.captured_at-b.captured_at)})}
    if(u.pathname==="/api/watch/poll-now"&&request.method==="POST")return reply({ok:true,result:await this.poll()});
    if(u.pathname==="/api/diagnostics"&&request.method==="GET"){const w=await this.watches(),now=Date.now();return reply({ok:true,worker_version:VERSION,policy:POLICY,total_watches:w.length,active:w.filter(x=>!x.ended&&x.expires_at>now).length,focus:w.filter(x=>!x.ended&&x.level==="focus"&&x.expires_at>now).length,next_alarm:await this.ctx.storage.getAlarm()})}
    return reply({error:"Not found"},404);
  }
}
