import base, { BackgroundWatcher } from "./worker.js";
export { BackgroundWatcher };

const WORKER_VERSION = "1.2.2";
const DB_SCHEMA_VERSION = "V1.23.1";

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
function s(v,max=180){return v==null?null:String(v).slice(0,max)}
function payload(v){try{return JSON.stringify(v??null)}catch{return null}}
function authorized(request,env){return !!env.BACKGROUND_TOKEN&&(request.headers.get("authorization")||"")===`Bearer ${env.BACKGROUND_TOKEN}`}
async function count(env,table){try{const r=await env.FOOTBALL_DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first();return Number(r?.n||0)}catch{return null}}
function fixtureStmt(env,p,now){
  const fid=n(p?.fixture_id);if(!Number.isFinite(fid))return null;
  return env.FOOTBALL_DB.prepare(`INSERT INTO fixtures (fixture_id,league,home,away,kickoff,status,first_seen_at,last_seen_at)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(fixture_id) DO UPDATE SET league=COALESCE(excluded.league,fixtures.league),home=COALESCE(excluded.home,fixtures.home),away=COALESCE(excluded.away,fixtures.away),kickoff=COALESCE(excluded.kickoff,fixtures.kickoff),status=COALESCE(excluded.status,fixtures.status),last_seen_at=MAX(fixtures.last_seen_at,excluded.last_seen_at)`)
    .bind(fid,s(p?.league),s(p?.home),s(p?.away),n(p?.kickoff,null),s(p?.status,20),now,now);
}
function qsigOutcome(p){
  if(p?.outcome!=null)return s(p.outcome,60);const e=String(p?.engine||'').toUpperCase();
  if(e==='FT'&&typeof p?.goal_10m==='boolean')return p.goal_10m?'HIT':'MISS';
  if(e==='H1'&&typeof p?.goal_5m==='boolean')return p.goal_5m?'HIT':'MISS';
  if(e==='HC'&&p?.state_15m!=null)return s(p.state_15m,60);return null;
}
function qsigStmt(env,p,now){
  return env.FOOTBALL_DB.prepare(`INSERT INTO qsig_results (id,fixture_id,engine,signal_at,resolved_at,outcome,payload_json)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET engine=excluded.engine,signal_at=excluded.signal_at,resolved_at=excluded.resolved_at,outcome=excluded.outcome,payload_json=excluded.payload_json`)
    .bind(s(p?.id),n(p?.fixture_id),s(p?.engine,20),n(p?.t0??p?.signal_at??p?.captured_at,now),n(p?.resolved_at??p?.closed_at,null),qsigOutcome(p),payload(p));
}
function validationStmt(env,p,now){
  const result=p?.outcome!=null?p.outcome:(typeof p?.hit==='boolean'?(p.hit?'HIT':'MISS'):(p?.resolution||null));
  return env.FOOTBALL_DB.prepare(`INSERT INTO validation_results (id,fixture_id,validation_type,created_at,result_key,payload_json)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET fixture_id=excluded.fixture_id,validation_type=excluded.validation_type,created_at=excluded.created_at,result_key=excluded.result_key,payload_json=excluded.payload_json`)
    .bind(s(p?.id),n(p?.fixture_id,null),s(p?.source||p?.sample_type||p?.engine||'VALIDATION',60),n(p?.captured_at??p?.created_at,now),s(result,80),payload(p));
}
async function writeEvidence(env,events){
  if(!env.FOOTBALL_DB)return {accepted:0,ignored:(events||[]).length};
  const now=Date.now();let accepted=0,ignored=0;
  for(let i=0;i<(events||[]).length;i+=20){
    const stmts=[];
    for(const evt of events.slice(i,i+20)){
      const p=evt?.payload||{},type=String(evt?.type||'');
      if(type==='QSIG_RESULT'&&p?.id&&Number.isFinite(n(p?.fixture_id))){const fs=fixtureStmt(env,p,now);if(fs)stmts.push(fs);stmts.push(qsigStmt(env,p,now));accepted++}
      else if(type==='VALIDATION_RESULT'&&p?.id){stmts.push(validationStmt(env,p,now));accepted++}
      else ignored++;
    }
    if(stmts.length)await env.FOOTBALL_DB.batch(stmts);
  }
  return {accepted,ignored};
}
async function rows(env,table,orderCol,limit){
  const lim=Math.max(1,Math.min(10000,Number(limit)||2000));
  const r=await env.FOOTBALL_DB.prepare(`SELECT * FROM ${table} ORDER BY ${orderCol} DESC LIMIT ?`).bind(lim).all();
  return r?.results||[];
}
async function baseRequest(request,env,urlPath,body){
  const u=new URL(request.url);u.pathname=urlPath;u.search='';
  const init={method:body===undefined?'GET':'POST',headers:request.headers};if(body!==undefined)init.body=JSON.stringify(body);
  return base.fetch(new Request(u.toString(),init),env);
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/health'){
      const r=await base.fetch(request,env,ctx);const d=await r.json().catch(()=>({}));
      return json({...d,version:WORKER_VERSION,d1_configured:!!env.FOOTBALL_DB,database_schema_expected:DB_SCHEMA_VERSION,evidence_database:true},r.status);
    }
    if(url.pathname==='/api/db/sync'&&request.method==='POST'){
      const body=await request.json().catch(()=>({})),events=Array.isArray(body?.events)?body.events:[];
      const core=events.filter(x=>!['QSIG_RESULT','VALIDATION_RESULT'].includes(String(x?.type||'')));
      const evidence=events.filter(x=>['QSIG_RESULT','VALIDATION_RESULT'].includes(String(x?.type||'')));
      const br=await baseRequest(request,env,'/api/db/sync',{events:core});if(!br.ok)return br;
      const bd=await br.json().catch(()=>({ok:false}));
      try{const ev=await writeEvidence(env,evidence);return json({ok:true,accepted:Number(bd.accepted||0)+ev.accepted,ignored:Number(bd.ignored||0)+ev.ignored,schema_version:bd.schema_version||DB_SCHEMA_VERSION,worker_version:WORKER_VERSION})}
      catch(e){return json({ok:false,error:'EVIDENCE_D1_SYNC_FAILED',message:String(e?.message||e).slice(0,500)},500)}
    }
    if(url.pathname==='/api/db/stats'&&request.method==='GET'){
      const br=await base.fetch(request,env,ctx);if(!br.ok)return br;const d=await br.json().catch(()=>({}));
      if(env.FOOTBALL_DB){d.qsig_results=await count(env,'qsig_results');d.validation_results=await count(env,'validation_results')}
      d.worker_version=WORKER_VERSION;return json(d);
    }
    if(['/api/db/qsig','/api/db/validation','/api/db/export/qsig','/api/db/export/validation'].includes(url.pathname)){
      if(!authorized(request,env))return json({error:'Unauthorized'},401);if(!env.FOOTBALL_DB)return json({ok:false,error:'D1_NOT_CONFIGURED'},503);
      try{
        const isQ=url.pathname.includes('qsig'),table=isQ?'qsig_results':'validation_results',order=isQ?'signal_at':'created_at',rr=await rows(env,table,order,url.searchParams.get('limit')||(url.pathname.includes('/export/')?10000:2000));
        return json({ok:true,schema:isQ?'QSIG_EXPORT_V1.23.2':'VALIDATION_EXPORT_V1.23.2',exported_at:new Date().toISOString(),rows:rr});
      }catch(e){return json({ok:false,error:'D1_READ_FAILED',message:String(e?.message||e).slice(0,500)},500)}
    }
    return base.fetch(request,env,ctx);
  }
};
