// Phase 3 local concurrent-event pressure test on the ACTUAL FT D1/DO
// recorder. No provider, real Push, production credentials or Cloudflare deploy.
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const out='ft-audit-output/ft-pilot-stress';mkdirSync(out,{recursive:true});
const target=/^compatibility_date\s*=\s*"([^"]+)"/m.exec(readFileSync('wrangler.toml','utf8'))?.[1];
assert.equal(target,'2026-09-11','EXACT_PRODUCTION_DATE_CHANGED');
const logical='f'.repeat(64),now=Date.now(),start=now-3600000,end=now+4*3600000;
const makeOptions=epoch=>({
 modules:true,scriptPath:'ft-pilot/shadow-worker.mjs',
 compatibilityDate:target,compatibilityFlags:['nodejs_compat'],
 durableObjects:{SHADOW_DO:{className:'FTPilotShadowDO',useSQLite:true}},
 d1Databases:{FT_PILOT_DB:'00000000-0000-4000-8000-000000000887'},
 bindings:{FT_PILOT_ENABLED:'true',FT_PILOT_EPOCH:epoch,FT_PILOT_LOGIC_VERSION:logical}
});
const schema=readFileSync('ft-pilot/schema-candidate.sql','utf8')
 .split('\n').filter(x=>!x.trimStart().startsWith('--')).join('\n');
const ddl=[...schema.matchAll(/CREATE TABLE IF NOT EXISTS[\s\S]*?\)\s*(?:WITHOUT ROWID)?;/g),
 ...schema.matchAll(/CREATE TRIGGER IF NOT EXISTS[\s\S]*?END;/g)]
 .sort((a,b)=>a.index-b.index).map(m=>m[0].replace(/\s+/g,' ').trim());
assert.equal(ddl.length,7);
const wait=async fn=>{
 let last;for(let i=0;i<90;i++){
  try{if(await fn())return;}catch(e){last=e;}
  await new Promise(r=>setTimeout(r,35));
 }
 throw Error('WORKERD_STRESS_TIMEOUT '+String(last||''));
};
async function init(mf,epoch){
 const db=await mf.getD1Database('FT_PILOT_DB');
 for(const sql of ddl)await db.prepare(sql).run();
 await db.prepare('INSERT INTO ft_pilot_control_v1 (epoch,enabled,capture_start_ms,capture_end_ms,outcome_end_ms,max_fixtures,max_pair_bytes,max_total_pair_bytes,max_revisions_per_fixture) VALUES (?1,1,?2,?3,?4,5,20000,100000,2)')
 .bind(epoch,start,end,end+72*3600000).run();
 return db;
}
const f=(id,status='2H',h=1,a=1)=>({
 fixture:{id,status:{short:status,elapsed:status==='2H'?70:90}},
 league:{name:'LOCAL STRESS'},teams:{home:{id:id*2},away:{id:id*2+1}},
 goals:{home:h,away:a},score:{halftime:{home:0,away:0},fulltime:status==='FT'?{home:h,away:a}:null}
});
const pair=(id,candidate=false)=>{
 const t=Date.now()-1000;
 return {kind:'PAIR',scan:{fixture:f(id),fixtureReceivedAt:t-200,capturedAt:t,
  health:{stats:'EMPTY',events:'EMPTY',odds:'EMPTY',half:'EMPTY'},
  receipts:{stats:t-150,events:t-140,odds:t-130,half:t-120},
  payloads:{stats:[],events:[],odds:[],half:[]},crossingRequested:candidate,
  decision:{state:'NOT_EVALUATED',reason:'LOCAL_STRESS_SYNTHETIC_NO_STATS'}}};
};
const outcome=(id,h,a)=>({kind:'OUTCOME',fixture:f(id,'FT',h,a),receivedAt:Date.now()-400});
async function dispatch(mf,input){
 const r=await mf.dispatchFetch('http://localhost/event',{method:'POST',
  headers:{'content-type':'application/json'},body:JSON.stringify(input)});
 assert.equal(r.status,200,'LOCAL_SHADOW_EVENT_HTTP_CHANGED');
 const json=await r.json();return json.scheduled?.status;
}
const inspect=async mf=>(await(await mf.dispatchFetch('http://localhost/inspect')).json());
const count=async(db,table)=>(await db.prepare('SELECT COUNT(*) AS n FROM '+table).first()).n;
const report={schema:'FE_FT_PILOT_LOCAL_WORKERD_STRESS_V1',production:false,
 target_compatibility_date:target,cloudflare_account_billed_rows:null,real_cpu_p95:null,
 extra_provider_calls:0,real_push_delivery:false,tests:[]};
const epoch='LOCAL-STRESS-30-EVENTS',opts=makeOptions(epoch),mf=new Miniflare(opts);
try{
 let db=await init(mf,epoch);
 const accepted=await Promise.all(Array.from({length:30},(_,i)=>dispatch(mf,pair(93001+i,i%2===0))));
 assert(accepted.every(x=>x==='SCHEDULED_NON_BLOCKING'),'SIDE_CAR_DISPATCH_BLOCKED');
 await wait(async()=>Boolean((await inspect(mf)).pause));
 const meter=await inspect(mf);
 assert(meter.sql_reserved<=60&&meter.sql_reserved>=0,'SQL_RESERVE_CAP_VIOLATED');
 assert(meter.write_tokens_reserved<=240&&meter.write_tokens_reserved>=0,'WRITE_RESERVE_CAP_VIOLATED');
 const rows=await db.prepare('SELECT fixture_id,class FROM ft_pilot_pairs_v1 WHERE epoch=?1 ORDER BY fixture_id').bind(epoch).all();
 assert(rows.results.length>0&&rows.results.length<=5,'CONCURRENT_FIVE_FIXTURE_LIMIT_BROKEN');
 assert.equal(new Set(rows.results.map(x=>x.fixture_id)).size,rows.results.length,'DUPLICATE_FIXTURE_STORED');
 const classes=Object.groupBy(rows.results,x=>x.class);
 for(const list of Object.values(classes))assert(list.length<=3,'CONCURRENT_SOURCE_CLASS_CAP_BROKEN');
 const stateBefore={count:rows.results.length,ids:rows.results.map(x=>x.fixture_id),
  sql:meter.sql_reserved,writes:meter.write_tokens_reserved};
 await mf.setOptions(opts);db=await mf.getD1Database('FT_PILOT_DB');
 const stateAfter=await inspect(mf);
 assert.equal(await count(db,'ft_pilot_pairs_v1'),stateBefore.count,'STRESS_RESTART_PAIR_CHANGED');
 assert.equal(stateAfter.sql_reserved,stateBefore.sql,'STRESS_RESTART_SQL_RESERVATION_RESET');
 assert.equal(stateAfter.write_tokens_reserved,stateBefore.writes,'STRESS_RESTART_WRITE_RESERVATION_RESET');
 assert.equal(stateAfter.pause,meter.pause,'STRESS_RESTART_LOST_FT_ONLY_PAUSE');
 await dispatch(mf,pair(95099,true));
 await new Promise(r=>setTimeout(r,100));
 assert.equal(await count(db,'ft_pilot_pairs_v1'),stateBefore.count,'STRESS_PAUSE_WROTE_NEW_PAIR');
 report.tests.push({case:'30_parallel_unique_fixtures',posted:30,
  stored_fixtures:stateBefore.count,classes:Object.fromEntries(Object.entries(classes).map(([k,v])=>[k,v.length])),
  paused:stateAfter.pause,sql_reserved:stateAfter.sql_reserved,
  write_tokens_reserved:stateAfter.write_tokens_reserved,
  restart_persistent:true,extra_fixture_blocked:true});
}finally{await mf.dispose();}
const epoch2='LOCAL-STRESS-OUTCOME',mf2=new Miniflare(makeOptions(epoch2));
try{
 const db=await init(mf2,epoch2),id=94111;
 assert.equal(await dispatch(mf2,pair(id,true)),'SCHEDULED_NON_BLOCKING');
 await wait(async()=>(await count(db,'ft_pilot_pairs_v1'))===1);
 const outcomes=await Promise.all(Array.from({length:9},(_,i)=>dispatch(mf2,outcome(id,2+i%3,1))));
 assert(outcomes.every(x=>x==='SCHEDULED_NON_BLOCKING'),'OUTCOME_DISPATCH_NOT_NONBLOCKING');
 await wait(async()=>(await count(db,'ft_pilot_outcomes_v1'))>=1);
 await new Promise(r=>setTimeout(r,200));
 const revisions=await count(db,'ft_pilot_outcomes_v1');
 assert(revisions>=1&&revisions<=2,'PARALLEL_OUTCOME_REVISION_CAP_BROKEN');
 const pairs=await count(db,'ft_pilot_pairs_v1');
 assert.equal(pairs,1,'OUTCOME_CONCURRENCY_MUTATED_PAIR_COUNT');
 report.tests.push({case:'9_parallel_outcome_callback_variants',posted:9,stored_versions:revisions,
  immutable_pair_count:pairs,unmeasured_real_callback_coverage:true});
}finally{await mf2.dispose();}
writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
console.log('FE_FT_PILOT_PHASE3_WORKERD_STRESS_PASS '+JSON.stringify(report));
