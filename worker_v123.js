import base, { BackgroundWatcher } from "./worker_v122.js";
export { BackgroundWatcher };

const WORKER_VERSION = "1.2.3";
const CORE_SCHEMA_VERSION = "V1.23.1";
const HISTORY_SCHEMA_VERSION = "V1.23.3";
const TERMINAL = new Set(["FT","AET","PEN","CANC","ABD","AWD","WO"]);

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
async function count(env,table){try{const r=await env.FOOTBALL_DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first();return Number(r?.n||0)}catch{return null}}
async function meta(env,key){try{const r=await env.FOOTBALL_DB.prepare("SELECT value FROM fe_schema_meta WHERE key=? LIMIT 1").bind(key).first();return r?.value||null}catch{return null}}
async function historyReady(env){return !!env.FOOTBALL_DB&&(await meta(env,'history_schema_version'))===HISTORY_SCHEMA_VERSION}
function resultFor(gf,ga,terminal){if(!terminal||gf==null||ga==null)return {result:null,points:null};if(gf>ga)return {result:'W',points:3};if(gf<ga)return {result:'L',points:0};return {result:'D',points:1}}
function teamStmt(env,id,name,country,logo,now){
  if(!Number.isFinite(n(id)))return null;
  return env.FOOTBALL_DB.prepare(`INSERT INTO teams (team_id,name,country,logo,first_seen_at,last_seen_at)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(team_id) DO UPDATE SET name=COALESCE(excluded.name,teams.name),country=COALESCE(excluded.country,teams.country),logo=COALESCE(excluded.logo,teams.logo),last_seen_at=MAX(teams.last_seen_at,excluded.last_seen_at)`)
    .bind(n(id),s(name)||`Team ${id}`,s(country),s(logo,500),now,now);
}
function fixtureHistoryStmt(env,p,now){
  const terminal=TERMINAL.has(String(p?.status||''))?1:0;
  return env.FOOTBALL_DB.prepare(`INSERT INTO fixture_history
    (fixture_id,league_id,league,country,season,round,kickoff,status,status_long,minute,home_team_id,away_team_id,score_home,score_away,halftime_home,halftime_away,fulltime_home,fulltime_away,home_winner,away_winner,terminal,first_seen_at,last_seen_at,payload_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(fixture_id) DO UPDATE SET league_id=COALESCE(excluded.league_id,fixture_history.league_id),league=COALESCE(excluded.league,fixture_history.league),country=COALESCE(excluded.country,fixture_history.country),season=COALESCE(excluded.season,fixture_history.season),round=COALESCE(excluded.round,fixture_history.round),kickoff=COALESCE(excluded.kickoff,fixture_history.kickoff),status=COALESCE(excluded.status,fixture_history.status),status_long=COALESCE(excluded.status_long,fixture_history.status_long),minute=COALESCE(excluded.minute,fixture_history.minute),home_team_id=COALESCE(excluded.home_team_id,fixture_history.home_team_id),away_team_id=COALESCE(excluded.away_team_id,fixture_history.away_team_id),score_home=COALESCE(excluded.score_home,fixture_history.score_home),score_away=COALESCE(excluded.score_away,fixture_history.score_away),halftime_home=COALESCE(excluded.halftime_home,fixture_history.halftime_home),halftime_away=COALESCE(excluded.halftime_away,fixture_history.halftime_away),fulltime_home=COALESCE(excluded.fulltime_home,fixture_history.fulltime_home),fulltime_away=COALESCE(excluded.fulltime_away,fixture_history.fulltime_away),home_winner=COALESCE(excluded.home_winner,fixture_history.home_winner),away_winner=COALESCE(excluded.away_winner,fixture_history.away_winner),terminal=MAX(fixture_history.terminal,excluded.terminal),last_seen_at=MAX(fixture_history.last_seen_at,excluded.last_seen_at),payload_json=excluded.payload_json`)
    .bind(n(p.fixture_id),n(p.league_id,null),s(p.league),s(p.country),n(p.season,null),s(p.round),n(p.kickoff,null),s(p.status,20),s(p.status_long,80),n(p.minute,null),n(p.home_team_id,null),n(p.away_team_id,null),n(p.score_home,null),n(p.score_away,null),n(p.halftime_home,null),n(p.halftime_away,null),n(p.fulltime_home,null),n(p.fulltime_away,null),n(p.home_winner,null),n(p.away_winner,null),terminal,now,now,payload(p));
}
function teamFixtureStmt(env,p,side,now){
  const home=side==='HOME',teamId=n(home?p.home_team_id:p.away_team_id),oppId=n(home?p.away_team_id:p.home_team_id);if(!Number.isFinite(teamId))return null;
  const gf=n(home?p.score_home:p.score_away,null),ga=n(home?p.score_away:p.score_home,null),terminal=TERMINAL.has(String(p?.status||'')),rp=resultFor(gf,ga,terminal);
  return env.FOOTBALL_DB.prepare(`INSERT INTO team_fixture_history
    (id,fixture_id,team_id,opponent_team_id,venue,league_id,league,season,round,kickoff,status,goals_for,goals_against,result,points,updated_at,payload_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET opponent_team_id=COALESCE(excluded.opponent_team_id,team_fixture_history.opponent_team_id),league_id=COALESCE(excluded.league_id,team_fixture_history.league_id),league=COALESCE(excluded.league,team_fixture_history.league),season=COALESCE(excluded.season,team_fixture_history.season),round=COALESCE(excluded.round,team_fixture_history.round),kickoff=COALESCE(excluded.kickoff,team_fixture_history.kickoff),status=COALESCE(excluded.status,team_fixture_history.status),goals_for=COALESCE(excluded.goals_for,team_fixture_history.goals_for),goals_against=COALESCE(excluded.goals_against,team_fixture_history.goals_against),result=COALESCE(excluded.result,team_fixture_history.result),points=COALESCE(excluded.points,team_fixture_history.points),updated_at=excluded.updated_at,payload_json=excluded.payload_json`)
    .bind(`${p.fixture_id}:${teamId}`,n(p.fixture_id),teamId,Number.isFinite(oppId)?oppId:null,side,n(p.league_id,null),s(p.league),n(p.season,null),s(p.round),n(p.kickoff,null),s(p.status,20),gf,ga,rp.result,rp.points,now,payload(p));
}
async function writeHistory(env,events){
  if(!env.FOOTBALL_DB)return {accepted:0,ignored:(events||[]).length};
  if(!(await historyReady(env)))throw new Error('HISTORY_SCHEMA_NOT_READY');
  const now=Date.now();let accepted=0,ignored=0;
  for(let i=0;i<(events||[]).length;i+=20){
    const stmts=[];
    for(const evt of events.slice(i,i+20)){
      const p=evt?.payload||{};
      if(String(evt?.type||'')!=='FIXTURE_CATALOG'||!Number.isFinite(n(p?.fixture_id))){ignored++;continue}
      const hs=teamStmt(env,p.home_team_id,p.home,p.home_country,p.home_logo,now),as=teamStmt(env,p.away_team_id,p.away,p.away_country,p.away_logo,now);
      if(hs)stmts.push(hs);if(as)stmts.push(as);stmts.push(fixtureHistoryStmt(env,p,now));const htf=teamFixtureStmt(env,p,'HOME',now),atf=teamFixtureStmt(env,p,'AWAY',now);if(htf)stmts.push(htf);if(atf)stmts.push(atf);accepted++;
    }
    if(stmts.length)await env.FOOTBALL_DB.batch(stmts);
  }
  return {accepted,ignored};
}
async function callBase(request,env,ctx,path,body){
  const u=new URL(request.url);u.pathname=path;u.search='';const init={method:body===undefined?request.method:'POST',headers:request.headers};if(body!==undefined)init.body=JSON.stringify(body);return base.fetch(new Request(u.toString(),init),env,ctx)
}
async function rows(env,sql,binds=[]){const st=env.FOOTBALL_DB.prepare(sql).bind(...binds),r=await st.all();return r?.results||[]}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/health'){
      const r=await base.fetch(request,env,ctx),d=await r.json().catch(()=>({}));const hv=env.FOOTBALL_DB?await meta(env,'history_schema_version'):null;
      return json({...d,version:WORKER_VERSION,d1_configured:!!env.FOOTBALL_DB,database_schema_expected:CORE_SCHEMA_VERSION,history_database:true,history_schema_expected:HISTORY_SCHEMA_VERSION,history_schema_version:hv,history_schema_ready:hv===HISTORY_SCHEMA_VERSION},r.status)
    }
    if(url.pathname==='/api/db/sync'&&request.method==='POST'){
      const body=await request.json().catch(()=>({})),events=Array.isArray(body?.events)?body.events:[],hist=events.filter(x=>String(x?.type||'')==='FIXTURE_CATALOG'),rest=events.filter(x=>String(x?.type||'')!=='FIXTURE_CATALOG');
      const br=await callBase(request,env,ctx,'/api/db/sync',{events:rest});if(!br.ok)return br;const bd=await br.json().catch(()=>({ok:false}));
      try{const h=await writeHistory(env,hist);return json({ok:true,accepted:Number(bd.accepted||0)+h.accepted,ignored:Number(bd.ignored||0)+h.ignored,schema_version:bd.schema_version||CORE_SCHEMA_VERSION,history_schema_version:await meta(env,'history_schema_version'),worker_version:WORKER_VERSION})}
      catch(e){return json({ok:false,error:'HISTORY_D1_SYNC_FAILED',message:String(e?.message||e).slice(0,500)},409)}
    }
    if(url.pathname==='/api/db/stats'&&request.method==='GET'){
      const br=await base.fetch(request,env,ctx);if(!br.ok)return br;const d=await br.json().catch(()=>({}));const hv=env.FOOTBALL_DB?await meta(env,'history_schema_version'):null;
      if(env.FOOTBALL_DB){d.teams=await count(env,'teams');d.fixture_history=await count(env,'fixture_history');d.team_fixture_history=await count(env,'team_fixture_history')}
      d.history_schema_version=hv;d.history_schema_ready=hv===HISTORY_SCHEMA_VERSION;d.worker_version=WORKER_VERSION;return json(d)
    }
    if(url.pathname==='/api/db/history-health'&&request.method==='GET'){
      if(!authorized(request,env))return json({error:'Unauthorized'},401);const hv=env.FOOTBALL_DB?await meta(env,'history_schema_version'):null;return json({ok:true,configured:!!env.FOOTBALL_DB,history_schema_version:hv,expected:HISTORY_SCHEMA_VERSION,ready:hv===HISTORY_SCHEMA_VERSION,worker_version:WORKER_VERSION})
    }
    if(url.pathname==='/api/db/teams'&&request.method==='GET'){
      if(!authorized(request,env))return json({error:'Unauthorized'},401);if(!(await historyReady(env)))return json({ok:false,error:'HISTORY_SCHEMA_NOT_READY'},409);const lim=Math.max(1,Math.min(5000,n(url.searchParams.get('limit'),500)||500));return json({ok:true,rows:await rows(env,'SELECT * FROM teams ORDER BY last_seen_at DESC LIMIT ?',[lim])})
    }
    if(url.pathname==='/api/db/fixture-history'&&request.method==='GET'){
      if(!authorized(request,env))return json({error:'Unauthorized'},401);if(!(await historyReady(env)))return json({ok:false,error:'HISTORY_SCHEMA_NOT_READY'},409);const lim=Math.max(1,Math.min(5000,n(url.searchParams.get('limit'),500)||500));return json({ok:true,rows:await rows(env,'SELECT * FROM fixture_history ORDER BY kickoff DESC LIMIT ?',[lim])})
    }
    if(url.pathname==='/api/db/team-history'&&request.method==='GET'){
      if(!authorized(request,env))return json({error:'Unauthorized'},401);if(!(await historyReady(env)))return json({ok:false,error:'HISTORY_SCHEMA_NOT_READY'},409);const teamId=n(url.searchParams.get('team_id'));if(!Number.isFinite(teamId))return json({error:'team_id required'},400);const lim=Math.max(1,Math.min(500,n(url.searchParams.get('limit'),100)||100));return json({ok:true,team_id:teamId,rows:await rows(env,'SELECT * FROM team_fixture_history WHERE team_id=? ORDER BY kickoff DESC LIMIT ?',[teamId,lim])})
    }
    return base.fetch(request,env,ctx)
  }
};
