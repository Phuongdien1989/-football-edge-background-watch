import { DurableObject } from "cloudflare:workers";

const WORKER_VERSION = "1.2.1";
const DB_SCHEMA_VERSION = "V1.23.1";
const STORAGE_POLICY = "WRITE_EFFICIENT_V2";
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
function quotaError(e){return /allowed rows written|rows written.*free tier|durable objects free tier/i.test(String(e?.message||e||""))}
function runtimeMessage(e){return String(e?.message||e||"Unknown background worker error").slice(0,500)}


function dbConfigured(env){return !!env.FOOTBALL_DB}
function dbVal(v){return v===undefined?null:v}
function dbJson(v){try{return JSON.stringify(v??null)}catch{return null}}
function csvCell(v){const s=String(v??"");return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
async function dbSchemaVersion(env){
  if(!dbConfigured(env))return null;
  try{const r=await env.FOOTBALL_DB.prepare("SELECT value FROM fe_schema_meta WHERE key='schema_version' LIMIT 1").first();return r?.value||null}catch{return null}
}
async function dbHealth(env){
  const configured=dbConfigured(env),schema_version=configured?await dbSchemaVersion(env):null;
  return {ok:true,configured,schema_ready:schema_version===DB_SCHEMA_VERSION,schema_version,expected_schema:DB_SCHEMA_VERSION,worker_version:WORKER_VERSION};
}
async function dbCount(env,table){
  try{const r=await env.FOOTBALL_DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first();return Number(r?.n||0)}catch{return null}
}
async function dbStats(env){
  if(!dbConfigured(env))return {ok:false,configured:false};
  return {ok:true,configured:true,schema_version:await dbSchemaVersion(env),entry_decisions:await dbCount(env,'entry_decisions'),entry_outcomes:await dbCount(env,'entry_outcomes'),live_snapshots:await dbCount(env,'live_snapshots'),fixtures:await dbCount(env,'fixtures')};
}
function dbFixtureStmt(env,p,now){
  const fid=n(p?.fixture_id??p?.id);if(!Number.isFinite(fid))return null;
  return env.FOOTBALL_DB.prepare(`INSERT INTO fixtures (fixture_id,league,home,away,kickoff,status,first_seen_at,last_seen_at)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(fixture_id) DO UPDATE SET
      league=COALESCE(excluded.league,fixtures.league),home=COALESCE(excluded.home,fixtures.home),away=COALESCE(excluded.away,fixtures.away),
      kickoff=COALESCE(excluded.kickoff,fixtures.kickoff),status=COALESCE(excluded.status,fixtures.status),last_seen_at=MAX(fixtures.last_seen_at,excluded.last_seen_at)`)
    .bind(fid,cleanStr(p?.league),cleanStr(p?.home),cleanStr(p?.away),n(p?.kickoff,null),cleanStr(p?.status,20),now,now);
}
function dbEntryStmt(env,p,now){
  const score=p?.entry_score||{},final=p?.final_score||{};
  return env.FOOTBALL_DB.prepare(`INSERT INTO entry_decisions
    (id,fixture_id,engine,policy_status,policy_reason,captured_at,minute,score_home,score_away,market_type,selection,line,price,odds_format,price_zone,behavior_state,signal_state,data_level,market_level,edge_level,model_prob,break_even,market_prob,edge,model_ev,candidate_supported,auto_settle_supported,resolution,outcome,unit_pl,resolved_at,payload_json,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      policy_status=excluded.policy_status,policy_reason=excluded.policy_reason,minute=excluded.minute,score_home=excluded.score_home,score_away=excluded.score_away,
      market_type=excluded.market_type,selection=excluded.selection,line=excluded.line,price=excluded.price,price_zone=excluded.price_zone,behavior_state=excluded.behavior_state,
      signal_state=excluded.signal_state,data_level=excluded.data_level,market_level=excluded.market_level,edge_level=excluded.edge_level,model_prob=excluded.model_prob,
      break_even=excluded.break_even,market_prob=excluded.market_prob,edge=excluded.edge,model_ev=excluded.model_ev,candidate_supported=excluded.candidate_supported,
      auto_settle_supported=excluded.auto_settle_supported,resolution=excluded.resolution,outcome=excluded.outcome,unit_pl=excluded.unit_pl,resolved_at=excluded.resolved_at,
      payload_json=excluded.payload_json,updated_at=excluded.updated_at`)
    .bind(cleanStr(p?.id,160),n(p?.fixture_id),cleanStr(p?.engine,20),cleanStr(p?.policy_status,40),cleanStr(p?.policy_reason,500),n(p?.captured_at,now),n(p?.minute,null),n(score?.home,null),n(score?.away,null),cleanStr(p?.market_type,40),cleanStr(p?.selection,40),n(p?.line,null),n(p?.price,null),cleanStr(p?.odds_format,20),cleanStr(p?.price_zone,40),cleanStr(p?.behavior_state,50),cleanStr(p?.signal_state,80),cleanStr(p?.data_level,80),cleanStr(p?.market_level,80),cleanStr(p?.edge_level,80),n(p?.model_prob,null),n(p?.break_even,null),n(p?.market_prob,null),n(p?.edge,null),n(p?.model_ev,null),p?.candidate_supported?1:0,p?.auto_settle_supported?1:0,cleanStr(p?.resolution,40),cleanStr(p?.outcome,40),n(p?.unit_pl,null),n(p?.resolved_at,null),dbJson(p),now);
}
function dbEntryOutcomeStmt(env,p,now){
  if(String(p?.resolution||'')!=='RESOLVED'||!p?.id)return null;const final=p?.final_score||{};
  return env.FOOTBALL_DB.prepare(`INSERT INTO entry_outcomes (decision_id,fixture_id,engine,outcome,unit_pl,final_score_home,final_score_away,resolved_at,payload_json,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(decision_id) DO UPDATE SET outcome=excluded.outcome,unit_pl=excluded.unit_pl,final_score_home=excluded.final_score_home,final_score_away=excluded.final_score_away,resolved_at=excluded.resolved_at,payload_json=excluded.payload_json,updated_at=excluded.updated_at`)
    .bind(cleanStr(p.id,160),n(p.fixture_id),cleanStr(p.engine,20),cleanStr(p.outcome,40),n(p.unit_pl,null),n(final?.home,null),n(final?.away,null),n(p.resolved_at,now),dbJson(p),now);
}
function dbLiveStmt(env,p,now){
  return env.FOOTBALL_DB.prepare(`INSERT INTO live_snapshots
    (id,fixture_id,source,engine,snapshot_kind,persistence_reason,captured_at,minute,status,score_home,score_away,top_rank,signal_state,signal_score,dq,policy_status,behavior_state,market_type,selection,line,price,fingerprint,payload_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET persistence_reason=excluded.persistence_reason,minute=excluded.minute,status=excluded.status,score_home=excluded.score_home,score_away=excluded.score_away,top_rank=excluded.top_rank,signal_state=excluded.signal_state,signal_score=excluded.signal_score,dq=excluded.dq,policy_status=excluded.policy_status,behavior_state=excluded.behavior_state,market_type=excluded.market_type,selection=excluded.selection,line=excluded.line,price=excluded.price,fingerprint=excluded.fingerprint,payload_json=excluded.payload_json`)
    .bind(cleanStr(p?.id,180),n(p?.fixture_id),cleanStr(p?.source,40),cleanStr(p?.engine,30),cleanStr(p?.snapshot_kind,40),cleanStr(p?.persistence_reason,80),n(p?.captured_at,now),n(p?.minute,null),cleanStr(p?.status,20),n(p?.score_home,null),n(p?.score_away,null),n(p?.top_rank,null),cleanStr(p?.signal_state,80),n(p?.signal_score,null),n(p?.dq,null),cleanStr(p?.policy_status,40),cleanStr(p?.behavior_state,50),cleanStr(p?.market_type,50),cleanStr(p?.selection,40),n(p?.line,null),n(p?.price,null),cleanStr(p?.fingerprint,500),dbJson(p?.payload??p));
}
async function dbWriteEvents(env,events){
  if(!dbConfigured(env))return {ok:false,error:'D1_NOT_CONFIGURED',accepted:0};
  const rows=(Array.isArray(events)?events:[]).slice(0,80),now=Date.now();let accepted=0,ignored=0;
  for(let i=0;i<rows.length;i+=20){
    const stmts=[],chunk=rows.slice(i,i+20);
    for(const evt of chunk){const p=evt?.payload||{},type=String(evt?.type||'');const fs=dbFixtureStmt(env,p,now);if(fs)stmts.push(fs);
      if(type==='ENTRY_DECISION'){if(p?.id&&Number.isFinite(n(p?.fixture_id))){stmts.push(dbEntryStmt(env,p,now));const os=dbEntryOutcomeStmt(env,p,now);if(os)stmts.push(os);accepted++}else ignored++}
      else if(type==='LIVE_SNAPSHOT'){if(p?.id&&Number.isFinite(n(p?.fixture_id))){stmts.push(dbLiveStmt(env,p,now));accepted++}else ignored++}
      else ignored++;
    }
    if(stmts.length)await env.FOOTBALL_DB.batch(stmts);
  }
  return {ok:true,accepted,ignored,schema_version:await dbSchemaVersion(env)};
}
async function dbRows(env,table,limit=2000){
  const lim=Math.max(1,Math.min(10000,Number(limit)||2000));
  const r=await env.FOOTBALL_DB.prepare(`SELECT * FROM ${table} ORDER BY captured_at DESC LIMIT ?`).bind(lim).all();return r?.results||[];
}
function liveRowsCsv(rows){
  const cols=['id','fixture_id','source','engine','snapshot_kind','persistence_reason','captured_at','minute','status','score_home','score_away','top_rank','signal_state','signal_score','dq','policy_status','behavior_state','market_type','selection','line','price'];
  return [cols.join(','),...(rows||[]).map(r=>cols.map(c=>csvCell(r?.[c])).join(','))].join('\n');
}
async function handleDbRequest(request,env,url){
  if(url.pathname==='/api/db/health'&&request.method==='GET')return json(await dbHealth(env));
  if(url.pathname==='/api/db/stats'&&request.method==='GET')return json(await dbStats(env));
  if(url.pathname==='/api/db/sync'&&request.method==='POST'){const body=await request.json().catch(()=>({}));try{return json(await dbWriteEvents(env,body?.events||[]))}catch(e){return json({ok:false,error:'D1_SYNC_FAILED',message:runtimeMessage(e)},500)}}
  if(!dbConfigured(env))return json({ok:false,error:'D1_NOT_CONFIGURED'},503);
  if(url.pathname==='/api/db/evidence-review'&&request.method==='GET')return json(await evidenceReviewPage(env,url));
  if(url.pathname==='/api/db/entries'&&request.method==='GET'){const rows=await dbRows(env,'entry_decisions',url.searchParams.get('limit'));return json({ok:true,rows});}
  if(url.pathname==='/api/db/live'&&request.method==='GET'){const rows=await dbRows(env,'live_snapshots',url.searchParams.get('limit'));return json({ok:true,rows});}
  if(url.pathname==='/api/db/export/entries'&&request.method==='GET'){const rows=await dbRows(env,'entry_decisions',url.searchParams.get('limit')||10000);return json({ok:true,schema:'ENTRY_DECISIONS_EXPORT_V1.23.1',exported_at:new Date().toISOString(),rows});}
  if(url.pathname==='/api/db/export/live'&&request.method==='GET'){const rows=await dbRows(env,'live_snapshots',url.searchParams.get('limit')||10000);if(String(url.searchParams.get('format')||'').toLowerCase()==='csv')return new Response(liveRowsCsv(rows),{status:200,headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="football_edge_live_snapshots.csv"','cache-control':'no-store','access-control-allow-origin':'*'}});return json({ok:true,schema:'LIVE_SNAPSHOTS_EXPORT_V1.23.1',exported_at:new Date().toISOString(),rows});}
  return json({error:'DB route not found'},404);
}
// Independent, conservative evidence review. Never mutates QSIG or Validation.
function reviewQsigEvidence(q,snapshots,now=Date.now()){
  const engine=String(q.engine||''),windows=engine==='H1'?[3,5,10]:[5,10,15];
  const out={schema:'FE_EVIDENCE_REVIEW_V1',signal_id:q.id,fixture_id:q.fixture_id,home:q.home||null,away:q.away||null,engine,t0:q.t0,
    reviewed_at:now,status:'MISSING_DATA',reason:'NO_SOURCE_EVIDENCE',windows:{},legacy:{},conflicts:[],bet_result:false};
  for(const w of windows){out.windows[w]='UNKNOWN';out.legacy[w]=q[engine==='HC'?`state_${w}m`:`goal_${w}m`]??null}
  if(engine==='HC'){
    out.status=windows.every(w=>out.legacy[w]!=null)?'RECORDED_ONLY':'MISSING_DATA';
    out.reason='HC_REQUIRES_ORIGINAL_LIVE_STATE_REPLAY';return out;
  }
  if(!['FT','H1'].includes(engine))return out;
  const num=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
  if(![q.t0,q.minute,q.start_home,q.start_away].every(num)){out.reason='INVALID_BASELINE';return out}
  const start=Number(q.minute),g0=Number(q.start_home)+Number(q.start_away);
  const rows=snapshots.filter(x=>Number(x.captured_at)>=Number(q.t0)&&Number(x.fixture_id)===Number(q.fixture_id)).sort((a,b)=>b.captured_at-a.captured_at);
  // Latest source wins, including corrected events; never fall back to stale good data.
  const snap=rows[0];if(!snap){if(now<Number(q.t0)+10800000){out.status='WAITING';out.reason='AWAITING_SOURCE'}return out}
  out.evidence_id=snap.id;out.evidence_at=snap.captured_at;
  const p=snap.payload||{},f=p.fixture||{},st=f.fixture?.status?.short||snap.status;
  if(['CANC','ABD','AWD','WO','PST'].includes(st)){out.status='VOID';out.reason=`FIXTURE_${st}`;return out}
  const terminal=['FT','AET','PEN'].includes(st),halfDone=['HT','2H','ET','BT','P','FT','AET','PEN'].includes(st);
  const finished=engine==='H1'?halfDone:terminal;
  if(!['OK','EMPTY'].includes(p.source_health?.events)||!Array.isArray(p.events_raw)){out.reason='EVENTS_UNAVAILABLE';return out}
  if(p.source_health?.score!=='OK'||![f.goals?.home,f.goals?.away].every(num)){out.reason='SCORE_UNAVAILABLE';return out}
  const total=Number(f.goals.home)+Number(f.goals.away);
  const goals=p.events_raw.filter(e=>String(e.type).toLowerCase()==='goal'&&!/miss|cancel|disallow|shootout/i.test(String(e.detail||'')));
  if(goals.some(e=>!num(e.time?.elapsed))||goals.length!==total){out.reason='EVENT_SCORE_MISMATCH';return out}
  if(engine==='H1'&&finished){
    const ht=f.score?.halftime;
    if(![ht?.home,ht?.away].every(num)||goals.filter(e=>Number(e.time.elapsed)<=45).length!==Number(ht.home)+Number(ht.away)){out.reason='HALFTIME_LEDGER_UNVERIFIED';return out}
  }
  if(goals.filter(e=>Number(e.time.elapsed)<=start).length!==g0){out.reason='BASELINE_EVENT_AMBIGUITY';return out}
  // elapsed 45/90 plus extra cannot be mapped into the next period's minute scale.
  const eligible=goals.filter(e=>Number(e.time.elapsed)>start&&Number(e.time.elapsed)<=(engine==='H1'?45:90));
  const noExtra=eligible.filter(e=>!Number(e.time.extra||0)).map(e=>Number(e.time.elapsed));
  const current=Number(f.fixture?.status?.elapsed??snap.minute),periodEnd=engine==='H1'?45:90;
  for(const w of windows){
    const end=start+w,hit=noExtra.some(m=>m<=end);
    if(hit)out.windows[w]='HIT';
    else if(end>periodEnd||(finished&&current<end))out.windows[w]=finished?'CENSORED':'UNKNOWN';
    else if(eligible.some(e=>Number(e.time.extra||0)&&Number(e.time.elapsed)<=end))out.windows[w]='UNKNOWN';
    else if(current>=end||finished)out.windows[w]='MISS';
    if(typeof out.legacy[w]==='boolean'&&['HIT','MISS'].includes(out.windows[w])&&out.legacy[w]!== (out.windows[w]==='HIT'))out.conflicts.push(String(w));
  }
  out.period_goal=eligible.length>0?true:(finished&&(engine==='H1'||goals.every(e=>Number(e.time.elapsed)<=90)))?false:null;
  out.status=out.conflicts.length?'CONFLICT':finished?'CONFIRMED':'OBSERVED';
  out.reason=out.conflicts.length?'LEGACY_REVIEW_DISAGREE':finished?'EVENTS_RECONCILED_WITH_SCORE':'PROVISIONAL_LIVE_EVIDENCE';
  if(!out.conflicts.length&&Object.values(out.windows).some(v=>v==='UNKNOWN')){out.status=(finished||now>=Number(q.t0)+10800000)?'MISSING_DATA':'WAITING';out.reason='INCOMPLETE_WINDOWS'}
  return out;
}
async function evidenceReviewPage(env,url){
  const limit=20,before=Number(url.searchParams.get('before')||Date.now()+60000),afterId=url.searchParams.get('after_id')||'';
  if(!Number.isFinite(before))throw new Error('INVALID_CURSOR');
  const q=await env.FOOTBALL_DB.prepare('SELECT * FROM qsig_results WHERE signal_at < ? OR (signal_at = ? AND id > ?) ORDER BY signal_at DESC,id ASC LIMIT ?').bind(before,before,afterId,limit+1).all();
  if(q.success===false||!Array.isArray(q.results))throw new Error('QSIG_READ_FAILED');
  const page=(q.results||[]).slice(0,limit),cache=new Map(),reviews=[];
  for(const row of page){
    let signal;try{signal=JSON.parse(row.payload_json)}catch{signal={}}
    if(!signal||typeof signal!=='object'||Array.isArray(signal))signal={};
    signal={...signal,id:row.id,fixture_id:row.fixture_id,engine:row.engine,t0:signal.t0??row.signal_at};
    const fid=Number(row.fixture_id);
    if(!cache.has(fid)){
      const result=await env.FOOTBALL_DB.prepare("SELECT * FROM live_snapshots WHERE fixture_id = ? AND source = 'EVIDENCE_FOLLOWUP' AND snapshot_kind = 'SOURCE_DETAIL' ORDER BY captured_at DESC LIMIT 1").bind(fid).all();
      if(result.success===false||!Array.isArray(result.results))throw new Error('SOURCE_READ_FAILED');
      cache.set(fid,(result.results||[]).map(x=>{let p={};try{p=JSON.parse(x.payload_json)}catch{}return {...x,payload:p}}));
    }
    reviews.push(reviewQsigEvidence(signal,cache.get(fid)));
  }
  const last=page.at(-1),more=(q.results||[]).length>limit;
  return {ok:true,schema:'FE_EVIDENCE_REVIEW_EXPORT_V1',read_only:true,exported_at:new Date().toISOString(),rows:reviews,
    next:more?{before:last.signal_at,after_id:last.id}:null,note:'Independent source review, not betting results. HC recorded states are not independently replayed.'};
}
function backgroundMarketSignature(odds){
  try{return JSON.stringify((odds||[]).map(r=>(r.odds||[]).map(b=>[b.name,(b.values||[]).map(v=>[v.value,v.handicap,v.odd,v.suspended])])))}catch{return ''}
}
function backgroundRedCount(snap){
  let c=0;for(const side of (snap?.stats_raw||[]))for(const x of (side?.statistics||[]))if(String(x?.type||'').toLowerCase()==='red cards')c+=Number(x?.value||0)||0;
  if(!c)for(const e of (snap?.events_raw||[]))if(/card/i.test(String(e?.type||''))&&/red/i.test(String(e?.detail||'')))c++;
  return c;
}
function backgroundSmartState(snap){
  return {status:String(snap?.fixture?.fixture?.status?.short||''),minute:n(snap?.fixture?.fixture?.status?.elapsed,null),home:n(snap?.fixture?.goals?.home,0),away:n(snap?.fixture?.goals?.away,0),red:backgroundRedCount(snap),market:backgroundMarketSignature(snap?.odds_raw)};
}
async function persistBackgroundLiveSnapshot(env,snap,w){
  if(!dbConfigured(env)||!snap?.fixture_id)return false;const now=Number(snap.captured_at||Date.now()),cur=backgroundSmartState(snap),prev=w?.db_persist_state||null;let reason=null;
  if(!prev)reason='BACKGROUND_BASELINE';
  else if(cur.home!==prev.home||cur.away!==prev.away)reason='SCORE_CHANGE';
  else if(cur.status!==prev.status)reason='STATUS_CHANGE';
  else if(cur.red!==prev.red)reason='RED_CARD_CHANGE';
  else if(cur.market!==prev.market&&now-Number(w?.last_db_market_at||0)>=120000)reason='MARKET_MOVE';
  else if(now-Number(w?.last_db_persist_at||0)>=300000)reason='PERIODIC_5M';
  if(!reason)return false;
  const f=snap.fixture||{},p={id:`BG-${snap.fixture_id}-${now}`,fixture_id:Number(snap.fixture_id),source:'BACKGROUND',engine:cleanStr(w?.engine||snap.engine||'SCAN',30),snapshot_kind:snap.detail?'SOURCE_DETAIL':'SOURCE_HEARTBEAT',persistence_reason:reason,captured_at:now,minute:cur.minute,status:cur.status,score_home:cur.home,score_away:cur.away,top_rank:w?.level==='focus'?1:null,signal_state:null,signal_score:null,dq:null,policy_status:null,behavior_state:null,market_type:null,selection:null,line:null,price:null,fingerprint:JSON.stringify(cur),league:f?.league?.name||w?.league||null,home:f?.teams?.home?.name||w?.home||null,away:f?.teams?.away?.name||w?.away||null,kickoff:f?.fixture?.timestamp||w?.kickoff||null,payload:{fixture:f,stats_raw:snap.stats_raw||[],events_raw:(snap.events_raw||[]).slice(-20),odds_raw:snap.odds_raw||[]}};
  try{const fs=dbFixtureStmt(env,p,now),ls=dbLiveStmt(env,p,now);await env.FOOTBALL_DB.batch([fs,ls].filter(Boolean));w.db_persist_state=cur;w.last_db_persist_at=now;if(reason==='MARKET_MOVE')w.last_db_market_at=now;return true}catch(e){w.last_db_error=runtimeMessage(e);w.last_db_error_at=now;return false}
}

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
function sigDetail(snap){
  return JSON.stringify([
    snap.fixture?.fixture?.status?.short,
    snap.fixture?.fixture?.status?.elapsed,
    snap.fixture?.goals?.home,
    snap.fixture?.goals?.away,
    snap.stats_raw,
    snap.events_raw,
    snap.odds_raw
  ]);
}
function watchComparable(w){
  if(!w)return "";
  return JSON.stringify([
    w.fixture_id,w.level,w.engine,w.home,w.away,w.league,w.country,w.kickoff,w.status,w.minute,
    w.expires_at,w.ended,w.ended_at,w.last_lookup_at,w.last_snapshot_at,w.last_detail_at,
    w.last_fixture_sig,w.last_detail_sig,w.last_error,w.last_error_at
  ]);
}

export default {
  async fetch(request,env){
    if(request.method==="OPTIONS")return json({ok:true});
    const url=new URL(request.url);
    if(url.pathname==="/health"){
      return json({
        ok:true,service:"football-edge-background-watch",version:WORKER_VERSION,
        durable_objects:true,alarm_polling:true,storage_policy:STORAGE_POLICY,
        d1_configured:dbConfigured(env),database_schema_expected:DB_SCHEMA_VERSION
      });
    }
    if(!env.BACKGROUND_TOKEN)return json({error:"BACKGROUND_TOKEN secret is not configured"},503);
    const auth=request.headers.get("authorization")||"";
    if(auth!==`Bearer ${env.BACKGROUND_TOKEN}`)return json({error:"Unauthorized"},401);
    try{
      if(url.pathname.startsWith('/api/db/'))return await handleDbRequest(request,env,url);
      const id=env.BACKGROUND_WATCHER.idFromName("football-edge-global");
      return await env.BACKGROUND_WATCHER.get(id).fetch(request);
    }catch(e){
      if(quotaError(e)){
        return json({
          ok:false,
          error:"DURABLE_OBJECT_WRITE_QUOTA_EXCEEDED",
          message:"Cloudflare Durable Objects write quota is exhausted. Background Watch is temporarily read/write blocked until quota resets or the plan is upgraded.",
          worker_version:WORKER_VERSION
        },429);
      }
      console.log("background worker runtime",e?.stack||e);
      return json({ok:false,error:"BACKGROUND_WORKER_RUNTIME",message:runtimeMessage(e),worker_version:WORKER_VERSION},500);
    }
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
  async api(path,params={},strict=false){
    if(!this.env.APISPORTS_KEY)throw new Error("APISPORTS_KEY secret is not configured");
    const base=String(this.env.APISPORTS_BASE||"https://v3.football.api-sports.io").replace(/\/$/,"");
    const u=new URL(base+path);
    for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=="")u.searchParams.set(k,String(v));
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
    try{
      const r=await fetch(u,{headers:{"x-apisports-key":this.env.APISPORTS_KEY,"accept":"application/json"},signal:ctl.signal});
      const txt=await r.text();let data={};try{data=JSON.parse(txt)}catch{}
      if(!r.ok)throw new Error(`API HTTP ${r.status}`);
      if(strict&&!Array.isArray(data?.response))throw new Error('EVIDENCE_PROVIDER_INVALID_RESPONSE');
      if(data?.errors&&Object.keys(data.errors).length){if(strict)throw new Error('EVIDENCE_PROVIDER_ERROR');console.log("api warning",JSON.stringify(data.errors).slice(0,500))}
      return data.response||[];
    }finally{clearTimeout(timer)}
  }
  async listWatches(){
    const map=await this.ctx.storage.list({prefix:"watch:"});
    return [...map.values()].filter(Boolean);
  }
  async putWatch(w){await this.ctx.storage.put(`watch:${w.fixture_id}`,w)}
  async removeWatch(id){await this.ctx.storage.delete(`watch:${id}`)}

  // Evidence leases are independent of Smart Follow/TOP and never score signals.
  async evidenceJobs(){return [...(await this.ctx.storage.list({prefix:'evidence:'})).values()]}
  evidenceWork(fn){const task=(this.evidenceChain||Promise.resolve()).then(fn);this.evidenceChain=task.catch(()=>{});return task}
  async registerEvidence(body){
    if(!dbConfigured(this.env))return {ok:false,error:'D1_NOT_CONFIGURED'};
    if(!this.env.APISPORTS_KEY)return {ok:false,error:'APISPORTS_NOT_CONFIGURED'};
    const now=Date.now(),jobs=await this.evidenceJobs(),accepted=[],rejected=[];
    for(const r of (Array.isArray(body?.signals)?body.signals:[]).slice(0,20)){
      const id=Number(r.fixture_id),t0=Number(r.t0),engine=String(r.engine),signal=String(r.id||'');
      if(!Number.isSafeInteger(id)||id<=0||!['FT','H1','HC'].includes(engine)||!signal||signal.length>180||!Number.isFinite(t0)||t0>now+60000||t0+10800000<=now){rejected.push({id:signal,reason:'INVALID_OR_EXPIRED'});continue}
      let job=jobs.find(x=>x.fixture_id===id);
      if(!job){
        if(jobs.filter(x=>x.pending||(!x.done&&x.until>now)).length>=20){rejected.push({id:signal,reason:'CAPACITY'});continue}
        job={fixture_id:id,signals:[],until:0,last_poll:0};jobs.push(job);
      }
      const key=`${engine}:${signal}`;
      if(!job.signals.some(x=>x.key===key)){
        if(job.signals.length>=100){rejected.push({id:signal,reason:'SIGNAL_CAPACITY'});continue}
        job.signals.push({key,id:signal,engine,t0});job.until=Math.max(job.until,t0+10800000);job.done=false;
        // A completed fixture is not restarted by duplicate client registration.
      }
      await this.ctx.storage.put(`evidence:${id}`,job);accepted.push(key);
    }
    await this.ensureAlarm(1000);
    return {ok:true,accepted,rejected,tracking:'SOURCE_CAPTURE_ONLY'};
  }
  async pollEvidence(){
    const now=Date.now(),jobs=await this.evidenceJobs();
    // Oldest-first bounded work; D1 failure retains the exact pending snapshot.
    const due=jobs.filter(j=>j.pending||(!j.done&&j.until>now&&now-Number(j.last_poll||0)>=60000))
      .sort((a,b)=>(a.last_poll||0)-(b.last_poll||0)).slice(0,3);
    for(const j of due){
      try{
        if(!j.pending){
          const fixtures=await this.api('/fixtures',{id:j.fixture_id},true),f=fixtures[0];
          if(!f)throw new Error('EVIDENCE_FIXTURE_UNAVAILABLE');
          const health={score:[f.goals?.home,f.goals?.away].every(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v)))?'OK':'ERROR'};
          const read=async (name,path)=>{try{const rows=await this.api(path,{fixture:j.fixture_id},true);health[name]=rows.length?'OK':'EMPTY';return rows}catch(e){health[name]='ERROR';return []}};
          const [stats,events,odds]=await Promise.all([read('stats','/fixtures/statistics'),read('events','/fixtures/events'),read('odds','/odds/live')]);
          const captured=Date.now(),status=String(f.fixture?.status?.short||'');
          j.pending={id:`EV-${j.fixture_id}-${captured}`,fixture_id:j.fixture_id,source:'EVIDENCE_FOLLOWUP',engine:'EVIDENCE',
            captured_at:captured,minute:f.fixture?.status?.elapsed,status,score_home:f.goals?.home,score_away:f.goals?.away,
            snapshot_kind:'SOURCE_DETAIL',persistence_reason:TERMINAL.has(status)?'TERMINAL_EVIDENCE':'QSIG_FOLLOWUP',
            payload:{fixture:compactFixture(f),stats_raw:compactStats(stats),events_raw:compactEvents(events),odds_raw:compactOdds(odds),
              signals:j.signals,source_health:health,outcome_status:'NOT_EVALUATED'}};
          // Persist before D1: alarms can resume safely after crashes/timeouts.
          await this.ctx.storage.put(`evidence:${j.fixture_id}`,j);
        }
        const p=j.pending,stmt=dbFixtureStmt(this.env,p,now);
        const result=await this.env.FOOTBALL_DB.batch([...(stmt?[stmt]:[]),dbLiveStmt(this.env,p,now)]);
        if(result.some(x=>x.success===false))throw new Error('EVIDENCE_D1_WRITE_FAILED');
        const health=p.payload.source_health,goals=p.payload.events_raw.filter(e=>String(e.type).toLowerCase()==='goal'&&!/miss|cancel|disallow|shootout/i.test(String(e.detail||'')));
        // Terminal scores and event ledger must agree before collection stops.
        j.done=TERMINAL.has(p.status)&&health.score==='OK'&&['OK','EMPTY'].includes(health.events)&&goals.length===Number(p.score_home)+Number(p.score_away);
        j.last_saved=p.captured_at;j.pending=null;j.last_error=null;
      }catch(e){j.last_error=runtimeMessage(e)}
      j.last_poll=Date.now();await this.ctx.storage.put(`evidence:${j.fixture_id}`,j);
    }
    for(const j of jobs){
      // Failed writes remain pending (capacity bounded); never discard unsaved evidence.
      if(!j.pending&&j.until+86400000<now)await this.ctx.storage.delete(`evidence:${j.fixture_id}`);
    }
  }

  // V2 timeline: fixed rotating slots. One snapshot = one row write, no index row.
  snapshotSlotKey(w,snap){
    const focus=w.level==="focus",detail=!!snap.detail;
    const slots=detail?(focus?24:12):(focus?60:30);
    const bucketMs=detail?(focus?30000:120000):60000;
    const slot=Math.floor(Number(snap.captured_at||Date.now())/bucketMs)%slots;
    return `snapshotv2:${w.fixture_id}:${detail?"d":"h"}:${String(slot).padStart(2,"0")}`;
  }
  async appendSnapshot(w,snap){
    const sig=snap.detail?sigDetail(snap):sigFixture(snap.fixture);
    if(snap.detail){
      if(sig&&sig===w.last_detail_sig)return false;
      w.last_detail_sig=sig;
    }else{
      if(sig&&sig===w.last_heartbeat_sig)return false;
      w.last_heartbeat_sig=sig;
    }
    await this.ctx.storage.put(this.snapshotSlotKey(w,snap),snap);
    return true;
  }
  async snapshotsFor(id,since=0,limit=20){
    const lim=Math.max(1,Math.min(60,Number(limit)||20));
    const v2=await this.ctx.storage.list({prefix:`snapshotv2:${id}:`});
    let out=[...v2.values()].filter(Boolean);
    // Backward-compatible read of V1 snapshots only when V2 has no data yet.
    if(!out.length){
      const legacy=await this.ctx.storage.list({prefix:`snapshot:${id}:`});
      out=[...legacy.values()].filter(Boolean);
    }
    out=out.filter(x=>Number(x?.captured_at||0)>Number(since||0));
    out.sort((a,b)=>Number(a.captured_at)-Number(b.captured_at));
    return out.slice(-lim);
  }
  async ensureAlarm(delayMs=null){
    const current=await this.ctx.storage.getAlarm();
    if(current!=null)return current;
    const watches=await this.listWatches(),active=watches.filter(x=>!x.ended&&Number(x.expires_at||0)>Date.now());
    const evidence=(await this.evidenceJobs()).some(j=>j.pending||(!j.done&&j.until>Date.now()));
    if(!active.length&&!evidence)return null;
    const focus=active.some(x=>x.level==="focus");
    const delay=delayMs??(focus?this.cfg("FOCUS_INTERVAL_MS",30000):this.cfg("SCREEN_INTERVAL_MS",60000));
    const at=Date.now()+Math.max(10000,delay);
    await this.ctx.storage.setAlarm(at);return at;
  }
  async register(body){
    const now=Date.now(),input=Array.isArray(body?.fixtures)?body.fixtures:[],
          defaultLevel=body?.level==="focus"?"focus":"screen",
          ttl=Math.max(30,Math.min(720,Number(body?.ttl_minutes)||360))*60000,
          maxActive=Math.max(10,Math.min(200,this.cfg("MAX_ACTIVE_WATCHES",120))),
          maxFocus=Math.max(1,Math.min(40,this.cfg("MAX_FOCUS_WATCHES",16)));
    const current=await this.listWatches();
    const currentMap=new Map(current.map(w=>[String(w.fixture_id),w]));
    let activeCount=current.filter(x=>!x.ended&&Number(x.expires_at||0)>now).length;
    let focusCount=current.filter(x=>!x.ended&&x.level==="focus"&&Number(x.expires_at||0)>now).length;
    let registered=0,written=0,skipped_capacity=0;

    const rows=[...input].sort((a,b)=>((b?.level==="focus")?1:0)-((a?.level==="focus")?1:0));
    for(const x of rows){
      const id=n(x?.fixture_id);
      if(!Number.isFinite(id))continue;
      const old=currentMap.get(String(id))||{};
      const requestedFocus=old.level==="focus"||x.level==="focus"||defaultLevel==="focus";
      if(!old.fixture_id){
        if(activeCount>=maxActive || (requestedFocus&&focusCount>=maxFocus)){skipped_capacity++;continue}
        activeCount++;if(requestedFocus)focusCount++;
      }
      const level=requestedFocus?"focus":"screen";
      const kickoff=n(x.kickoff,old.kickoff||null),naturalExpiry=kickoff?Math.max(now+ttl,(kickoff*1000)+5*3600000):now+ttl;
      const refreshExpiry=Number(old.expires_at||0)<now+Math.floor(ttl*0.35);
      const w={
        ...old,fixture_id:id,level,engine:cleanStr(x.engine||body.engine||old.engine||"SCAN",30),
        home:cleanStr(x.home||old.home),away:cleanStr(x.away||old.away),league:cleanStr(x.league||old.league),
        country:cleanStr(x.country||old.country),kickoff,status:cleanStr(x.status||old.status,20),
        minute:n(x.minute,old.minute||0),registered_at:old.registered_at||now,last_registered_at:now,
        expires_at:refreshExpiry||!old.fixture_id?Math.max(Number(old.expires_at||0),naturalExpiry):Number(old.expires_at||naturalExpiry),ended:false
      };
      const materiallyChanged=!old.fixture_id||watchComparable(old)!==watchComparable(w)||refreshExpiry;
      if(materiallyChanged){await this.putWatch(w);written++}
      currentMap.set(String(id),w);registered++;
    }
    const alarm=await this.ensureAlarm(1000);
    return {ok:true,registered,written,skipped_capacity,active:activeCount,next_alarm:alarm,policy:STORAGE_POLICY};
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
    if(f)return {fixture:f,lookupTouched:false};
    const kickoffMs=Number(w.kickoff||0)*1000,nearKickoff=!kickoffMs||now>=kickoffMs-10*60000;
    const lookupMs=w.level==="focus"?this.cfg("LOOKUP_FOCUS_MS",120000):this.cfg("LOOKUP_SCREEN_MS",300000);
    const lookupDue=nearKickoff&&(now-Number(w.last_lookup_at||0)>=lookupMs);
    if(lookupDue){
      const rows=await this.api("/fixtures",{id:w.fixture_id}).catch(()=>[]);
      w.last_lookup_at=now;
      f=rows?.[0]||null;
      return {fixture:f,lookupTouched:true};
    }
    return {fixture:null,lookupTouched:false};
  }
  async poll(){
    const now=Date.now(),watches=await this.listWatches(),active=[];
    for(const w of watches){
      if(Number(w.expires_at||0)<=now){await this.removeWatch(w.fixture_id);continue}
      if(!w.ended)active.push(w);
    }
    if(!active.length)return {active:0,policy:STORAGE_POLICY};

    const liveRows=await this.api("/fixtures",{live:"all",timezone:this.env.TZ||"Asia/Ho_Chi_Minh"}).catch(()=>[]);
    const liveMap=new Map((liveRows||[]).map(f=>[String(f.fixture?.id),f]));
    const focusDetail=this.cfg("DETAIL_FOCUS_MS",60000),screenDetail=this.cfg("DETAIL_SCREEN_MS",180000),
          maxDetail=Math.max(1,Math.min(12,this.cfg("MAX_DETAIL_PER_TICK",6))),
          persistHeartbeat=Math.max(120000,this.cfg("WATCH_PERSIST_HEARTBEAT_MS",300000));
    const due=[],dirty=new Set();

    for(const w of active){
      const before=watchComparable(w);
      const resolved=await this.resolveFixture(w,liveMap,now),f=resolved.fixture;
      if(resolved.lookupTouched)dirty.add(String(w.fixture_id));
      if(!f){
        if(now-Number(w.last_persist_at||0)>=persistHeartbeat)dirty.add(String(w.fixture_id));
        continue;
      }
      const st=String(f.fixture?.status?.short||"");
      const minute=n(f.fixture?.status?.elapsed,0);
      w.status=st;w.minute=minute;
      // last_seen_at is deliberately throttled to avoid a write every poll.
      if(now-Number(w.last_seen_at||0)>=persistHeartbeat)w.last_seen_at=now;
      if(TERMINAL.has(st)){
        w.ended=true;w.ended_at=w.ended_at||now;w.expires_at=Math.min(Number(w.expires_at||now+3600000),now+3600000);
      }
      const fsig=sigFixture(f);
      const staleHeartbeatMs=w.level==="focus"?300000:600000;
      if(fsig!==w.last_fixture_sig||now-Number(w.last_snapshot_at||0)>=staleHeartbeatMs){
        const snap=await this.heartbeatSnapshot(w,f,now);
        const wrote=await this.appendSnapshot(w,snap);
        if(wrote){w.last_snapshot_at=now;await persistBackgroundLiveSnapshot(this.env,snap,w)}
        w.last_fixture_sig=fsig;
        dirty.add(String(w.fixture_id));
      }
      if(!w.ended&&LIVE.has(st)){
        const detailMs=w.level==="focus"?focusDetail:screenDetail;
        if(now-Number(w.last_detail_at||0)>=detailMs)due.push({w,f,dueAge:now-Number(w.last_detail_at||0)});
      }
      if(before!==watchComparable(w))dirty.add(String(w.fixture_id));
    }

    due.sort((a,b)=>(a.w.level==="focus"?0:1)-(b.w.level==="focus"?0:1)||b.dueAge-a.dueAge);
    const batch=due.slice(0,maxDetail);
    await Promise.all(batch.map(async ({w,f})=>{
      try{
        const snap=await this.detailSnapshot(w,f,Date.now());
        const wrote=await this.appendSnapshot(w,snap);
        w.last_detail_at=snap.captured_at;
        if(wrote){w.last_snapshot_at=snap.captured_at;await persistBackgroundLiveSnapshot(this.env,snap,w)}
        w.last_error=null;w.last_error_at=null;
      }catch(e){
        w.last_error=runtimeMessage(e);w.last_error_at=Date.now();
      }
      dirty.add(String(w.fixture_id));
    }));

    let watchWrites=0;
    for(const w of active){
      const id=String(w.fixture_id);
      if(dirty.has(id)||now-Number(w.last_persist_at||0)>=persistHeartbeat){
        w.last_persist_at=now;
        await this.putWatch(w);watchWrites++;
      }
    }

    const remaining=active.filter(x=>!x.ended&&Number(x.expires_at||0)>Date.now());
    return {active:remaining.length,detail_polled:batch.length,live_feed_count:liveRows.length,watch_writes:watchWrites,policy:STORAGE_POLICY};
  }

  async alarm(){
    try{await this.evidenceWork(()=>this.pollEvidence());await this.poll()}
    catch(e){console.log("background alarm error",e?.stack||e);throw e}
    finally{
      try{
        const watches=await this.listWatches(),active=watches.filter(x=>!x.ended&&Number(x.expires_at||0)>Date.now());
        const evidence=(await this.evidenceJobs()).some(j=>j.pending||(!j.done&&j.until>Date.now()));
        if(active.length||evidence){
          const focus=active.some(x=>x.level==="focus"),delay=focus?this.cfg("FOCUS_INTERVAL_MS",30000):this.cfg("SCREEN_INTERVAL_MS",60000);
          await this.ctx.storage.setAlarm(Date.now()+Math.max(10000,delay));
        }
      }catch(e){console.log("background alarm reschedule error",e?.stack||e);throw e}
    }
  }

  async fetch(request){
    if(request.method==="OPTIONS")return json({ok:true});
    const url=new URL(request.url);
    if(url.pathname==='/api/watch/evidence-register'&&request.method==='POST'){const body=await request.json().catch(()=>({}));return json(await this.evidenceWork(()=>this.registerEvidence(body)))}
    if(url.pathname==='/api/watch/evidence-status'&&request.method==='GET')return json({ok:true,jobs:(await this.evidenceJobs()).map(({pending,...j})=>({...j,pending:!!pending})),tracking:'SOURCE_CAPTURE_ONLY'});
    if(url.pathname==="/api/watch/register"&&request.method==="POST"){
      return json(await this.register(await request.json().catch(()=>({}))));
    }
    if(url.pathname==="/api/watch/list"&&request.method==="GET"){
      const now=Date.now(),watches=await this.listWatches(),alarm=await this.ctx.storage.getAlarm();
      return json({ok:true,watches,active:watches.filter(x=>!x.ended&&Number(x.expires_at||0)>now).length,next_alarm:alarm,worker_version:WORKER_VERSION,policy:STORAGE_POLICY});
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
        snapshots.push(...rows);
      }
      snapshots.sort((a,b)=>Number(a.captured_at)-Number(b.captured_at));
      return json({ok:true,fixtures:ids.length,snapshots});
    }
    if(url.pathname==="/api/watch/poll-now"&&request.method==="POST"){
      return json({ok:true,result:await this.poll()});
    }
    if(url.pathname==="/api/diagnostics"&&request.method==="GET"){
      const watches=await this.listWatches(),now=Date.now();
      return json({
        ok:true,worker_version:WORKER_VERSION,policy:STORAGE_POLICY,
        total_watches:watches.length,
        active:watches.filter(x=>!x.ended&&Number(x.expires_at||0)>now).length,
        focus:watches.filter(x=>!x.ended&&x.level==="focus"&&Number(x.expires_at||0)>now).length,
        next_alarm:await this.ctx.storage.getAlarm()
      });
    }
    return json({error:"Not found"},404);
  }
}
