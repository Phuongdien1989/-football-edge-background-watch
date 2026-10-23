// Workerd local-ONLY integration test. Uses real Miniflare D1 and SQLite-DO
// transaction APIs instead of mock D1 responses or a mock DO Map.
// Does NOT emulate actual API-Football, REAL Push, Cloudflare billable quota,
// scanner schedules or production latency.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {Miniflare} from 'miniflare';
const root='ft-audit-output/ft-pilot-shadow';
mkdirSync(root,{recursive:true});
const epoch='LOCAL-MINIFLARE-FT-REVIEW',logic='e'.repeat(64);
const now=Date.now(),start=now-3600000,end=now+4*3600000;
// Exact-date test is opt-in. Original v4 local shadow stays at 2026-08-01.
const shadowDate=process.env.FT_PILOT_SHADOW_COMPAT_DATE||'2026-08-01';
const targetDate=/^compatibility_date\s*=\s*"([0-9-]+)"/m.exec(readFileSync('wrangler.toml','utf8'))?.[1];
assert(targetDate,'PRODUCTION_DATE_MISSING');
if(process.env.FT_PILOT_REQUIRE_EXACT_COMPAT==='true')
 assert.equal(shadowDate,targetDate,'RUNTIME_COMPATIBILITY_DATE_MISMATCH');
const miniflareVersion=JSON.parse(readFileSync('node_modules/miniflare/package.json','utf8')).version;
const opts=on=>({
 modules:true,scriptPath:'ft-pilot/shadow-worker.mjs',
 // Miniflare v4 test binary currently supports <=2026-08-06 (not the\n // production Worker date 2026-09-11). This is a compatibility LIMIT.\n compatibilityDate:shadowDate,compatibilityFlags:['nodejs_compat'],
 durableObjects:{SHADOW_DO:{className:'FTPilotShadowDO',useSQLite:true}},
 d1Databases:{FT_PILOT_DB:'00000000-0000-4000-8000-000000000123'},
 bindings:{FT_PILOT_ENABLED:on?'true':'false',FT_PILOT_EPOCH:epoch,
  FT_PILOT_LOGIC_VERSION:logic}
});
let assertions=0;const test=(condition,why)=>{assert(condition,why);assertions++};
const mf=new Miniflare(opts(true));
let db;
const dbCount=async table=>(await db.prepare('SELECT COUNT(*) AS n FROM '+table).first()).n;
const fixture=(id,status='2H',elapsed=70,home=1,away=1)=>({
 fixture:{id,status:{short:status,elapsed}},
 league:{name:'SHADOW LOCAL ONLY',country:'QA'},
 teams:{home:{id:id*2,name:'Home'},away:{id:id*2+1,name:'Away'}},
 goals:{home,away},
 score:{halftime:{home:0,away:0},fulltime:null}
});
function scan(id,accepted=false,missing=false){
 const t=Date.now()-20000;
 return {kind:'PAIR',scan:{
  fixture:fixture(id),fixtureReceivedAt:t-100,capturedAt:t,
  health:{stats:missing?'EMPTY':'OK',events:'EMPTY',odds:'OK',half:'EMPTY'},
  receipts:{stats:t-80,events:t-70,odds:t-60,half:t-50},
  payloads:{stats:missing?[]:[{team:{id:id*2},statistics:[{type:'Shots on Goal',value:4}]},
   {team:{id:id*2+1},statistics:[{type:'Shots on Goal',value:2}]}],
   events:[],odds:[{fixture:{id},odds:[{id:5,name:'Over/Under',values:[
    {value:'Over',handicap:2.5,odd:1.92},
    {value:'Under',handicap:2.5,odd:1.96}
   ]}]}],half:[]},
  crossingRequested:accepted,
  decision:missing?{state:'NOT_EVALUATED',reason:'STATS_UNAVAILABLE'}:
   {state:'EVALUATED',decision_at:t+10,evaluation:{score:70,scoreMode:'FULL'},
    market_rows:[],devices:[]}
 }};
}
function result(id,h=2,a=1){
 return {kind:'OUTCOME',receivedAt:Date.now()-1000,
  fixture:{...fixture(id,'FT',90,h,a),score:{fulltime:{home:h,away:a}}}};
}
async function dispatch(body){
 const res=await mf.dispatchFetch('http://localhost/event',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 test(res.status===200,'SHADOW_DO_HTTP_'+res.status);
 return res.json();
}
async function eventually(fn,limitMs=2500){
 const t=Date.now();let error=null;
 while(Date.now()-t<limitMs){
  try{if(await fn())return;}catch(e){error=e;}
  await new Promise(resolve=>setTimeout(resolve,35));
 }
 throw Error('LOCAL_D1_EVENT_NOT_FINISHED '+String(error||''));
}
const report={engine:'LOCAL_MINIFLARE_WORKERD',production:false,
 deployed:false,remote_fetches:0,additional_provider_requests:0,
 target_compatibility_date:targetDate,test_compatibility_date:shadowDate,
 exact_date_tested:targetDate===shadowDate,miniflare_version:miniflareVersion,
 migration_production:false,scanner_started:false,checks:[],
 actual_cloudflare_rows_written:null,actual_production_cpu_ms:null};
try{
 db=await mf.getD1Database('FT_PILOT_DB');
 // D1 exec() treats each newline as a separate query. Submit the known,
 // review-only CREATE TABLE/TRIGGER statements intact through prepare().run().
 // The production schema is never touched.
 const migration=readFileSync('ft-pilot/schema-candidate.sql','utf8')
  .split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n');
 const statements=[
  ...migration.matchAll(/CREATE TABLE IF NOT EXISTS[\s\S]*?\)\s*(?:WITHOUT ROWID)?;/g),
  ...migration.matchAll(/CREATE TRIGGER IF NOT EXISTS[\s\S]*?END;/g)
 ].sort((a,b)=>a.index-b.index).map(m=>m[0].replace(/\s+/g,' ').trim());
 test(statements.length===7,'EXPECTED_THREE_TABLES_FOUR_IMMUTABILITY_TRIGGERS');
 for(const statement of statements)await db.prepare(statement).run();
 await db.prepare(`INSERT INTO ft_pilot_control_v1
 (epoch,enabled,capture_start_ms,capture_end_ms,outcome_end_ms,max_fixtures,
 max_pair_bytes,max_total_pair_bytes,max_revisions_per_fixture)
 VALUES (?1,1,?2,?3,?4,5,20000,100000,2)`).bind(epoch,start,end,end+72*3600000).run();
 report.checks.push('LOCAL_SQLITE_SCHEMA_MIGRATION_OK');
 test((await dbCount('ft_pilot_pairs_v1'))===0,'EMPTY_LOCAL_PAIRS');
 const t0=performance.now();
 const first=await dispatch(scan(76001,true));
 test(first.scheduled?.status==='SCHEDULED_NON_BLOCKING','PAIR_NOT_SCHEDULED');
 await eventually(async()=>(await dbCount('ft_pilot_pairs_v1'))===1);
 const elapsed=performance.now()-t0;
 const pair=await db.prepare('SELECT class,observation_json,content_hash FROM ft_pilot_pairs_v1 WHERE fixture_id=76001').first();
 test(pair?.class==='RECOMMENDATION_CANDIDATE','CANDIDATE_ROW_CLASS');
 const obs=JSON.parse(pair.observation_json);
 test(obs.sources.odds.status==='OK'&&obs.sources.odds.data?.[0]?.odds?.[0]?.values?.[0]?.odd===1.92,'UNMODIFIED_SOURCE_ODDS');
 report.checks.push('ONE_ATOMIC_IMMUTABLE_PAIR_REAL_LOCAL_D1');
 await dispatch(scan(76001,false)); // restart-safe duplicate identity
 await new Promise(resolve=>setTimeout(resolve,60));
 test((await dbCount('ft_pilot_pairs_v1'))===1,'DUPLICATE_PAIR_AFTER_CALLBACK');
 report.checks.push('SAME_FIXTURE_DENIED_VIA_D1_PRIMARY_KEY');
 for(const [id,classFlag,isMissing] of [[76002,false,false],[76003,true,false],
  [76004,false,true],[76005,false,false]]){
  await dispatch(scan(id,classFlag,isMissing));
  await eventually(async()=>(await dbCount('ft_pilot_pairs_v1'))===id-76000);
 }
 test((await dbCount('ft_pilot_pairs_v1'))===5,'FIVE_PAIR_LIMIT');
 await dispatch(scan(76006,true));
 await new Promise(resolve=>setTimeout(resolve,70));
 test((await dbCount('ft_pilot_pairs_v1'))===5,'SIXTH_DISTINCT_FIXTURE_STORED');
 const totals=await db.prepare('SELECT class, COUNT(*) AS n FROM ft_pilot_pairs_v1 GROUP BY class').all();
 test(totals.results.length===2,'BALANCED_BOTH_SOURCE_CLASSES');
 report.checks.push('FIVE_DISTINCT_FT_FIXTURES_AND_TWO_CLASSES_LIMITED');
 // Miniflare restarts the local Workerd instance, preserving the same
 // ephemeral D1/DO storage. Re-acquire invalidated D1 proxy after reload.
 const reserveBefore=await (await mf.dispatchFetch('http://localhost/inspect')).json();
 await mf.setOptions(opts(true));
 db=await mf.getD1Database('FT_PILOT_DB');
 const reserveAfter=await (await mf.dispatchFetch('http://localhost/inspect')).json();
 test(reserveAfter.sql_reserved===reserveBefore.sql_reserved,'DURABLE_SQL_CAP_RESET_ON_RELOAD');
 test(reserveAfter.write_tokens_reserved===reserveBefore.write_tokens_reserved,'DURABLE_WRITE_BUDGET_RESET_ON_RELOAD');
 test((await dbCount('ft_pilot_pairs_v1'))===5,'PAIR_PERSISTENCE_LOST_ON_RELOAD');
 await dispatch(scan(76001,false));
 await new Promise(resolve=>setTimeout(resolve,75));
 test((await dbCount('ft_pilot_pairs_v1'))===5,'RESTART_DUPLICATE_STORED');
 report.checks.push('LOCAL_WORKERD_RELOAD_PRESERVES_D1_AND_DO_LIMITS');
 const oldPair=await db.prepare('SELECT content_hash,observation_json FROM ft_pilot_pairs_v1 WHERE fixture_id=76001').first();
 let updateRejected=false,deleteRejected=false;
 try{await db.prepare("UPDATE ft_pilot_pairs_v1 SET content_hash=?1 WHERE fixture_id=76001").bind('f'.repeat(64)).run();}
 catch{updateRejected=true;}
 try{await db.prepare('DELETE FROM ft_pilot_pairs_v1 WHERE fixture_id=76001').run();}
 catch{deleteRejected=true;}
 test(updateRejected&&deleteRejected,'REAL_D1_TRIGGER_ALLOW_MUTATION');
 const still=await db.prepare('SELECT content_hash,observation_json FROM ft_pilot_pairs_v1 WHERE fixture_id=76001').first();
 test(oldPair.content_hash===still.content_hash&&oldPair.observation_json===still.observation_json,
  'IMMUTABLE_PAIR_CONTENT_CHANGED');
 report.checks.push('ACTUAL_D1_SQLITE_TRIGGERS_REJECT_UPDATE_DELETE');
 const t1=performance.now();
 await dispatch(result(76001,2,1));
 await eventually(async()=>(await dbCount('ft_pilot_outcomes_v1'))===1);
 await dispatch(result(76001,3,1)); // correction, append-only
 await eventually(async()=>(await dbCount('ft_pilot_outcomes_v1'))===2);
 const revisions=await db.prepare('SELECT score_home FROM ft_pilot_outcomes_v1 WHERE fixture_id=76001 ORDER BY observed_at').all();
 test(revisions.results.length===2,'OUTCOME_APPEND_ONLY');
 await dispatch(result(76001,4,1)); // third revision blocked
 await new Promise(resolve=>setTimeout(resolve,75));
 test((await dbCount('ft_pilot_outcomes_v1'))===2,'OUTCOME_MORE_THAN_TWO_REVISIONS');
 report.checks.push('PASSIVE_OUTCOMES_AND_CORRECTIONS_IN_LOCAL_D1');
 const prior=await db.prepare('SELECT observation_json FROM ft_pilot_pairs_v1 WHERE fixture_id=76001').first();
 test(prior.observation_json===pair.observation_json,'OBSERVATION_MUTATED');
 const inspect=await (await mf.dispatchFetch('http://localhost/inspect')).json();
 test(inspect.sql_reserved>0&&inspect.sql_reserved<=60,'DO_RESERVATION_SQL_BUDGET_NOT_APPLIED');
 test(inspect.write_tokens_reserved>0&&inspect.write_tokens_reserved<=240,'DO_RESERVATION_WRITE_BUDGET_NOT_APPLIED');
 report.checks.push('DURABLE_OBJECT_SQL_AND_WRITE_TOKEN_RESERVATION');
 report.measured_local_workerd={first_pair_elapsed_ms:Math.round(elapsed*100)/100,
  passive_outcome_elapsed_ms:Math.round((performance.now()-t1)*100)/100,
  reserved_sql:inspect.sql_reserved,reserved_write_tokens:inspect.write_tokens_reserved};
 report.sample_counts={fixtures:await dbCount('ft_pilot_pairs_v1'),
  regulation_outcome_versions:await dbCount('ft_pilot_outcomes_v1')};
}finally{await mf.dispose();}
const off=new Miniflare(opts(false));
try{
 const r=await off.dispatchFetch('http://localhost/event',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(scan(88111,false))});
 const v=await r.json();
 test(v.scheduled?.status==='DISABLED','OFF_WITHOUT_SCHEMA_SHOULD_BE_INERT');
 const d=await off.getD1Database('FT_PILOT_DB');
 const x=await d.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='ft_pilot_pairs_v1'").first();
 test(x.n===0,'OFF_CREATED_SCHEMA');
 report.checks.push('DEFAULT_OFF_NO_DB_SCHEMA_OR_PROVIDER');
}finally{await off.dispose();}
// Fault-test a separate fully isolated local Workerd instance whose D1 lacks
// the pilot schema. An ON sidecar must pause itself; no scanner or Push exists.
const failed=new Miniflare(opts(true));
try{
 const r=await failed.dispatchFetch('http://localhost/event',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(scan(99001,false))
 });
 test(r.status===200,'SHADOW_D1_FAILURE_CHANGED_WORKER_RESPONSE');
 test((await r.json()).scheduled.status==='SCHEDULED_NON_BLOCKING','SHADOW_D1_FAILURE_ABORTED_HANDLER');
 let why;
 await eventually(async()=>{
  const st=await (await failed.dispatchFetch('http://localhost/inspect')).json();
  why=st.pause;return typeof why==='string';
 });
 test(why==='D1_ERROR_PAUSED'||why.includes('D1'),'MISSING_FT_ONLY_PAUSE_ON_D1_FAILURE');
 report.checks.push('REAL_WORKERD_D1_SCHEMA_ABSENT_FAIL_CLOSED_FT_ONLY');
}finally{await failed.dispose();}
report.assertions=assertions;
writeFileSync(root+'/report.json',JSON.stringify(report,null,2));
console.log('FE_FT_PILOT_WORKERD_SHADOW_PASS '+JSON.stringify({
 assertions,steps:report.checks,local:report.sample_counts,
 compatibility_date:shadowDate,exact_date_tested:targetDate===shadowDate,
 product_cpu_measured:false,actual_cloudflare_billed_measured:false,
 prod_schema_changes:0,prod_deploys:0,scanner_calls:0
}));
