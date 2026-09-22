import base, { BackgroundWatcher as BackgroundWatcherV124 } from "./worker_v124.js";

const WORKER_VERSION = "1.2.5";
const QSIG_POLICY = "QSIG_CONTINUITY_V1";
const TERMINAL = new Set(["FT","AET","PEN","PST","CANC","ABD","AWD","WO"]);
const QSIG_ENGINES = new Set(["H1","FT","HC"]);
const QSIG_PREFIX = "qsig:";

function json(data,status=200,extra={}){
  return new Response(JSON.stringify(data),{status,headers:{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    "access-control-allow-origin":"*",
    "access-control-allow-methods":"GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers":"authorization,content-type",
    ...extra
  }});
}
function n(v,d=null){const x=Number(v);return Number.isFinite(x)?x:d}
function s(v,max=240){return v==null?null:String(v).slice(0,max)}
function payload(v){try{return JSON.stringify(v??null)}catch{return null}}
function authorized(request,env){return !!env.BACKGROUND_TOKEN&&(request.headers.get("authorization")||"")===`Bearer ${env.BACKGROUND_TOKEN}`}
function qsigOutcome(p){
  if(p?.outcome!=null)return s(p.outcome,60);
  const e=String(p?.engine||"").toUpperCase();
  if(e==="FT"&&typeof p?.goal_10m==="boolean")return p.goal_10m?"HIT":"MISS";
  if(e==="H1"&&typeof p?.goal_5m==="boolean")return p.goal_5m?"HIT":"MISS";
  if(e==="HC"&&p?.state_15m!=null)return s(p.state_15m,60);
  if(p?.data_state==="DATA_MISSING"||p?.background_state==="DATA_MISSING")return "DATA_MISSING";
  return null;
}
function validationResult(p){
  if(p?.outcome!=null)return s(p.outcome,80);
  if(typeof p?.hit==="boolean")return p.hit?"HIT":"MISS";
  return s(p?.resolution||null,80);
}
function fixtureStmt(env,p,now){
  const fid=n(p?.fixture_id);if(!Number.isFinite(fid))return null;
  return env.FOOTBALL_DB.prepare(`INSERT INTO fixtures (fixture_id,league,home,away,kickoff,status,first_seen_at,last_seen_at)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(fixture_id) DO UPDATE SET league=COALESCE(excluded.league,fixtures.league),home=COALESCE(excluded.home,fixtures.home),away=COALESCE(excluded.away,fixtures.away),kickoff=COALESCE(excluded.kickoff,fixtures.kickoff),status=COALESCE(excluded.status,fixtures.status),last_seen_at=MAX(fixtures.last_seen_at,excluded.last_seen_at)`)
    .bind(fid,s(p?.league),s(p?.home),s(p?.away),n(p?.kickoff,null),s(p?.status,20),now,now);
}
function safeQsigStmt(env,p,now){
  const outcome=qsigOutcome(p),resolved=n(p?.resolved_at??p?.closed_at,null);
  return env.FOOTBALL_DB.prepare(`INSERT INTO qsig_results (id,fixture_id,engine,signal_at,resolved_at,outcome,payload_json)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      engine=excluded.engine,
      signal_at=MIN(qsig_results.signal_at,excluded.signal_at),
      resolved_at=CASE WHEN excluded.resolved_at IS NOT NULL THEN excluded.resolved_at ELSE qsig_results.resolved_at END,
      outcome=CASE WHEN excluded.outcome IS NOT NULL THEN excluded.outcome ELSE qsig_results.outcome END,
      payload_json=CASE WHEN excluded.outcome IS NULL AND qsig_results.outcome IS NOT NULL THEN qsig_results.payload_json ELSE excluded.payload_json END`)
    .bind(s(p?.id,180),n(p?.fixture_id),s(p?.engine,20),n(p?.t0??p?.signal_at??p?.captured_at,now),resolved,outcome,payload(p));
}
function safeValidationStmt(env,p,now){
  const result=validationResult(p);
  return env.FOOTBALL_DB.prepare(`INSERT INTO validation_results (id,fixture_id,validation_type,created_at,result_key,payload_json)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      fixture_id=COALESCE(excluded.fixture_id,validation_results.fixture_id),
      validation_type=excluded.validation_type,
      created_at=MIN(validation_results.created_at,excluded.created_at),
      result_key=CASE
        WHEN (excluded.result_key IS NULL OR excluded.result_key IN ('OPEN','WAITING'))
             AND validation_results.result_key IS NOT NULL
             AND validation_results.result_key NOT IN ('OPEN','WAITING')
        THEN validation_results.result_key ELSE excluded.result_key END,
      payload_json=CASE
        WHEN (excluded.result_key IS NULL OR excluded.result_key IN ('OPEN','WAITING'))
             AND validation_results.result_key IS NOT NULL
             AND validation_results.result_key NOT IN ('OPEN','WAITING')
        THEN validation_results.payload_json ELSE excluded.payload_json END`)
    .bind(s(p?.id,180),n(p?.fixture_id,null),s(p?.source||p?.sample_type||p?.engine||"VALIDATION",60),n(p?.captured_at??p?.created_at,now),result,payload(p));
}
async function safeEvidenceSync(env,events){
  if(!env.FOOTBALL_DB)return {accepted:0,ignored:(events||[]).length};
  const now=Date.now();let accepted=0,ignored=0;
  for(let i=0;i<(events||[]).length;i+=20){
    const stmts=[];
    for(const evt of events.slice(i,i+20)){
      const p=evt?.payload||{},type=String(evt?.type||"");
      if(type==="QSIG_RESULT"&&p?.id&&Number.isFinite(n(p?.fixture_id))){
        const fs=fixtureStmt(env,p,now);if(fs)stmts.push(fs);stmts.push(safeQsigStmt(env,p,now));accepted++;
      }else if(type==="VALIDATION_RESULT"&&p?.id){
        stmts.push(safeValidationStmt(env,p,now));accepted++;
      }else ignored++;
    }
    if(stmts.length)await env.FOOTBALL_DB.batch(stmts);
  }
  return {accepted,ignored};
}
async function baseSync(request,env,ctx,events){
  const u=new URL(request.url);
  const init={method:"POST",headers:request.headers,body:JSON.stringify({events})};
  return base.fetch(new Request(u.toString(),init),env,ctx);
}
function terminalTask(t){return ["RESOLVED","VOID","DATA_MISSING"].includes(String(t?.state||""))}
function horizonFor(engine){return engine==="H1"?5:engine==="FT"?10:15}
function targetFor(engine){return engine==="H1"?"GOAL_5M":engine==="FT"?"GOAL_10M":"STATE_15M"}
function eventMinute(e){return n(e?.time?.elapsed,null)}
function isGoal(e){return /goal/i.test(String(e?.type||""))}
function isRed(e){return /card/i.test(String(e?.type||""))&&/red/i.test(String(e?.detail||""))}
function scoreTotal(snap){
  const g=snap?.fixture?.goals;
  const h=n(g?.home,null),a=n(g?.away,null);
  return Number.isFinite(h)&&Number.isFinite(a)?h+a:null;
}
function currentMinute(snap){return n(snap?.fixture?.fixture?.status?.elapsed,null)}
function currentStatus(snap){return String(snap?.fixture?.fixture?.status?.short||"")}
function uniqEvents(snaps){
  const map=new Map();
  for(const snap of snaps||[])for(const e of snap?.events_raw||[]){
    const key=[eventMinute(e),e?.type||"",e?.detail||"",e?.team?.id||"",e?.player?.id||""].join("|");
    map.set(key,e);
  }
  return [...map.values()].sort((a,b)=>Number(eventMinute(a)||0)-Number(eventMinute(b)||0));
}
function backgroundPayload(t){
  const p={...(t?.payload||{})};
  p.id=t.id;p.engine=t.engine;p.fixture_id=t.fixture_id;
  p.t0=t.t0;p.minute=t.minute;p.start_home=t.start_home;p.start_away=t.start_away;
  p.background_state=t.state;p.background_reason=t.reason||null;
  p.background_updated_at=t.updated_at||Date.now();
  p.background_worker_version=WORKER_VERSION;
  if(t.state==="RESOLVED"){
    p.resolved=true;p.resolved_at=t.resolved_at;p.outcome=t.outcome;
    p.wave_open=false;p.release_reason=t.reason||"BACKGROUND_RESOLVED";
    if(t.engine==="H1"&&typeof t.hit==="boolean")p.goal_5m=t.hit;
    if(t.engine==="FT"&&typeof t.hit==="boolean")p.goal_10m=t.hit;
  }else if(t.state==="VOID"){
    p.resolved=true;p.resolved_at=t.resolved_at;p.outcome="VOID";
    p.wave_open=false;p.release_reason=t.reason||"BACKGROUND_VOID";
    p.void_reason=t.reason||"BACKGROUND_VOID";
  }else if(t.state==="DATA_MISSING"){
    p.resolved=false;p.outcome="DATA_MISSING";
    p.wave_open=false;p.data_state="DATA_MISSING";p.data_missing_reason=t.reason||"BACKGROUND_DATA_MISSING";
    p.closed_at=t.resolved_at||Date.now();
  }
  return p;
}
async function persistQsig(env,t){
  if(!env.FOOTBALL_DB||!t?.id||!Number.isFinite(n(t?.fixture_id)))return false;
  const p=backgroundPayload(t),now=Date.now();
  const outcome=t.state==="RESOLVED"?s(t.outcome,60):t.state==="VOID"?"VOID":t.state==="DATA_MISSING"?"DATA_MISSING":null;
  const resolvedAt=terminalTask(t)?n(t.resolved_at,now):null;
  const q=env.FOOTBALL_DB.prepare(`INSERT INTO qsig_results (id,fixture_id,engine,signal_at,resolved_at,outcome,payload_json)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET engine=excluded.engine,signal_at=excluded.signal_at,resolved_at=excluded.resolved_at,outcome=excluded.outcome,payload_json=excluded.payload_json`)
    .bind(s(t.id,180),n(t.fixture_id),s(t.engine,20),n(t.t0,now),resolvedAt,outcome,payload(p));
  const stmts=[q];
  if(terminalTask(t)){
    const validationId=`QSIG-${t.engine}-${t.id}`;
    const resolution=t.state==="RESOLVED"?"RESOLVED":t.state;
    const vp={
      id:validationId,schema:"V1.16.2",sample_type:"AUTO",engine:t.engine,source:"QSIG_OFFICIAL",
      fixture_id:t.fixture_id,league:p.league,home:p.home,away:p.away,captured_at:t.t0,minute:t.minute,
      entry_score:{home:t.start_home,away:t.start_away},signal_state:p.level,signal_score:p.score,
      app_dq_100:p.app_dq_100??null,live_quality_5:p.live_quality_5??p.dq??null,
      coverage:p.coverage??null,integrity:p.integrity??null,freshness_age_sec:p.freshness_age_sec??p.fresh??null,
      data_tier:p.data_tier??null,evidence_age:p.evidence_age??null,trend:p.trend??null,
      target:t.target,resolution,outcome:t.state==="RESOLVED"?t.outcome:t.state,
      hit:t.state==="RESOLVED"?!!t.hit:null,release_reason:p.release_reason??null,
      void_reason:p.void_reason??null,data_missing_reason:p.data_missing_reason??null,
      resolved_at:resolvedAt,benchmark_version:p.benchmark_version||"V1.16.2_FIXED",t0_snapshot:p.t0_snapshot??null
    };
    const v=env.FOOTBALL_DB.prepare(`INSERT INTO validation_results (id,fixture_id,validation_type,created_at,result_key,payload_json)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET fixture_id=excluded.fixture_id,validation_type=excluded.validation_type,created_at=excluded.created_at,result_key=excluded.result_key,payload_json=excluded.payload_json`)
      .bind(validationId,n(t.fixture_id),s(vp.source,60),n(t.t0,now),s(vp.outcome||vp.resolution,80),payload(vp));
    stmts.push(v);
  }
  await env.FOOTBALL_DB.batch(stmts);
  return true;
}

export class BackgroundWatcher extends BackgroundWatcherV124 {
  async listQsigTasks(){
    const map=await this.ctx.storage.list({prefix:QSIG_PREFIX});
    return [...map.values()].filter(Boolean);
  }
  async putQsigTask(t){await this.ctx.storage.put(`${QSIG_PREFIX}${t.id}`,t)}
  async activeQsigForFixture(id){
    const rows=await this.listQsigTasks(),fid=Number(id);
    return rows.filter(t=>Number(t.fixture_id)===fid&&!terminalTask(t));
  }
  async removeWatch(id){
    const pinned=await this.activeQsigForFixture(id);
    if(pinned.length)return false;
    return super.removeWatch(id);
  }
  async registerQsig(body){
    const input=Array.isArray(body?.signals)?body.signals:(body?.signal?[body.signal]:[]);
    const now=Date.now(),existing=await this.listQsigTasks(),map=new Map(existing.map(t=>[String(t.id),t]));
    let registered=0,existingTerminal=0,invalid=0;
    for(const raw of input.slice(0,40)){
      const engine=String(raw?.engine||"").toUpperCase(),fixtureId=n(raw?.fixture_id),id=s(raw?.id,180);
      if(!id||!QSIG_ENGINES.has(engine)||!Number.isFinite(fixtureId)){invalid++;continue}
      const old=map.get(id);
      if(old&&terminalTask(old)){existingTerminal++;continue}
      const horizon=horizonFor(engine),minute=n(raw?.minute,0),t0=n(raw?.t0??raw?.captured_at,now);
      const t={
        ...(old||{}),id,engine,fixture_id:fixtureId,target:targetFor(engine),horizon_minutes:horizon,
        t0:old?.t0??t0,minute:old?.minute??minute,start_home:old?.start_home??n(raw?.start_home,0),start_away:old?.start_away??n(raw?.start_away,0),
        league:old?.league??s(raw?.league),home:old?.home??s(raw?.home),away:old?.away??s(raw?.away),
        state:old?.state||"WAITING",reason:old?.reason||null,outcome:old?.outcome||null,hit:old?.hit??null,
        registered_at:old?.registered_at||now,updated_at:now,payload:{...(old?.payload||{}),...raw}
      };
      await super.register({fixtures:[{
        fixture_id:fixtureId,level:"focus",engine:`QSIG_${engine}`,home:t.home,away:t.away,league:t.league,
        status:raw?.status||null,minute,kickoff:raw?.kickoff||null
      }],level:"focus",engine:`QSIG_${engine}`,ttl_minutes:180});
      await this.putQsigTask(t);await persistQsig(this.env,t);map.set(id,t);registered++;
    }
    await this.ensureAlarm(1000);
    return {ok:true,registered,existing_terminal:existingTerminal,invalid,policy:QSIG_POLICY,worker_version:WORKER_VERSION};
  }
  async finishQsig(t,state,reason,{outcome=null,hit=null,evidence=null}={}){
    if(terminalTask(t))return t;
    t.state=state;t.reason=reason;t.outcome=outcome;t.hit=hit;
    t.resolved_at=Date.now();t.updated_at=t.resolved_at;
    if(evidence)t.evidence=evidence;
    await this.putQsigTask(t);await persistQsig(this.env,t);
    return t;
  }
  async resolveOneQsig(t){
    if(terminalTask(t))return t;
    const snaps=await this.snapshotsFor(t.fixture_id,Math.max(0,Number(t.t0||0)-1000),60);
    if(!snaps.length){
      const wallAge=(Date.now()-Number(t.t0||Date.now()))/60000;
      if(wallAge>Math.max(35,Number(t.horizon_minutes||15)+25))
        return this.finishQsig(t,"DATA_MISSING","NO_BACKGROUND_SNAPSHOT",{evidence:{snapshots:0}});
      return t;
    }
    const usable=snaps.filter(x=>x?.fixture?.fixture),latest=usable[usable.length-1]||snaps[snaps.length-1];
    const events=uniqEvents(usable),startMin=Number(t.minute||0),deadline=startMin+Number(t.horizon_minutes||horizonFor(t.engine)),
          minute=currentMinute(latest),status=currentStatus(latest),startTotal=Number(t.start_home||0)+Number(t.start_away||0),
          total=scoreTotal(latest);
    const afterStart=e=>Number.isFinite(eventMinute(e))&&eventMinute(e)>startMin;
    const firstGoal=events.find(e=>isGoal(e)&&afterStart(e))||null;
    const firstRed=events.find(e=>isRed(e)&&afterStart(e))||null;
    const evidence={snapshots:usable.length,latest_minute:minute,latest_status:status,deadline_minute:deadline,
      first_goal_min:firstGoal?eventMinute(firstGoal):null,first_red_min:firstRed?eventMinute(firstRed):null,
      latest_score_total:total,start_score_total:startTotal};

    if(firstRed&&eventMinute(firstRed)<=deadline)
      return this.finishQsig(t,"VOID","RED_CARD",{outcome:"VOID",evidence});

    if(t.engine==="HC"){
      if(firstGoal&&eventMinute(firstGoal)<=deadline)
        return this.finishQsig(t,"VOID","GOAL_REBASELINE",{outcome:"VOID",evidence});
      if(TERMINAL.has(status)&&(!Number.isFinite(minute)||minute<deadline))
        return this.finishQsig(t,"VOID","ENDED_BEFORE_15M",{outcome:"VOID",evidence});
      if(Number.isFinite(minute)&&minute>=deadline+2)
        return this.finishQsig(t,"DATA_MISSING","HC_DERIVED_STATE_UNAVAILABLE",{evidence});
      return t;
    }

    if(firstGoal&&eventMinute(firstGoal)<=deadline)
      return this.finishQsig(t,"RESOLVED","BACKGROUND_GOAL",{outcome:"HIT",hit:true,evidence});

    if(Number.isFinite(minute)&&minute>=deadline){
      if(Number.isFinite(total)&&total===startTotal)
        return this.finishQsig(t,"RESOLVED","BACKGROUND_HORIZON",{outcome:"MISS",hit:false,evidence});
      if(firstGoal&&eventMinute(firstGoal)>deadline)
        return this.finishQsig(t,"RESOLVED","BACKGROUND_HORIZON",{outcome:"MISS",hit:false,evidence});
      return this.finishQsig(t,"DATA_MISSING","GOAL_TIME_UNVERIFIED",{evidence});
    }

    if(TERMINAL.has(status))
      return this.finishQsig(t,"VOID","ENDED_BEFORE_HORIZON",{outcome:"VOID",evidence});

    return t;
  }
  async resolveQsigTasks(){
    const tasks=await this.listQsigTasks();let checked=0,changed=0;
    for(const t of tasks){
      if(terminalTask(t))continue;
      const before=String(t.state)+"|"+String(t.updated_at||"");
      const after=await this.resolveOneQsig(t);checked++;
      if(before!==String(after.state)+"|"+String(after.updated_at||""))changed++;
    }
    return {checked,changed,open:(await this.listQsigTasks()).filter(t=>!terminalTask(t)).length};
  }
  async poll(){
    const core=await super.poll();
    const qsig=await this.resolveQsigTasks();
    return {...core,qsig};
  }
  async fetch(request){
    if(request.method==="OPTIONS")return json({ok:true});
    const url=new URL(request.url);
    if(url.pathname==="/api/qsig/register"&&request.method==="POST")
      return json(await this.registerQsig(await request.json().catch(()=>({}))));
    if(url.pathname==="/api/qsig/list"&&request.method==="GET"){
      const tasks=await this.listQsigTasks();
      return json({ok:true,worker_version:WORKER_VERSION,policy:QSIG_POLICY,
        open:tasks.filter(t=>!terminalTask(t)).length,tasks});
    }
    if(url.pathname==="/api/qsig/status"&&request.method==="GET"){
      const id=url.searchParams.get("id"),tasks=await this.listQsigTasks(),t=id?tasks.find(x=>String(x.id)===String(id)):null;
      return json({ok:true,worker_version:WORKER_VERSION,task:t||null});
    }
    return super.fetch(request);
  }
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==="/health"){
      const r=await base.fetch(request,env,ctx),d=await r.json().catch(()=>({}));
      return json({...d,version:WORKER_VERSION,qsig_continuity:true,qsig_policy:QSIG_POLICY,monotonic_evidence_sync:true},r.status);
    }
    if(url.pathname==="/api/db/sync"&&request.method==="POST"){
      if(!authorized(request,env))return json({error:"Unauthorized"},401);
      const body=await request.json().catch(()=>({})),events=Array.isArray(body?.events)?body.events:[],
            evidence=events.filter(x=>["QSIG_RESULT","VALIDATION_RESULT"].includes(String(x?.type||""))),
            rest=events.filter(x=>!["QSIG_RESULT","VALIDATION_RESULT"].includes(String(x?.type||"")));
      const br=await baseSync(request,env,ctx,rest);if(!br.ok)return br;
      const bd=await br.json().catch(()=>({ok:false}));
      try{
        const ev=await safeEvidenceSync(env,evidence);
        return json({ok:true,accepted:Number(bd.accepted||0)+ev.accepted,ignored:Number(bd.ignored||0)+ev.ignored,
          schema_version:bd.schema_version||"V1.23.1",history_schema_version:bd.history_schema_version||null,
          worker_version:WORKER_VERSION,monotonic_evidence_sync:true});
      }catch(e){return json({ok:false,error:"QSIG_SAFE_SYNC_FAILED",message:String(e?.message||e).slice(0,500)},500)}
    }
    if(url.pathname.startsWith("/api/qsig/")){
      if(request.method==="OPTIONS")return json({ok:true});
      if(!authorized(request,env))return json({error:"Unauthorized"},401);
      const id=env.BACKGROUND_WATCHER.idFromName("football-edge-global");
      return env.BACKGROUND_WATCHER.get(id).fetch(request);
    }
    return base.fetch(request,env,ctx);
  }
};
