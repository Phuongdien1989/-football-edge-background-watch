// One-shot, pre-authorized isolated D1 REST measurement. Never a Worker deployment.
// Strict UUID+name allowlist; preserves test schema/data, no deletes, no resets, no provider.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {buildFTObservation} from './observation.mjs';
import {buildFTDecision} from './decision-trace.mjs';
import {resolveFTOutcome} from './outcome.mjs';
import {prepareFTPair,PAIR_INSERT_SQL,PAIR_READ_SQL} from './ft-pair-collector.mjs';
import {verifyFTPairRow,PAIR_PAGE_SQL} from './pair-outcome-replay.mjs';
import {INSERT_SQL,READ_SQL,prepareRecord} from './replay-ledger.mjs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const dbId='e82758f2-e533-44a6-b42d-4821d120e082',dbName='fe-ft-replay-audit-39699021468';
const forbiddenProd='0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4';
const report={at:new Date().toISOString(),commit:process.env.GITHUB_SHA,scope:'ISOLATED_REMOTE_D1_REST_PAIR',production_writes:0,provider_calls:0,deployments:0,scanner_changes:0,queries:[],checks:[],errors:[],status:'NOT_RUN'};
let phase='preflight',calls=0;
mkdirSync('ft-audit-output',{recursive:true});
const save=()=>writeFileSync('ft-audit-output/remote-pair-d1-measurement.json',JSON.stringify(report,null,2));
async function api(path,body){
 assert(calls<35,'MAX_HTTP_CALLS');calls++;
 const expected='/d1/database/'+dbId+'/query';
 if(body)assert(path===expected&&dbId!==forbiddenProd,'WRITE_NOT_ISOLATED');
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+path,
  {method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(18000)});
 const json=await response.json();
 if(!response.ok||!json.success){const e=Error('CF_HTTP_'+response.status);e.detail={phase,status:response.status,codes:(json.errors||[]).map(x=>x.code),messages:(json.errors||[]).map(x=>String(x.message||'').slice(0,250))};throw e;}
 return json;
}
async function query(sql,params=[]){
 assert(report.queries.length<22,'SQL_QUERY_BOUND');
 assert(typeof sql==='string'&&sql.length<2200,'SQL_SIZE_BOUND');
 const result=(await api('/d1/database/'+dbId+'/query',{sql,params})).result[0];
 assert(result&&result.success!==false,'SQL_FAILED');
 const meta=result.meta||{};
 report.queries.push({phase,statement:sql.trim().split(/\s+/).slice(0,5).join(' '),
  rows_read:meta.rows_read??null,rows_written:meta.rows_written??null,changes:meta.changes??null,duration:meta.duration??null});
 const read=report.queries.reduce((v,q)=>v+(q.rows_read||0),0),written=report.queries.reduce((v,q)=>v+(q.rows_written||0),0);
 assert(read<=500&&written<=60,'BILLING_BOUND');
 save();
 return result;
}
const pairTableSQL=`CREATE TABLE ft_replay_pairs_v1 (
 observation_id TEXT PRIMARY KEY,
 fixture_id INTEGER NOT NULL CHECK(fixture_id>0),
 observed_at INTEGER NOT NULL CHECK(observed_at>0),
 decision_at INTEGER NOT NULL CHECK(decision_at>=observed_at),
 content_hash TEXT NOT NULL,
 observation_json TEXT NOT NULL,
 decision_json TEXT NOT NULL
)`;
try{
 assert(account&&token,'CREDENTIALS_MISSING');
 assert(process.env.GITHUB_RUN_ATTEMPT==='1','AUTOMATIC_RERUN_NOT_ALLOWED');
 assert(process.env.FT_PAIR_REMOTE_ONCE==='CONFIRM_ISOLATED','MANUAL_GATE_MISSING');
 const list=(await api('/d1/database?per_page=100&page=1')).result;
 assert(Array.isArray(list)&&list.some(d=>d.uuid===dbId&&d.name===dbName),'DATABASE_IDENTITY_CHANGED');
 report.database={id:dbId,name:dbName,reused:true,retained:true};
 phase='schema_guard';
 const before=await query("SELECT name FROM sqlite_master WHERE type='table' AND name='ft_replay_pairs_v1'");
 assert(before.results.length===0,'ALREADY_MEASURED_DO_NOT_RERUN');
 const pre=await query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('ft_replay_records_v1','ft_replay_budget_v1')");
 assert(pre.results.length===2,'REQUIRED_ISOLATED_TABLES_MISSING');
 phase='pair_schema';
 await query(pairTableSQL);report.checks.push('isolated_pair_table_created');
 const now=Date.now(),f={fixture:{id:42,status:{short:'2H',elapsed:69}},goals:{home:1,away:0}};
 const observation=buildFTObservation({id:'ft3e-remote-20261022',fixture_id:42,decision_at:now-12000,fixture:f,
  sources:{fixture:{status:'OK',received_at:now-13000,data:f}}});
 const decision=buildFTDecision({observation,decision_at:now-11000,state:'NOT_EVALUATED',reason:'SYNTHETIC_REMOTE',source_hash:'c'.repeat(64)});
 const pair=await prepareFTPair(observation,decision,20000);
 phase='pair_insert';const insert=await query(PAIR_INSERT_SQL,[pair.observation_id,pair.fixture_id,pair.observed_at,pair.decision_at,pair.content_hash,pair.observation_json,pair.decision_json]);
 assert(insert.meta?.changes===1,'PAIR_INSERT_FAILED');report.checks.push('pair_inserted');
 phase='pair_verify';const found=(await query('SELECT * FROM ft_replay_pairs_v1 WHERE observation_id=?',[pair.observation_id])).results[0];
 assert.equal((await verifyFTPairRow(found)).status,'VALID_PAIR');report.checks.push('pair_hash_verified');
 phase='pair_duplicate';const retry=await query(PAIR_INSERT_SQL,[pair.observation_id,pair.fixture_id,pair.observed_at,pair.decision_at,pair.content_hash,pair.observation_json,pair.decision_json]);
 assert(retry.meta?.changes===0,'DUPLICATE_WROTE');report.checks.push('pair_duplicate_no_write');
 phase='pair_discovery';const beforeOutcome=(await query(PAIR_PAGE_SQL,['',5])).results;
 assert.equal(beforeOutcome.length,1);assert.equal(beforeOutcome[0].has_outcome,0);
 report.checks.push('pair_discovery_pending');
 const finished={fixture:{id:42,status:{short:'FT'}},goals:{home:2,away:0},score:{fulltime:{home:2,away:0}}};
 const outcome=resolveFTOutcome(observation,finished,now-5000,now-4000);
 const ready=await prepareRecord('OUTCOME',outcome,20000);
 phase='outcome_insert';
 const out=await query(INSERT_SQL,[ready.record_id,ready.kind,ready.observation_id,ready.fixture_id,ready.recorded_at,ready.content_hash,ready.payload_json]);
 assert(out.meta?.changes===1,'OUTCOME_INSERT_FAILED');report.checks.push('regulation_outcome_inserted');
 phase='outcome_verified';const check=(await query(READ_SQL,[ready.record_id])).results[0];
 assert.equal(check?.content_hash,ready.content_hash);report.checks.push('outcome_hash_verified');
 phase='linked_query';const afterOutcome=(await query(PAIR_PAGE_SQL,['',5])).results;
 assert.equal(afterOutcome.length,1);assert.equal(afterOutcome[0].has_outcome,1);
 report.checks.push('pair_outcome_discovery_join');
 report.note='REST insert/read cost measured. Existing budget reservation not modified: NO complete Worker/DO invocation, no account-level quota certification.';
 report.status='PASS';
}catch(error){report.status='FAIL';report.errors.push({message:error.message,detail:error.detail??null});process.exitCode=1;}
finally{
 report.http_calls=calls;report.metrics_by_phase={};
 for(const q of report.queries){const m=report.metrics_by_phase[q.phase]??={statements:0,rows_read:0,rows_written:0};m.statements++;m.rows_read+=q.rows_read??0;m.rows_written+=q.rows_written??0;}
 save();console.log(JSON.stringify(report));
}
