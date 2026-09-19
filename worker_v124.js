import base, { BackgroundWatcher } from "./worker_v123.js";
export { BackgroundWatcher };

const WORKER_VERSION = "1.2.4";
const CORE_SCHEMA_VERSION = "V1.23.1";
const HISTORY_SCHEMA_VERSION = "V1.23.3";

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
function authorized(request,env){return !!env.BACKGROUND_TOKEN&&(request.headers.get("authorization")||"")===`Bearer ${env.BACKGROUND_TOKEN}`}
async function rows(env,sql,binds=[]){
  try{const r=await env.FOOTBALL_DB.prepare(sql).bind(...binds).all();return {ok:true,rows:r?.results||[]}}
  catch(e){return {ok:false,rows:[],error:String(e?.message||e).slice(0,300)}}
}
async function scalar(env,sql,binds=[]){
  try{return await env.FOOTBALL_DB.prepare(sql).bind(...binds).first()||{}}
  catch{return {}}
}
async function meta(env,key){
  try{const r=await env.FOOTBALL_DB.prepare("SELECT value FROM fe_schema_meta WHERE key=? LIMIT 1").bind(key).first();return r?.value||null}
  catch{return null}
}
async function analyticsOverview(env){
  if(!env.FOOTBALL_DB)return {ok:false,error:'D1_NOT_CONFIGURED'};
  const [entryPolicy,entryEngine,priceZone,behavior,qsig,validation,topTeams,recent,counters]=await Promise.all([
    rows(env,`SELECT COALESCE(policy_status,'UNKNOWN') AS label, COUNT(*) AS n,
      SUM(CASE WHEN resolution='RESOLVED' THEN 1 ELSE 0 END) AS resolved,
      ROUND(SUM(CASE WHEN resolution='RESOLVED' THEN COALESCE(unit_pl,0) ELSE 0 END),4) AS total_unit_pl,
      ROUND(AVG(CASE WHEN resolution='RESOLVED' THEN unit_pl END),4) AS avg_unit_pl,
      ROUND(AVG(price),4) AS avg_price, ROUND(AVG(edge),4) AS avg_edge
      FROM entry_decisions GROUP BY COALESCE(policy_status,'UNKNOWN') ORDER BY n DESC`),
    rows(env,`SELECT COALESCE(engine,'UNKNOWN') AS label, COUNT(*) AS n,
      SUM(CASE WHEN resolution='RESOLVED' THEN 1 ELSE 0 END) AS resolved,
      ROUND(SUM(CASE WHEN resolution='RESOLVED' THEN COALESCE(unit_pl,0) ELSE 0 END),4) AS total_unit_pl,
      ROUND(AVG(CASE WHEN resolution='RESOLVED' THEN unit_pl END),4) AS avg_unit_pl
      FROM entry_decisions GROUP BY COALESCE(engine,'UNKNOWN') ORDER BY n DESC`),
    rows(env,`SELECT COALESCE(price_zone,'UNKNOWN') AS label, COUNT(*) AS n,
      SUM(CASE WHEN resolution='RESOLVED' THEN 1 ELSE 0 END) AS resolved,
      ROUND(SUM(CASE WHEN resolution='RESOLVED' THEN COALESCE(unit_pl,0) ELSE 0 END),4) AS total_unit_pl,
      ROUND(AVG(price),4) AS avg_price, ROUND(AVG(edge),4) AS avg_edge
      FROM entry_decisions GROUP BY COALESCE(price_zone,'UNKNOWN') ORDER BY n DESC`),
    rows(env,`SELECT COALESCE(behavior_state,'UNKNOWN') AS label, COUNT(*) AS n,
      SUM(CASE WHEN resolution='RESOLVED' THEN 1 ELSE 0 END) AS resolved,
      ROUND(SUM(CASE WHEN resolution='RESOLVED' THEN COALESCE(unit_pl,0) ELSE 0 END),4) AS total_unit_pl
      FROM entry_decisions GROUP BY COALESCE(behavior_state,'UNKNOWN') ORDER BY n DESC`),
    rows(env,`SELECT COALESCE(engine,'UNKNOWN') AS engine, COUNT(*) AS n,
      SUM(CASE WHEN outcome='HIT' THEN 1 ELSE 0 END) AS hit,
      SUM(CASE WHEN outcome='MISS' THEN 1 ELSE 0 END) AS miss,
      SUM(CASE WHEN outcome IS NOT NULL THEN 1 ELSE 0 END) AS resolved,
      ROUND(100.0*SUM(CASE WHEN outcome='HIT' THEN 1 ELSE 0 END)/NULLIF(SUM(CASE WHEN outcome IN ('HIT','MISS') THEN 1 ELSE 0 END),0),1) AS hit_rate
      FROM qsig_results GROUP BY COALESCE(engine,'UNKNOWN') ORDER BY n DESC`),
    rows(env,`SELECT COALESCE(validation_type,'UNKNOWN') AS validation_type, COALESCE(result_key,'UNRESOLVED') AS result_key, COUNT(*) AS n
      FROM validation_results GROUP BY COALESCE(validation_type,'UNKNOWN'),COALESCE(result_key,'UNRESOLVED') ORDER BY n DESC LIMIT 80`),
    rows(env,`SELECT t.team_id,t.name,COUNT(h.id) AS matches,
      SUM(CASE WHEN h.result='W' THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN h.result='D' THEN 1 ELSE 0 END) AS draws,
      SUM(CASE WHEN h.result='L' THEN 1 ELSE 0 END) AS losses,
      SUM(COALESCE(h.goals_for,0)) AS goals_for,SUM(COALESCE(h.goals_against,0)) AS goals_against
      FROM teams t LEFT JOIN team_fixture_history h ON h.team_id=t.team_id
      GROUP BY t.team_id,t.name ORDER BY matches DESC,t.last_seen_at DESC LIMIT 20`),
    Promise.all([
      scalar(env,"SELECT MAX(captured_at) AS ts FROM entry_decisions"),
      scalar(env,"SELECT MAX(signal_at) AS ts FROM qsig_results"),
      scalar(env,"SELECT MAX(created_at) AS ts FROM validation_results"),
      scalar(env,"SELECT MAX(last_seen_at) AS ts FROM fixture_history")
    ]),
    Promise.all([
      scalar(env,"SELECT COUNT(*) AS n FROM entry_decisions"),scalar(env,"SELECT COUNT(*) AS n FROM live_snapshots"),
      scalar(env,"SELECT COUNT(*) AS n FROM qsig_results"),scalar(env,"SELECT COUNT(*) AS n FROM validation_results"),
      scalar(env,"SELECT COUNT(*) AS n FROM teams"),scalar(env,"SELECT COUNT(*) AS n FROM fixture_history"),
      scalar(env,"SELECT COUNT(*) AS n FROM team_fixture_history"),scalar(env,"SELECT COUNT(*) AS n FROM fixture_history WHERE terminal=1")
    ])
  ]);
  return {
    ok:true,worker_version:WORKER_VERSION,generated_at:Date.now(),
    schema_version:await meta(env,'schema_version'),history_schema_version:await meta(env,'history_schema_version'),
    counts:{entries:Number(counters[0]?.n||0),live:Number(counters[1]?.n||0),qsig:Number(counters[2]?.n||0),validation:Number(counters[3]?.n||0),teams:Number(counters[4]?.n||0),fixtures:Number(counters[5]?.n||0),team_history:Number(counters[6]?.n||0),terminal_fixtures:Number(counters[7]?.n||0)},
    recent:{entry:Number(recent[0]?.ts||0),qsig:Number(recent[1]?.ts||0),validation:Number(recent[2]?.ts||0),fixture:Number(recent[3]?.ts||0)},
    entry_policy:entryPolicy.rows,entry_engine:entryEngine.rows,price_zone:priceZone.rows,market_behavior:behavior.rows,
    qsig:qsig.rows,validation:validation.rows,top_teams:topTeams.rows,
    query_health:{entry_policy:entryPolicy.ok,entry_engine:entryEngine.ok,price_zone:priceZone.ok,market_behavior:behavior.ok,qsig:qsig.ok,validation:validation.ok,top_teams:topTeams.ok}
  };
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/health'){
      const r=await base.fetch(request,env,ctx),d=await r.json().catch(()=>({}));
      return json({...d,version:WORKER_VERSION,analytics_database:true,analytics_mode:'READ_ONLY',analytics_schema_change:false},r.status);
    }
    if(url.pathname==='/api/db/analytics/overview'&&request.method==='GET'){
      if(!authorized(request,env))return json({error:'Unauthorized'},401);
      try{return json(await analyticsOverview(env))}
      catch(e){return json({ok:false,error:'DATABASE_ANALYTICS_FAILED',message:String(e?.message||e).slice(0,500)},500)}
    }
    return base.fetch(request,env,ctx);
  }
};
