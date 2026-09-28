import base,{BackgroundWatcher as ExistingWatcher} from './worker_notify_v135_full_pause.js';

// FOOTBALL V2 FOUNDATION WRAPPER
// Purpose: expose V2 health/readiness without changing any existing engine,
// scan cadence, notification logic, thresholds or V1 database behavior.
// Branch-only foundation file. Do not point production wrangler.toml here until
// migrations 001 + 002 have been applied and health checks pass.

const V2_WORKER_LAYER='V2_FOUNDATION_0.2';
const V2_SCHEMA_EXPECTED='2.0.0-foundation';

const reply=(data,status=200)=>new Response(JSON.stringify(data),{
  status,
  headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'access-control-allow-origin':'*',
    'access-control-allow-headers':'authorization,content-type',
    'access-control-allow-methods':'GET,POST,OPTIONS'
  }
});

function authorized(request,env){
  return !!env.BACKGROUND_TOKEN &&
    (request.headers.get('authorization')||'')===`Bearer ${env.BACKGROUND_TOKEN}`;
}

async function v1Meta(env,key){
  try{
    const r=await env.FOOTBALL_DB
      .prepare("SELECT value FROM fe_schema_meta WHERE key=? LIMIT 1")
      .bind(key).first();
    return r?.value||null;
  }catch{return null}
}

async function v2Meta(env){
  try{
    return await env.FOOTBALL_DB.prepare(
      "SELECT schema_version,spec_version,applied_at_utc,notes FROM v2_schema_meta WHERE id=1 LIMIT 1"
    ).first()||null;
  }catch{return null}
}

async function safeCount(env,table){
  try{
    const r=await env.FOOTBALL_DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first();
    return Number(r?.n||0);
  }catch{return null}
}

async function v2DbHealth(env){
  if(!env.FOOTBALL_DB){
    return {ok:false,configured:false,v2_ready:false,error:'D1_NOT_CONFIGURED'};
  }
  const meta=await v2Meta(env);
  const counts=meta?{
    leagues:await safeCount(env,'v2_leagues'),
    seasons:await safeCount(env,'v2_seasons'),
    teams:await safeCount(env,'v2_teams'),
    fixtures:await safeCount(env,'v2_fixtures'),
    live_snapshots:await safeCount(env,'v2_live_snapshots'),
    live_team_stats:await safeCount(env,'v2_live_team_stats'),
    dq_snapshots:await safeCount(env,'v2_data_quality_snapshots'),
    state_snapshots:await safeCount(env,'v2_state_snapshots'),
    state_outcomes:await safeCount(env,'v2_state_outcomes')
  }:{};
  const core=await v1Meta(env,'schema_version');
  const history=await v1Meta(env,'history_schema_version');
  return {
    ok:true,
    configured:true,
    layer:V2_WORKER_LAYER,
    mode:'READ_ONLY_FOUNDATION',
    v2_schema_expected:V2_SCHEMA_EXPECTED,
    v2_schema_version:meta?.schema_version||null,
    v2_spec_version:meta?.spec_version||null,
    v2_ready:meta?.schema_version===V2_SCHEMA_EXPECTED,
    v1_core_schema:core,
    v1_history_schema:history,
    v1_preserved:core==='V1.23.1' && history==='V1.23.3',
    counts
  };
}

export class BackgroundWatcher extends ExistingWatcher{}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);

    if(url.pathname==='/api/v2/health'&&request.method==='GET'){
      return reply({
        ok:true,
        layer:V2_WORKER_LAYER,
        mode:'READ_ONLY_FOUNDATION',
        inherited_worker:'worker_notify_v135_full_pause.js',
        production_engines_changed:false,
        production_thresholds_changed:false,
        database_writes_enabled:false
      });
    }

    if(url.pathname==='/api/v2/db/health'&&request.method==='GET'){
      if(!authorized(request,env))return reply({error:'Unauthorized'},401);
      return reply(await v2DbHealth(env));
    }

    return base.fetch(request,env,ctx);
  }
};
