// PR #6: identical synthetic events on original & patched SQL, cloud D1 meta per statement.
// WRITES ONLY to dedicated, prefixed test tables in B05A STAGING D1; NEVER production.
// No fixture/user data, credential output, deletes, cleanup, or production deployment.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const BASE='d73d4b19a069b0b2aed7e2687f27f1820f50e3d1';
const STAGE='7d503048-9118-4b29-b662-4e1ba6e32167';
const PROD='0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4';
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
assert.ok(token&&account&&STAGE!==PROD,'safe staging credentials and database required');
const run=String(process.env.GITHUB_RUN_ID||'').replace(/\D/g,'').slice(-7);
assert.ok(run.length>4,'a unique GitHub Actions run ID is required');
// Match the *actual* production schema and index layout, not assumed SQL files.
const schemas=['schema_v1231.sql','schema_v1233_history.sql'].map(f=>readFileSync(f,'utf8')).join('\n');
const allowedTables=['fe_schema_meta','fixtures','entry_decisions','entry_outcomes','live_snapshots','qsig_results','validation_results','teams','fixture_history','team_fixture_history','fe_notify_live_state'];
const names=[...new Set([...schemas.matchAll(/CREATE (?:TABLE|INDEX) IF NOT EXISTS\s+(\w+)/gi)].map(m=>m[1]).concat(allowedTables))].sort((a,b)=>b.length-a.length);
const ren=(sql,prefix)=>names.reduce((s,name)=>s.replace(new RegExp('\\b'+name+'\\b','g'),prefix+name),sql);
async function queryDb(db,sql,params=[]){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/d1/database/'+db+'/query',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({sql,params}),signal:AbortSignal.timeout(30000)});
 const body=await r.json();
 if(!r.ok||body.success===false||!Array.isArray(body.result)||body.result[0]?.success===false)throw Error('D1_SQL_FAILED_HTTP_'+r.status+'_CODES_'+(body.errors||[]).map(e=>e.code).join(','));
 const out=body.result[0];if(typeof out.meta?.rows_written!=='number')throw Error('D1_META_ROWS_WRITTEN_MISSING');
 return out;
}
const query=(sql,params=[])=>queryDb(STAGE,sql,params);
const data=(await queryDb(PROD,"SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index') AND sql IS NOT NULL")).results||[];
const sourceTables=data.filter(r=>r.type==='table'&&allowedTables.includes(r.name));
const sourceIndexes=data.filter(r=>r.type==='index'&&allowedTables.includes(r.tbl_name));
for(const row of sourceIndexes)if(!names.includes(row.name))names.push(row.name);
names.sort((a,b)=>b.length-a.length);
assert.equal(sourceTables.length,allowedTables.length,'production test tables missing: index parity impossible');
const indexesNormalized=rows=>rows.map(r=>JSON.stringify([r.tbl_name,r.name])).sort();
const originalIndexKeys=indexesNormalized(sourceIndexes);
async function setup(prefix){
 for(const row of sourceTables)await query(ren(row.sql,prefix));
 for(const row of sourceIndexes)await query(ren(row.sql,prefix));
 const created=(await query("SELECT name,tbl_name FROM sqlite_master WHERE type='index' AND tbl_name LIKE ?",[prefix+'%'])).results||[];
 const actual=indexesNormalized(created.filter(r=>!r.name.startsWith('sqlite_autoindex')).map(r=>({name:r.name.replace(prefix,''),tbl_name:r.tbl_name.replace(prefix,'')})));
 assert.deepEqual(actual,originalIndexKeys,'staging index names/layout must match production exactly');
 await query("INSERT INTO "+prefix+"fe_schema_meta(key,value,updated_at) VALUES('schema_version','V1.23.1',1),('history_schema_version','V1.23.3',1)");
}
const source=(version,file)=>version==='base'?execFileSync('git',['show',BASE+':'+file],{encoding:'utf8'}):readFileSync(file,'utf8');
const context={Number,String,Math,Date,JSON,Set,Error,Response,URL,Request,Map,console,n:(v,d=null)=>Number.isFinite(Number(v))?Number(v):d,cleanStr:(v,max=120)=>v==null?null:String(v).slice(0,max)};
function getFn(version,file,start,end,expression){
 const s=source(version,file),a=s.indexOf(start),b=s.indexOf(end,a);
 assert.ok(a>=0&&b>a,'source boundary missing '+file);
 return vm.runInNewContext(s.slice(a,b)+'\n'+expression,{...context});
}
const event=(type,payload)=>({type,payload});
const catalog={fixture_id:987654321,home_team_id:9811,away_team_id:9812,home:'Synthetic Home',away:'Synthetic Away',league_id:90,league:'Synthetic League',season:2026,status:'1H',minute:21,score_home:0,score_away:0};
const output={schema:'FE_D1_SYNC_STAGING_INDEX_MATCH_V2',run,db_role:'B05A_STAGING_ONLY',db_id:STAGE,production_db_id:PROD,production_deploy:false,production_rows_modified:0,source_commit_base:BASE,variants:{}};
async function bench(version){
 const prefix='q16'+(version==='base'?'a':'b')+run+'_';await setup(prefix);
 const steps={},env={};let label='none';
 const tally=(result,sql)=>{if(!/^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(sql))return;const r=steps[label]??={sqlite_changes:0,d1_rows_written:0,write_statements:0};r.sqlite_changes+=Number(result.meta.changes||0);r.d1_rows_written+=Number(result.meta.rows_written);r.write_statements++};
 const db={prepare(sql){let params=[];return {bind(...v){params=v;return this},async run(){const s=ren(sql,prefix),r=await query(s,params);tally(r,s);return r},async all(){const r=await query(ren(sql,prefix),params);return {results:r.results}},async first(){const r=await query(ren(sql,prefix),params);return r.results[0]||null}}},async batch(stmts){const out=[];for(const st of stmts)out.push(await st.run());return out}};
 env.FOOTBALL_DB=db;
 const sync=getFn(version,'worker.js','function dbConfigured','async function dbRows','dbWriteEvents');
 const smart=getFn(version,'worker.js','function dbConfigured','async function dbRows','({dbFixtureStmt,dbLiveStmt})');
 const history=getFn(version,'worker_v123.js','const WORKER_VERSION','async function callBase','writeHistory');
 const evidence=getFn(version,'worker_v122.js','const WORKER_VERSION','async function rows','writeEvidence');
 const step=async (key,fn)=>{label=key;await fn()};
 const cat=p=>history(env,[event('FIXTURE_CATALOG',p)]);
 await step('catalog_first',()=>cat(catalog));
 await step('catalog_retry_ack_lost',()=>cat(catalog));
 // Age persisted observation one hour; replay the identical old provider content.
 const oldObservedAt=Date.now()-3600000;
 await query('UPDATE '+prefix+'fixture_history SET last_seen_at=? WHERE fixture_id=?',[oldObservedAt,catalog.fixture_id]);
 await step('catalog_identical_replay_after_1h',()=>cat(catalog));
 const observed=(await query('SELECT last_seen_at FROM '+prefix+'fixture_history WHERE fixture_id=?',[catalog.fixture_id])).results[0].last_seen_at;
 if(version==='patch')assert.equal(observed,oldObservedAt,'stale identical replay must not advance provider freshness');
 await step('catalog_changed_score',()=>cat({...catalog,minute:22,score_home:1}));
 const orderedFixture={...catalog,fixture_id:987654322,home_team_id:9831,away_team_id:9832,source_revision:1,status:'1H',minute:24,score_home:0,score_away:0};
 const orderedFinal={...orderedFixture,source_revision:2,status:'FT',minute:90,score_home:1,score_away:0,fulltime_home:1,fulltime_away:0};
 await step('fixture_order_first',()=>cat(orderedFixture));
 await step('fixture_order_new_terminal',()=>cat(orderedFinal));
 await step('fixture_order_old_retry',()=>cat(orderedFixture));
 const orderedHistory=(await query("SELECT status,minute,score_home,score_away,terminal FROM "+prefix+"fixture_history WHERE fixture_id=?",[orderedFixture.fixture_id])).results[0];
 const fixtureOrderingSafe=orderedHistory.status==='FT'&&orderedHistory.minute===90&&orderedHistory.score_home===1&&orderedHistory.score_away===0&&orderedHistory.terminal===1;
 if(version==='patch')assert.ok(fixtureOrderingSafe,'older catalog revision must not rewrite terminal metadata');
 // A legitimate *higher* producer revision can reopen/restate final status.
 const validFixtureCorrection={...orderedFixture,source_revision:3,status:'2H',minute:89,score_home:0,score_away:0};
 await step('fixture_order_newer_correction',()=>cat(validFixtureCorrection));
 await step('fixture_order_previous_terminal_retry',()=>cat(orderedFinal));
 const newerFixture=(await query("SELECT status,minute,score_home,score_away,terminal FROM "+prefix+"fixture_history WHERE fixture_id=?",[orderedFixture.fixture_id])).results[0];
 const newerFixtureSafe=newerFixture.status==='2H'&&newerFixture.minute===89&&newerFixture.score_home===0&&newerFixture.score_away===0&&newerFixture.terminal===0;
 if(version==='patch')assert.ok(newerFixtureSafe,'legitimate revision-3 fixture correction must prevail, including 0 score and reopened state');
 const legacyCatalog={...catalog,fixture_id:987654323,home_team_id:9841,away_team_id:9842,status:'FT',minute:90,score_home:0,score_away:0};
 await step('fixture_legacy_terminal',()=>cat(legacyCatalog));
 await step('fixture_legacy_old_1h',()=>cat({...legacyCatalog,status:'1H',minute:30}));
 const legacyHistory=(await query("SELECT status,minute,terminal FROM "+prefix+"fixture_history WHERE fixture_id=?",[legacyCatalog.fixture_id])).results[0];
 const legacyFixtureSafe=legacyHistory.status==='FT'&&legacyHistory.minute===90&&legacyHistory.terminal===1;
 if(version==='patch')assert.ok(legacyFixtureSafe,'unversioned terminal fixture cannot regress to first half');


 const q={id:'SYN-Q',fixture_id:catalog.fixture_id,engine:'FT',captured_at:1000,outcome:'PENDING'};
 await step('evidence_first',()=>evidence(env,[event('QSIG_RESULT',q)]));
 await step('evidence_retry',()=>evidence(env,[event('QSIG_RESULT',q)]));
 await step('evidence_settle',()=>evidence(env,[event('QSIG_RESULT',{...q,outcome:'HIT'})]));
 const v={id:'SYN-V',fixture_id:catalog.fixture_id,source:'AUTO',captured_at:2000,outcome:'PENDING'};
 await step('validation_first',()=>evidence(env,[event('VALIDATION_RESULT',v)]));
 await step('validation_retry',()=>evidence(env,[event('VALIDATION_RESULT',v)]));
 await step('validation_settle',()=>evidence(env,[event('VALIDATION_RESULT',{...v,outcome:'MISS'})]));
 const e={id:'SYN-E',fixture_id:catalog.fixture_id,engine:'FT',captured_at:3000,minute:0,entry_score:{home:0,away:0},policy_status:'WATCH',resolution:'PENDING'};
 await step('entry_first',()=>sync(env,[event('ENTRY_DECISION',e)]));
 await step('entry_retry',()=>sync(env,[event('ENTRY_DECISION',e)]));
 await step('entry_settle',()=>sync(env,[event('ENTRY_DECISION',{...e,policy_status:'ENTER',resolution:'RESOLVED',outcome:'HIT',resolved_at:4000})]));
 // Out-of-order ENTRY: valid outcome correction must supersede old payload.
 const oldDecision={...e,id:'SYN-E-ORDER',source_revision:1,policy_status:'WATCH',resolution:'OPEN'};
 const resultOne={...oldDecision,resolution:'RESOLVED',policy_status:'ENTER',outcome:'HIT',resolved_at:5000};
 const corrected={...resultOne,source_revision:2,outcome:'MISS',unit_pl:0,resolved_at:5000};
 await step('entry_order_first_resolved',()=>sync(env,[event('ENTRY_DECISION',resultOne)]));
 await step('entry_order_valid_correction',()=>sync(env,[event('ENTRY_DECISION',corrected)]));
 await step('entry_order_old_resolved_retry',()=>sync(env,[event('ENTRY_DECISION',resultOne)]));
 await step('entry_order_old_open_retry',()=>sync(env,[event('ENTRY_DECISION',oldDecision)]));
 // A later revision attempting to reopen resolved ENTRY must be held until
 // there is an explicit outcome invalidation/compensation protocol.
 const reopening={...corrected,source_revision:3,resolution:'OPEN',outcome:null,unit_pl:null};
 await step('entry_order_reopen_not_supported',()=>sync(env,[event('ENTRY_DECISION',reopening)]));
 const orderedEntry=(await query("SELECT resolution,outcome,unit_pl FROM "+prefix+"entry_decisions WHERE id='SYN-E-ORDER'")).results[0];
 const orderedOutcome=(await query("SELECT outcome,unit_pl FROM "+prefix+"entry_outcomes WHERE decision_id='SYN-E-ORDER'")).results[0];
 const orderingEntrySafe=orderedEntry.resolution==='RESOLVED'&&orderedEntry.outcome==='MISS'&&orderedEntry.unit_pl===0;
 const orderingOutcomeSafe=orderedOutcome.outcome==='MISS'&&orderedOutcome.unit_pl===0;
 if(version==='patch')assert.ok(orderingEntrySafe&&orderingOutcomeSafe,'out-of-order ENTRY/outcome must not regress corrected result');
 // Old Mobile has no producer revision. We can protect terminal lifecycle,
 // but still allow a RESOLVED outcome correction with same resolved_at.
 const legacyEntry={...e,id:'SYN-LEGACY-E',resolution:'RESOLVED',outcome:'HIT',unit_pl:1,resolved_at:5100};
 await step('entry_legacy_resolved',()=>sync(env,[event('ENTRY_DECISION',legacyEntry)]));
 await step('entry_legacy_old_open',()=>sync(env,[event('ENTRY_DECISION',{...legacyEntry,resolution:'OPEN',outcome:null,unit_pl:null,resolved_at:null})]));
 const legacyAfterOpen=(await query("SELECT resolution,outcome FROM "+prefix+"entry_decisions WHERE id='SYN-LEGACY-E'")).results[0];
 const legacyLifecycleSafe=legacyAfterOpen.resolution==='RESOLVED'&&legacyAfterOpen.outcome==='HIT';
 if(version==='patch')assert.ok(legacyLifecycleSafe,'old Mobile OPEN retry cannot reverse settled ENTRY');
 const legacyCorrection={...legacyEntry,outcome:'MISS',unit_pl:0};
 await step('entry_legacy_valid_correction',()=>sync(env,[event('ENTRY_DECISION',legacyCorrection)]));
 const legacyAfterCorrection=(await query("SELECT resolution,outcome,unit_pl FROM "+prefix+"entry_decisions WHERE id='SYN-LEGACY-E'")).results[0];
 const legacyOutcomeCorrection=(await query("SELECT outcome,unit_pl FROM "+prefix+"entry_outcomes WHERE decision_id='SYN-LEGACY-E'")).results[0];
 const legacyCorrectionSafe=legacyAfterCorrection.resolution==='RESOLVED'&&legacyAfterCorrection.outcome==='MISS'&&legacyAfterCorrection.unit_pl===0&&legacyOutcomeCorrection.outcome==='MISS'&&legacyOutcomeCorrection.unit_pl===0;
 if(version==='patch')assert.ok(legacyCorrectionSafe,'unversioned same-resolved-at correction must not be blocked by receiver time');


 const l={id:'SYN-L',fixture_id:catalog.fixture_id,source:'APP',captured_at:3100,minute:22,status:'1H',score_home:1};
 await step('app_live_first',()=>sync(env,[event('LIVE_SNAPSHOT',l)]));
 await step('app_live_retry',()=>sync(env,[event('LIVE_SNAPSHOT',l)]));
 await step('app_live_new_stats',()=>sync(env,[event('LIVE_SNAPSHOT',{...l,minute:23,payload:{stats:{sot:8}}})]));
 await step('app_unknown_when_scan_off',()=>sync(env,[event('IGNORED',{fixture_id:catalog.fixture_id})]));
 const bg={id:'BG-SYN',fixture_id:catalog.fixture_id,source:'BACKGROUND',engine:'SCAN',snapshot_kind:'SOURCE_DETAIL',captured_at:5000,minute:23,status:'1H',score_home:1,score_away:0,persistence_reason:'PERIODIC_5M',payload:{stats:{sot:8}}};
 const sf=p=>db.batch([smart.dbFixtureStmt(env,p,5000),smart.dbLiveStmt(env,p,5000)]);
 await step('smart_first',()=>sf(bg));
 await step('smart_retry',()=>sf(bg));
 await step('smart_status_change',()=>sf({...bg,status:'2H',minute:46,payload:{stats:{sot:10}}}));
 const raw=source(version,'worker_notify_v137_quota50000.js'),a=raw.indexOf('  d1LiveEnabled(){'),b=raw.indexOf('  async reserveApiCall(){',a);
 assert.ok(a>0&&b>a,'Notify worker method boundaries');
 const methods=raw.slice(a,b).replace(/\}\n  async /g,'},\n  async ');
 const legacy=new Map(),storage={async get(k){return legacy.get(k)},async put(k,v){legacy.set(k,v)},async delete(k){legacy.delete(k)},async list(){return new Map([...legacy].filter(([k])=>k.startsWith('notify:match:')))}};
 const watcher=enabled=>{const o=vm.runInNewContext('({'+methods+'})',context);o.env={FOOTBALL_DB:db,LIVE_STATE_D1_ENABLED:String(enabled)};o.ctx={storage};return o};
 const state={id:catalog.fixture_id,lastAt:8000,history:[{minute:23}],alerts:{'qa:h1':{lastSent:111}}};
 await step('notify_first',()=>watcher(true).putNotifyMatch(catalog.fixture_id,state));
 await step('notify_retry',()=>watcher(true).putNotifyMatch(catalog.fixture_id,state));
 await step('notify_new',()=>watcher(true).putNotifyMatch(catalog.fixture_id,{...state,lastAt:8500,history:[...state.history,{minute:24}]}));
 await step('notify_restart_read',async()=>assert.ok(await watcher(true).getNotifyMatch(catalog.fixture_id)));
 await step('notify_off_fallback',()=>watcher(false).putNotifyMatch(123,{id:123}));
 await step('notify_tombstone',()=>watcher(true).deleteNotifyMatch(catalog.fixture_id));
 await step('notify_tombstone_retry',()=>watcher(true).deleteNotifyMatch(catalog.fixture_id));
 const final={};for(const t of ['fixtures','teams','fixture_history','team_fixture_history','qsig_results','validation_results','entry_decisions','entry_outcomes','live_snapshots','fe_notify_live_state']){const r=await query('SELECT COUNT(*) AS n FROM '+prefix+t);final[t]=Number(r.results?.[0]?.n||0)}
 assert.equal(final.fixture_history,3);
 assert.equal(final.teams,6,'all three fixtures historical teams retained');
 assert.equal(final.team_fixture_history,6,'all team fixture side records retained');
 const historyCheck=(await query("SELECT minute,status,score_home,score_away,terminal FROM "+prefix+"fixture_history WHERE fixture_id=?",[catalog.fixture_id])).results[0];
 assert.equal(historyCheck.minute,22);assert.equal(historyCheck.score_home,1);assert.equal(historyCheck.score_away,0);assert.equal(historyCheck.terminal,0);
 const homeCheck=(await query("SELECT goals_for,goals_against FROM "+prefix+"team_fixture_history WHERE team_id=?",[catalog.home_team_id])).results[0];
 assert.equal(homeCheck.goals_for,1);assert.equal(homeCheck.goals_against,0);
 const entryCheck=(await query("SELECT policy_status,resolution,outcome,minute,score_home,score_away,captured_at FROM "+prefix+"entry_decisions WHERE id='SYN-E'")).results[0];
 assert.equal(entryCheck.resolution,'RESOLVED');assert.equal(entryCheck.outcome,'HIT');assert.equal(entryCheck.captured_at,3000);assert.equal(entryCheck.minute,0);assert.equal(entryCheck.score_home,0);assert.equal(entryCheck.score_away,0);
 const o=(await query("SELECT outcome,resolved_at FROM "+prefix+"entry_outcomes WHERE decision_id='SYN-E'")).results[0];
 assert.equal(o.outcome,'HIT');assert.equal(o.resolved_at,4000);
 output.variants[version]={steps,final,entry_integrity:entryCheck,outcome_integrity:o,history_integrity:historyCheck,team_history_integrity:homeCheck,ordering:{entrySafe:orderingEntrySafe,outcomeSafe:orderingOutcomeSafe,fixtureSafe:fixtureOrderingSafe,entry:orderedEntry,outcome:orderedOutcome,fixture:orderedHistory,revision3CorrectionSafe:newerFixtureSafe,legacyFixtureSafe,legacyLifecycleSafe,legacyCorrectionSafe}};
}
await bench('base');await bench('patch');
assert.deepEqual(output.variants.base.entry_integrity,output.variants.patch.entry_integrity,'ENTRY logical integrity differs');
assert.deepEqual(output.variants.base.outcome_integrity,output.variants.patch.outcome_integrity,'OUTCOME logical integrity differs');
assert.deepEqual(output.variants.base.history_integrity,output.variants.patch.history_integrity,'fixture history changed');
assert.deepEqual(output.variants.base.team_history_integrity,output.variants.patch.team_history_integrity,'team history changed');
assert.ok(!output.variants.base.ordering.entrySafe||!output.variants.base.ordering.outcomeSafe||!output.variants.base.ordering.fixtureSafe,'baseline must reproduce at least one out-of-order regression');
const a=output.variants.base.steps,b=output.variants.patch.steps;
output.comparison=Object.keys({...a,...b}).map(k=>({source:k,first_or_retry:/retry/.test(k)?'RETRY':'FIRST_OR_CHANGED',baseline_sqlite_changes:a[k]?.sqlite_changes||0,patched_sqlite_changes:b[k]?.sqlite_changes||0,baseline_d1_rows_written:a[k]?.d1_rows_written||0,patched_d1_rows_written:b[k]?.d1_rows_written||0}));
output.totals=output.comparison.reduce((o,r)=>({baseline_sqlite_changes:o.baseline_sqlite_changes+r.baseline_sqlite_changes,patched_sqlite_changes:o.patched_sqlite_changes+r.patched_sqlite_changes,baseline_d1_rows_written:o.baseline_d1_rows_written+r.baseline_d1_rows_written,patched_d1_rows_written:o.patched_d1_rows_written+r.patched_d1_rows_written}),{baseline_sqlite_changes:0,patched_sqlite_changes:0,baseline_d1_rows_written:0,patched_d1_rows_written:0});
output.totals.staging_d1_reduction_pct=100*(1-output.totals.patched_d1_rows_written/output.totals.baseline_d1_rows_written);
writeFileSync('d1-staging-meter-results.json',JSON.stringify(output,null,2)+'\n');
console.log('D1_STAGING_AB_METRICS '+JSON.stringify({db_id:STAGE,totals:output.totals,per_source:output.comparison}));

console.log('D1_STAGING_ACTUAL_INDEX_PARITY '+JSON.stringify({indexes:sourceIndexes.length,tables:sourceTables.length,matched:true,productionRowsModified:0}));
