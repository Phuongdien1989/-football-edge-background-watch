import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {buildFTObservation} from './observation.mjs';
import {buildFTDecision} from './decision-trace.mjs';
import {resolveFTOutcome} from './outcome.mjs';
import {createPersistentCollector} from './persistent-collector.mjs';
import {PAGE_SQL} from './pending-discovery.mjs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const report={at:new Date().toISOString(),commit:process.env.GITHUB_SHA,mode:'ISOLATED_REMOTE_D1',production_writes:0,provider_calls:0,worker_deploys:0,scanner_toggled:false,queries:[],checks:[],versions:{},http_calls:0,errors:[]};
let databaseId=null,databaseName=null,phase='preflight';
mkdirSync('ft-audit-output',{recursive:true});
const save=()=>writeFileSync('ft-audit-output/remote-d1-audit.json',JSON.stringify(report,null,2));
async function api(path,body){
 assert(report.http_calls<70,'HTTP_BOUND');report.http_calls++;
 if(body)assert(path==='/d1/database'||(databaseId&&path==='/d1/database/'+databaseId+'/query'),'WRITE_TARGET_DENIED');
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 const j=await r.json();
 if(!r.ok||!j.success){const e=Error('CF_HTTP_'+r.status);e.details={path:path.replace(account,'ACCOUNT'),status:r.status,codes:(j.errors||[]).map(x=>x.code)};throw e;}
 return j;
}
async function query(sql,params=[]){
 assert(databaseId&&databaseId!=='0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4','ISOLATION_REQUIRED');
 assert(report.queries.length<50,'SQL_BOUND');
 const r=(await api('/d1/database/'+databaseId+'/query',{sql,params})).result[0];assert(r.success!==false,'QUERY_FAILED');
 const m=r.meta||{};
 report.queries.push({phase,statement:sql.trim().split(/\s+/).slice(0,4).join(' '),rows_read:m.rows_read??null,rows_written:m.rows_written??null,changes:m.changes??null,duration:m.duration??null});
 save();
 assert(report.queries.reduce((n,x)=>n+(x.rows_read||0),0)<=2000,'READ_MEASUREMENT_BOUND');
 assert(report.queries.reduce((n,x)=>n+(x.rows_written||0),0)<=300,'WRITE_MEASUREMENT_BOUND');
 return r;
}
const db={prepare(sql){return {bind(...args){return {async first(){return (await query(sql,args)).results?.[0]||null;},async run(){return query(sql,args);},async all(){return query(sql,args);}};}};}};
try{
 assert(account&&token,'CLOUDFLARE_CREDENTIALS_MISSING');
 assert(process.env.GITHUB_RUN_ATTEMPT==='1','NO_AUTOMATIC_RERUN');
 for(const name of ['football-edge-background-watch','shiny-silence-d892','football-edge-desktop-b2-test']){
  const d=(await api('/workers/scripts/'+name+'/deployments')).result;
  report.versions[name]=d.deployments?.[0]?.versions??null;
 }
 report.rollback_exists=(await api('/workers/scripts/football-edge-background-watch/versions/7e4bb3b7-2dc6-4f0d-8c8a-9d8e6da2440a')).result.id==='7e4bb3b7-2dc6-4f0d-8c8a-9d8e6da2440a';
 const listed=await api('/d1/database?per_page=100&page=1');
 assert(Array.isArray(listed.result),'INVALID_DATABASE_LIST');
 report.existing_database_count=listed.result_info?.total_count??listed.result.length;
 assert(report.existing_database_count<10&&listed.result.length<10,'FREE_DATABASE_CAPACITY_UNCONFIRMED');
 assert(/^\d+$/.test(process.env.GITHUB_RUN_ID||''),'RUN_ID_REQUIRED');
 databaseName='fe-ft-replay-audit-'+process.env.GITHUB_RUN_ID;
 assert(!listed.result.some(x=>x.name===databaseName),'TEST_DATABASE_ALREADY_EXISTS');
 const created=(await api('/d1/database',{name:databaseName,primary_location_hint:'apac'})).result;
 assert(created.name===databaseName&&/^[a-f0-9-]{36}$/.test(created.uuid),'TEST_DATABASE_IDENTITY');
 assert(!listed.result.some(x=>x.uuid===created.uuid),'EXISTING_DATABASE_RETURNED');
 databaseId=created.uuid;report.test_database={id:databaseId,name:databaseName,retained:true};save();
 phase='schema';
 for(const f of ['replay-ledger.sql','persistent-budget.sql','pending-index.sql'])await query(readFileSync(new URL('./'+f,import.meta.url),'utf8'));
 const now=Date.now();
 await query('INSERT INTO ft_replay_budget_v1(id,window_start,window_end,max_records,max_bytes) VALUES(1,?,?,6,200000)',[now-1000,now+600000]);
 const f=(home,status='2H')=>({fixture:{id:42,status:{short:status}},goals:{home,away:0},score:{fulltime:{home,away:0}}});
 const observation=buildFTObservation({id:'remote-observation',fixture_id:42,decision_at:now,fixture:f(1)});
 const collector=()=>createPersistentCollector(db,{enabled:true,maxRecordBytes:20000});
 phase='observation';assert.equal((await collector().capture(observation)).status,'STORED');report.checks.push('observation_stored');
 const decision=buildFTDecision({observation,decision_at:now,state:'NOT_EVALUATED',reason:'SYNTHETIC_TEST',source_hash:'a'.repeat(64)});
 phase='decision';assert.equal((await collector().append('DECISION',decision)).status,'STORED');report.checks.push('decision_link_stored');
 const outcome=resolveFTOutcome(observation,f(2,'FT'),Date.now(),Date.now());
 phase='outcome';assert.equal((await collector().append('OUTCOME',outcome)).status,'STORED');report.checks.push('outcome_stored');
 phase='exact_retry';assert.equal((await collector().append('OUTCOME',outcome)).status,'DUPLICATE');report.checks.push('exact_retry_dedup');
 phase='correction';const correction=resolveFTOutcome(observation,f(1,'FT'),Date.now(),Date.now());assert.equal((await collector().append('OUTCOME',correction)).status,'STORED');report.checks.push('correction_appended');
 phase='discovery';const page=(await query(PAGE_SQL,['',5])).results;assert.equal(page.length,1);assert.equal(page[0].has_decision,1);assert.equal(page[0].has_outcome,1);report.checks.push('indexed_discovery');
 phase='concurrency';const concurrent=await Promise.all(Array.from({length:8},(_,i)=>collector().capture({...observation,id:'concurrent-'+i})));assert.equal(concurrent.filter(x=>x.status==='STORED').length,1);assert.equal(concurrent.filter(x=>x.status==='BUDGET_DENIED').length,7);report.checks.push('eight_contenders_one_slot');
 phase='verification';
 const budget=(await query('SELECT used_records FROM ft_replay_budget_v1 WHERE id=1')).results[0];assert.equal(budget.used_records,6);
 report.record_counts=(await query('SELECT kind,COUNT(*) AS count FROM ft_replay_records_v1 GROUP BY kind')).results;
 assert.equal(report.record_counts.reduce((n,x)=>n+x.count,0),5);report.checks.push('revision_preservation_and_budget');
 report.status='PASS';
}catch(e){report.status='FAIL';report.errors.push({message:e.message,details:e.details??null});process.exitCode=1;}
finally{
 report.metrics_by_phase={};
 for(const q of report.queries){const t=report.metrics_by_phase[q.phase]??={statements:0,rows_read:0,rows_written:0,unknown_metrics:0};t.statements++;if(q.rows_read==null||q.rows_written==null)t.unknown_metrics++;t.rows_read+=q.rows_read||0;t.rows_written+=q.rows_written||0;}
 report.warning='Remote D1 REST only; not remote Worker/DO execution, football data, or invocation-limit acceptance. Synthetic test DB retained; no deletion.';
 save();console.log(JSON.stringify(report));
}
