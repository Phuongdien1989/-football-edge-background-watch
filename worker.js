import { DurableObject } from "cloudflare:workers";

const TERMINAL = new Set(["FT","AET","PEN","PST","CANC","ABD","AWD","WO"]);
const LIVE = new Set(["1H","HT","2H","ET","BT","P","INT","SUSP","LIVE"]);

function json(data,status=200,extra={}){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "content-type":"application/json; charset=utf-8",
      "cache-control":"no-store",
      "access-control-allow-origin":"*",
      "access-control-allow-methods":"GET,POST,DELETE,OPTIONS",
      "access-control-allow-headers":"authorization,content-type",
      ...extra
    }
  });
}
function n(v,d=null){const x=Number(v);return Number.isFinite(x)?x:d}
function cleanStr(v,max=120){return v==null?null:String(v).slice(0,max)}
function compactFixture(f){
  if(!f)return null;
  return {
    fixture:{
      id:n(f.fixture?.id),timestamp:n(f.fixture?.timestamp),date:f.fixture?.date||null,
      status:{
        long:f.fixture?.status?.long||null,short:f.fixture?.status?.short||null,
        elapsed:n(f.fixture?.status?.elapsed,0),extra:n(f.fixture?.status?.extra,null)
      }
    },
    league:{id:n(f.league?.id),name:cleanStr(f.league?.name),country:cleanStr(f.league?.country),season:n(f.league?.season)},
    teams:{
      home:{id:n(f.teams?.home?.id),name:cleanStr(f.teams?.home?.name)},
      away:{id:n(f.teams?.away?.id),name:cleanStr(f.teams?.away?.name)}
    },
    goals:{home:n(f.goals?.home,0),away:n(f.goals?.away,0)},
    score:f.score||null
  };
}
const STAT_KEEP = new Set([
  "Total Shots","Shots on Goal","Shots on Target","Shots insidebox","Shots inside box",
  "Corner Kicks","Corners","expected_goals","Expected Goals","Red Cards","Ball Possession",
  "Blocked Shots","Shots off Goal","Goalkeeper Saves"
]);
function compactStats(rows){
  return (Array.isArray(rows)?rows:[]).map(side=>({
    team:{id:n(side.team?.id),name:cleanStr(side.team?.name)},
    statistics:(Array.isArray(side.statistics)?side.statistics:[])
      .filter(x=>STAT_KEEP.has(String(x?.type||"")))
      .map(x=>({type:x.type,value:x.value}))
  }));
}
function compactEvents(rows){
  return (Array.isArray(rows)?rows:[]).slice(-40).map(e=>({
    time:{elapsed:n(e.time?.elapsed),extra:n(e.time?.extra)},
    team:{id:n(e.team?.id),name:cleanStr(e.team?.name)},
    player:{id:n(e.player?.id),name:cleanStr(e.player?.name)},
    assist:{id:n(e.assist?.id),name:cleanStr(e.assist?.name)},
    type:cleanStr(e.type,40),detail:cleanStr(e.detail,80),comments:cleanStr(e.comments,120)
  }));
}
function oddsBetWanted(name){
  const s=String(name||"").toLowerCase();
  return /over.?under|total goals|goals over|asian total|asian handicap|handicap/.test(s);
}
function compactOdds(rows){
  return (Array.isArray(rows)?rows:[]).slice(0,10).map(r=>({
    fixture:{id:n(r.fixture?.id),status:r.fixture?.status||null},
    status:r.status||null,update:r.update||null,
    odds:(Array.isArray(r.odds)?r.odds:[]).filter(b=>oddsBetWanted(b?.name)).slice(0,14).map(b=>({
      id:b.id??null,name:cleanStr(b.name,100),
      values:(Array.isArray(b.values)?b.values:[]).slice(0,30).map(v=>({
        value:v.value??v.name??v.label??null,odd:v.odd??v.price??null,handicap:v.handicap??null,
        main:v.main??null,suspended:!!v.suspended
      }))
    }))
  })).filter(x=>x.odds.length);
}
function sigFixture(f){
  if(!f)return "";
  return JSON.stringify([
    f.fixture?.status?.short,n(f.fixture?.status?.elapsed),n(f.goals?.home),n(f.goals?.away)
  ]);
}

export default {
  async fetch(request,env){
    if(request.method==="OPTIONS")return json({ok:true});
    const url=new URL(request.url);
    if(url.pathname==="/health"){
      return json({
        ok:true,service:"football-edge-background-watch",version:"1.0.0",
        durable_objects:true,alarm_polling:true
      });
    }
    if(!env.BACKGROUND_TOKEN)return json({error:"BACKGROUND_TOKEN secret is not configured"},503);
    const auth=request.headers.get("authorization")||"";
    if(auth!==`Bearer ${env.BACKGROUND_TOKEN}`)return json({error:"Unauthorized"},401);
    const id=env.BACKGROUND_WATCHER.idFromName("football-edge-global");
    return env.BACKGROUND_WATCHER.get(id).fetch(request);
  }
};

export class BackgroundWatcher extends DurableObject {
  constructor(ctx,env){
    super(ctx,env);
    this.ctx=ctx;
    this.env=env;
  }

  cfg(name,fallback){
    const v=this.env[name];
    const num=Number(v);
    return Number.isFinite(num)?num:fallback;
  }
  async api(path,params={}){
    if(!this.env.APISPORTS_KEY)throw new Error("APISPORTS_KEY secret is not configured");
    const base=String(this.env.APISPORTS_BASE||"https://v3.football.api-sports.io").replace(/\/$/,"");
    const u=new URL(base+path);
    for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=="")u.searchParams.set(k,String(v));
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
    try{
      const r=await fetch(u,{headers:{"x-apisports-key":this.env.APISPORTS_KEY,"accept":"application/json"},signal:ctl.signal});
      const txt=await r.text();let data={};try{data=JSON.parse(txt)}catch{}
      if(!r.ok)throw new Error(`API HTTP ${r.status}`);
      if(data?.errors&&Object.keys(data.errors).length)console.log("api warning",JSON.stringify(data.errors).slice(0,500));
      return data.response||[];
    }finally{clearTimeout(timer)}
  }
  async listWatches(){
    const map=await this.ctx.storage.list({prefix:"watch:"});
    return [...map.values()].filter(Boolean);
  }
  async putWatch(w){await this.ctx.storage.put(`watch:${w.fixture_id}`,w)}
  async removeWatch(id){await this.ctx.storage.delete(`watch:${id}`)}
  async timelineIndex(id){return await this.ctx.storage.get(`timeline-index:${id}`)||[]}
  async appendSnapshot(w,snap){
    const id=w.fixture_id,ts=Number(snap.captured_at),key=`snapshot:${id}:${ts}`;
    await this.ctx.storage.put(key,snap);
    let idx=await this.timelineIndex(id);
    idx=[...new Set([...idx,ts])].sort((a,b)=>a-b);
    const max=w.level==="focus"?360:120;
    if(idx.length>max){
      const drop=idx.splice(0,idx.length-max);
      await this.ctx.storage.delete(drop.map(x=>`snapshot:${id}:${x}`));
    }
    await this.ctx.storage.put(`timeline-index:${id}`,idx);
  }
  async snapshotsFor(id,since=0,limit=20){
    const idx=(await this.timelineIndex(id)).filter(x=>Number(x)>Number(since)).slice(-Math.max(1,Math.min(60,Number(limit)||20)));
    const out=[];
    for(const ts of idx){
      const row=await this.ctx.storage.get(`snapshot:${id}:${ts}`);
      if(row)out.push(row);
    }
    return out;
  }
  async ensureAlarm(delayMs=null){
    const current=await this.ctx.storage.getAlarm();
    if(current!=null)return current;
    const watches=await this.listWatches(),active=watches.filter(x=>!x.ended&&Number(x.expires_at||0)>Date.now());
    if(!active.length)return null;
    const focus=active.some(x=>x.level==="focus");
    const delay=delayMs??(focus?this.cfg("FOCUS_INTERVAL_MS",30000):this.cfg("SCREEN_INTERVAL_MS",60000));
    const at=Date.now()+Math.max(10000,delay);
    await this.ctx.storage.setAlarm(at);return at;
  }
  async register(body){
    const now=Date.now(),rows=Array.isArray(body?.fixtures)?body.fixtures:[],
          defaultLevel=body?.level==="focus"?"focus":"screen",
          ttl=Math.max(30,Math.min(720,Number(body?.ttl_minutes)||360))*60000;
    let registered=0;
    for(const x of rows.slice(0,300)){
      const id=n(x?.fixture_id);
      if(!Number.isFinite(id))continue;
      const old=await this.ctx.storage.get(`watch:${id}`)||{},level=(old.level==="focus"||x.level==="focus"||defaultLevel==="focus")?"focus":"screen";
      const kickoff=n(x.kickoff,old.kickoff||null),naturalExpiry=kickoff?Math.max(now+ttl,(kickoff*1000)+5*3600000):now+ttl;
      const w={
        ...old,fixture_id:id,level,engine:cleanStr(x.engine||body.engine||old.engine||"SCAN",30),
        home:cleanStr(x.home||old.home),away:cleanStr(x.away||old.away),league:cleanStr(x.league||old.league),
        country:cleanStr(x.country||old.country),kickoff,status:cleanStr(x.status||old.status,20),
        minute:n(x.minute,old.minute||0),registered_at:old.registered_at||now,last_registered_at:now,
        expires_at:Math.max(Number(old.expires_at||0),naturalExpiry),ended:false
      };
      await this.putWatch(w);registered++;
    }
    const alarm=await this.ensureAlarm(1000);
    const watches=await this.listWatches();
    return {ok:true,registered,active:watches.filter(x=>!x.ended&&Number(x.expires_at)>now).length,next_alarm:alarm};
  }
  async detailSnapshot(w,f,now){
    const id=w.fixture_id;
    const [stats,events,odds]=await Promise.all([
      this.api("/fixtures/statistics",{fixture:id}).catch(()=>[]),
      this.api("/fixtures/events",{fixture:id}).catch(()=>[]),
      this.api("/odds/live",{fixture:id}).catch(()=>[])
    ]);
    return {
      id:`${id}:${now}`,fixture_id:id,captured_at:now,level:w.level,engine:w.engine,
      fixture:compactFixture(f),stats_raw:compactStats(stats),events_raw:compactEvents(events),odds_raw:compactOdds(odds),
      detail:true,source:"BACKGROUND_DURABLE_OBJECT"
    };
  }
  async heartbeatSnapshot(w,f,now){
    return {
      id:`${w.fixture_id}:${now}`,fixture_id:w.fixture_id,captured_at:now,level:w.level,engine:w.engine,
      fixture:compactFixture(f),stats_raw:[],events_raw:[],odds_raw:[],detail:false,source:"BACKGROUND_DURABLE_OBJECT"
    };
  }
  async resolveFixture(w,liveMap,now){
    let f=liveMap.get(String(w.fixture_id))||null;
    if(f)return f;
    const kickoffMs=Number(w.kickoff||0)*1000,nearKickoff=!kickoffMs||now>=kickoffMs-10*60000;
    const lookupDue=nearKickoff&&(now-Number(w.last_lookup_at||0)>=120000);
    if(lookupDue){
      const rows=await this.api("/fixtures",{id:w.fixture_id}).catch(()=>[]);
      w.last_lookup_at=now;
      f=rows?.[0]||null;
    }
    return f;
  }
  async poll(){
    const now=Date.now(),watches=await this.listWatches(),active=[];
    for(const w of watches){
      if(Number(w.expires_at||0)<=now){await this.removeWatch(w.fixture_id);continue}
      if(!w.ended)active.push(w);
    }
    if(!active.length)return {active:0};

    const liveRows=await this.api("/fixtures",{live:"all",timezone:this.env.TZ||"Asia/Ho_Chi_Minh"}).catch(()=>[]);
    const liveMap=new Map((liveRows||[]).map(f=>[String(f.fixture?.id),f]));
    const focusDetail=this.cfg("DETAIL_FOCUS_MS",45000),screenDetail=this.cfg("DETAIL_SCREEN_MS",180000),
          maxDetail=Math.max(1,Math.min(12,this.cfg("MAX_DETAIL_PER_TICK",6)));
    const due=[];

    for(const w of active){
      const f=await this.resolveFixture(w,liveMap,now);
      if(!f){await this.putWatch(w);continue}
      const st=String(f.fixture?.status?.short||"");
      w.status=st;w.minute=n(f.fixture?.status?.elapsed,0);w.last_seen_at=now;
      if(TERMINAL.has(st)){
        w.ended=true;w.ended_at=now;w.expires_at=Math.min(Number(w.expires_at||now+3600000),now+3600000);
      }
      const fsig=sigFixture(f),snapEvery=w.level==="focus"?60000:120000;
      if(fsig!==w.last_fixture_sig||now-Number(w.last_snapshot_at||0)>=snapEvery){
        const snap=await this.heartbeatSnapshot(w,f,now);
        await this.appendSnapshot(w,snap);w.last_snapshot_at=now;w.last_fixture_sig=fsig
      }
      if(!w.ended&&LIVE.has(st)){
        const detailMs=w.level==="focus"?focusDetail:screenDetail;
        if(now-Number(w.last_detail_at||0)>=detailMs)due.push({w,f,dueAge:now-Number(w.last_detail_at||0)})
      }
      await this.putWatch(w);
    }

    due.sort((a,b)=>(a.w.level==="focus"?0:1)-(b.w.level==="focus"?0:1)||b.dueAge-a.dueAge);
    const batch=due.slice(0,maxDetail);
    await Promise.all(batch.map(async ({w,f})=>{
      try{
        const snap=await this.detailSnapshot(w,f,Date.now());
        await this.appendSnapshot(w,snap);w.last_detail_at=snap.captured_at;w.last_snapshot_at=snap.captured_at;await this.putWatch(w)
      }catch(e){w.last_error=String(e?.message||e);w.last_error_at=Date.now();await this.putWatch(w)}
    }));

    const remaining=(await this.listWatches()).filter(x=>!x.ended&&Number(x.expires_at||0)>Date.now());
    return {active:remaining.length,detail_polled:batch.length,live_feed_count:liveRows.length};
  }

  async alarm(){
    try{await this.poll()}
    catch(e){console.log("background alarm error",e?.stack||e);throw e}
    finally{
      const watches=await this.listWatches(),active=watches.filter(x=>!x.ended&&Number(x.expires_at||0)>Date.now());
      if(active.length){
        const focus=active.some(x=>x.level==="focus"),delay=focus?this.cfg("FOCUS_INTERVAL_MS",30000):this.cfg("SCREEN_INTERVAL_MS",60000);
        await this.ctx.storage.setAlarm(Date.now()+Math.max(10000,delay))
      }
    }
  }

  async fetch(request){
    if(request.method==="OPTIONS")return json({ok:true});
    const url=new URL(request.url);
    if(url.pathname==="/api/watch/register"&&request.method==="POST"){
      return json(await this.register(await request.json().catch(()=>({}))));
    }
    if(url.pathname==="/api/watch/list"&&request.method==="GET"){
      const now=Date.now(),watches=await this.listWatches(),alarm=await this.ctx.storage.getAlarm();
      return json({ok:true,watches,active:watches.filter(x=>!x.ended&&Number(x.expires_at||0)>now).length,next_alarm:alarm});
    }
    if(url.pathname==="/api/watch/unregister"&&request.method==="POST"){
      const body=await request.json().catch(()=>({})),ids=Array.isArray(body.fixture_ids)?body.fixture_ids:[];
      for(const id of ids)await this.removeWatch(Number(id));
      return json({ok:true,removed:ids.length});
    }
    if(url.pathname==="/api/timeline"&&request.method==="GET"){
      const id=n(url.searchParams.get("fixture_id")),since=n(url.searchParams.get("since"),0),limit=n(url.searchParams.get("limit"),30);
      if(!Number.isFinite(id))return json({error:"fixture_id required"},400);
      return json({ok:true,fixture_id:id,snapshots:await this.snapshotsFor(id,since,limit)});
    }
    if(url.pathname==="/api/watch/sync"&&request.method==="POST"){
      const body=await request.json().catch(()=>({})),ids=(Array.isArray(body.fixture_ids)?body.fixture_ids:[]).map(Number).filter(Number.isFinite).slice(0,300),
            since=body.since_by_fixture||{},limit=Math.max(1,Math.min(30,Number(body.max_snapshots_per_fixture)||12)),snapshots=[];
      for(const id of ids){
        const rows=await this.snapshotsFor(id,Number(since[String(id)]||0),limit);
        snapshots.push(...rows)
      }
      snapshots.sort((a,b)=>Number(a.captured_at)-Number(b.captured_at));
      return json({ok:true,fixtures:ids.length,snapshots});
    }
    if(url.pathname==="/api/watch/poll-now"&&request.method==="POST"){
      return json({ok:true,result:await this.poll()});
    }
    return json({error:"Not found"},404);
  }
}
