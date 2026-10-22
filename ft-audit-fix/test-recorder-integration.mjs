import {reserveScanAttempt} from './shared-api-budget.mjs';
import {runPendingFT,PAGE_SQL} from './pending-discovery.mjs';
import {runFTOutcomePass,OUTCOME_BUDGET_KEY} from './outcome-pass.mjs';
import {recordFTDecision} from './decision-trace.mjs';
import {recordFTScan} from './worker-recorder.mjs';
import {beginFTReplaySqlInvocation,ftReplaySqlRemaining} from './replay-sql-budget.mjs';
import {planFTCaptureBatch} from './capture-plan.mjs';
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {observeFT,observeFTStats,observeFTRedEvents,observeFTCatalog} from './ft-events.mjs';
const baseline=process.argv[2]||'baseline',out=process.argv[3]||'ft-audit-output';
const {createEngine}=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(out+'/candidate/notify-core.js','utf8')).toString('base64'));
function load(path){let source=readFileSync(path,'utf8').replace(/^import .*;\s*$/gm,'').replace('export class BackgroundWatcher','class BackgroundWatcher').replace('export default base;','return BackgroundWatcher;');
 return new Function('DeepLinkWatcher','base','createHTCollection','readHTContext','createHTHistoryCache','assessHTItem','createEngine','crossing','observeFT','observeFTStats','observeFTRedEvents','observeFTCatalog','recordFTScan','recordFTDecision','runFTOutcomePass','runPendingFT','reserveScanAttempt','beginFTReplaySqlInvocation','ftReplaySqlRemaining','planFTCaptureBatch',source)(class{}, {},()=>({eligible:()=>false}),async()=>({}),()=>({beginCycle(){}}),()=>null,createEngine,()=>({state:{},send:false}),observeFT,observeFTStats,observeFTRedEvents,observeFTCatalog,recordFTScan,recordFTDecision,runFTOutcomePass,runPendingFT,reserveScanAttempt,beginFTReplaySqlInvocation,ftReplaySqlRemaining,planFTCaptureBatch);}
const before=load(out+'/candidate/worker_notify_v130.js'),after=load(out+'/recorder-trial/worker_notify_v130.js');
const f=(goals,phase='2H')=>({fixture:{id:42,status:{short:phase,elapsed:75}},goals,teams:{home:{id:1,name:'A'},away:{id:2,name:'B'}}});
async function run(C,fixture,stats=[],events=[],options={}){
 const w=new C(),now=Date.now(),rows=new Map(),storage=options.storage||new Map(),calls=[];let writes=0,bytes=0,storageReads=0,storagePuts=0,transactionTail=Promise.resolve();
 const old={id:42,lastAt:now-1000,history:[{captured_at:now-1000}],hcHistory:[{hc:1}],h1History:[{h1:1}],oddsHistory:[],alerts:{},red:0,ui:{fixture:f({home:1,away:0}),captured_at:now-1000,snapshot:{fresh_at:now-1000},engines:{FT:{score:85},H1:{score:72}},goal_estimates:{d:{prob:80}}}};
 rows.set(42,structuredClone(old));w.env=options.env||{};w.ctx={storage:{get:async k=>{storageReads++;return storage.get(k);},put:async(k,v)=>{storagePuts++;return storage.set(k,v);},transaction:fn=>{const task=transactionTail.then(()=>fn(w.ctx.storage));transactionTail=task.catch(()=>{});return task;}}};w.scanControl=async()=>({enabled:true});w.devices=async()=>[{id:'d',prefs:{enabled:true,goal:true,h1:false,gap:false}}];w.listNotifyMatches=async()=>[...rows.values()].map(x=>structuredClone(x));w.putNotifyMatch=async(id,x)=>{writes++;bytes+=Buffer.byteLength(JSON.stringify(x));rows.set(id,structuredClone(x));};w.deleteNotifyMatch=async id=>rows.delete(id);w.api=async(path,params)=>{calls.push(path);if(path==='/fixtures'&&params?.id&&options.finalFixture)return [options.finalFixture];if(options.failEvents&&path==='/fixtures/events')throw Error('PROVIDER_TEST_ERROR');return path==='/fixtures'?(fixture?[fixture]:[]):path==='/fixtures/statistics'?stats:path==='/fixtures/events'?events:[]};w.send=async()=>{throw Error('UNEXPECTED_PUSH')};await w.notifyTick();return {storageOps:{reads:storageReads,puts:storagePuts},worker:w,row:rows.get(42),old,calls,writes,bytes,replay:w.ftReplayLast,decision:w.ftReplayDecisionLast,discovery:w.ftReplayDiscoveryLast,storage};
}

const fixture=f({home:1,away:0}),rows=new Map();let sql=0,reservations=0,deny=false;
const db={prepare(q){return {bind(...a){return {async all(){sql++;assert.equal(q,PAGE_SQL);return {results:[...rows.entries()].filter(([id])=>id.startsWith('OBS:')&&id>a[0]).sort(([a],[b])=>a.localeCompare(b)).slice(0,a[1]).map(([record_id,r])=>({record_id,observation_id:r.payload.id,fixture_id:r.payload.fixture_id,payload_json:JSON.stringify(r.payload),has_decision:[...rows.values()].some(x=>x.payload.schema==='FT_DECISION_V1_DRAFT'&&x.payload.observation_id===r.payload.id)?1:0,has_outcome:[...rows.values()].some(x=>x.payload.schema==='FT_OUTCOME_V2_DRAFT'&&x.payload.observation_id===r.payload.id)?1:0}))};},async first(){sql++;if(q.startsWith('UPDATE ft_replay_budget_v1')){reservations++;return deny?null:{used_records:reservations};}return rows.get(a[0])||null;},async run(){sql++;rows.set(a[0],{content_hash:a[5],payload:JSON.parse(a[6])});return {meta:{changes:1}};}};}};}};
const env={FT_REPLAY_TRIAL_ENABLED:'true',FT_REPLAY_TRIAL_EPOCH:'integration-1',FT_REPLAY_TRIAL_MAX_RECORD_BYTES:'20000',FT_REPLAY_DB:db};
let baselineCost;let checks=0;async function test(name,fn){await fn();checks++;console.log('PASS '+name);}
await test('disabled trial Worker preserves scan API and logical writes',async()=>{const a=await run(before,fixture),b=await run(after,fixture);assert.deepEqual(a.calls,b.calls);assert.equal(a.writes,b.writes);assert.equal(b.replay.status,'DISABLED');assert.equal(sql,0);baselineCost={api_calls:a.calls.length,storage_ops:a.storageOps,logical_match_puts:a.writes};});
await test('actual Worker records missing stats without extra provider requests',async()=>{const b=await run(after,fixture,[],[],{env});assert.equal(b.replay.status,'STORED');assert.equal(b.calls.length,5);assert.equal(rows.size,2);assert.equal(b.decision.status,'STORED');const p=[...rows.values()][0].payload;assert.equal(p.sources.statistics.status,'EMPTY');assert.equal(p.sources.odds.status,'EMPTY');assert.equal(p.sources.fixture.received_at<=p.decision_at,true);assert.equal(p.fixture.fixture.status.short,'2H');});
await test('provider failure receipt is retained as error not empty',async()=>{const b=await run(after,fixture,[],[],{env,failEvents:true});assert.equal(b.replay.status,'STORED');const p=[...rows.values()].filter(x=>x.payload.schema==='FT_OBSERVATION_V1_DRAFT').at(-1).payload;assert.equal(p.sources.events.status,'ERROR');assert.equal(p.sources.events.data,null);assert(p.sources.events.received_at>0);});
await test('pause survives a new Worker instance while normal scan continues',async()=>{deny=true;const beforeSql=sql,a=await run(after,fixture,[],[],{env}),b=await run(after,fixture,[],[],{env,storage:a.storage});assert.equal(a.replay.status,'BUDGET_DENIED');assert.equal(b.replay.status,'PAUSED');assert.equal(sql-beforeSql,1);assert.equal(a.calls.length,5);assert.equal(b.calls.length,5);});
await test('missing-stats decision linked without reusing old UI score',async()=>{const decision=[...rows.values()].filter(x=>x.payload.schema==='FT_DECISION_V1_DRAFT')[0].payload;assert.equal(decision.state,'NOT_EVALUATED');assert.equal(decision.evaluation,null);assert.equal(decision.reason,'STATS_UNAVAILABLE');assert(rows.has('OBS:'+decision.observation_id));});
await test('evaluated Worker snapshot matches backend FT output',async()=>{
 deny=false;
 const stats=[1,2].map(id=>({team:{id},statistics:[{type:'Red Cards',value:0},{type:'Total Shots',value:10},{type:'Shots on Goal',value:4},{type:'Shots insidebox',value:6},{type:'Corner Kicks',value:3}]}));
 const r=await run(after,fixture,stats,[],{env});
 assert.equal(r.decision.status,'STORED');
 const d=[...rows.values()].filter(x=>x.payload.schema==='FT_DECISION_V1_DRAFT').at(-1).payload;
 assert.equal(d.state,'EVALUATED');assert.deepEqual(d.evaluation,r.row.ui.engines.FT);assert.equal(d.devices.length,1);assert.deepEqual(d.devices[0].goal_estimate,r.row.ui.goal_estimates.d);assert.equal(d.top_rank,null);assert.match(d.source_hash,/^[a-f0-9]{64}$/);
});
await test('trial Worker explicit outcome entrypoint fetches and links supplied observation',async()=>{
 deny=false;const r=await run(after,fixture,[],[],{env:{...env}});
 const o=r.worker;
 const observation=[...rows.values()].filter(x=>x.payload.schema==='FT_OBSERVATION_V1_DRAFT').at(-1).payload;
 Object.assign(o.env,{FT_OUTCOME_TRIAL_ENABLED:'true',FT_OUTCOME_TRIAL_MAX_OBSERVATIONS:'2',FT_OUTCOME_TRIAL_MAX_FIXTURES:'1',FT_OUTCOME_TRIAL_MAX_WRITES:'2',FT_OUTCOME_TRIAL_RETRY_MS:'1000',FT_OUTCOME_TRIAL_MAX_ATTEMPTS:'3'});
 o.ctx.storage.transaction=fn=>fn(o.ctx.storage);
 const t=Date.now();await o.ctx.storage.put(OUTCOME_BUDGET_KEY,{start:t-1000,end:t+10000,max_calls:1,used:0});
 let requests=0;o.api=async(path,args,strict)=>{requests++;assert.equal(path,'/fixtures');assert.equal(args.id,42);assert.equal(strict,true);return [{...f({home:2,away:0},'FT'),score:{fulltime:{home:2,away:0}}}];};
 const result=await o.ftReplayOutcomePass([observation]);assert.equal(result.api_calls,1);assert.equal(result.results[0].status,'STORED');assert.equal(requests,1);
 const outcome=[...rows.values()].filter(x=>x.payload.schema==='FT_OUTCOME_V2_DRAFT').at(-1).payload;
 assert.equal(outcome.observation_id,observation.id);assert.equal(outcome.score.home,2);
});
await test('opt-in notifyTick discovers and resolves without supplied observation list',async()=>{
 rows.clear();deny=false;
 const t=Date.now(),storage=new Map([[OUTCOME_BUDGET_KEY,{start:t-1000,end:t+100000,max_calls:2,used:0}]]);
 const options={env:{...env,FT_OUTCOME_DISCOVERY_ENABLED:'true',FT_OUTCOME_TRIAL_ENABLED:'true',FT_OUTCOME_TRIAL_PAGE_SIZE:'1',FT_OUTCOME_TRIAL_DISCOVERY_INTERVAL_MS:'1000',FT_OUTCOME_TRIAL_DISCOVERY_LEASE_MS:'5000',FT_OUTCOME_TRIAL_MAX_OBSERVATIONS:'2',FT_OUTCOME_TRIAL_MAX_FIXTURES:'1',FT_OUTCOME_TRIAL_MAX_WRITES:'2',FT_OUTCOME_TRIAL_RETRY_MS:'1000',FT_OUTCOME_TRIAL_MAX_ATTEMPTS:'3'},storage,finalFixture:{...f({home:2,away:0},'FT'),score:{fulltime:{home:2,away:0}}}};
 const beforeSQL=sql;const r=await run(after,fixture,[],[],options);
 assert.equal(r.discovery.status,'PAGE_PROCESSED');assert.equal(r.discovery.result.results[0].status,'STORED');assert.equal(r.calls.length,6);assert.equal(r.storage.get('notify:budget').used,6);assert.equal(r.storage.get('notify:status').apiToday,6);assert.equal(sql-beforeSQL,13);
 const cost={scope:'TRANSFORMED_NOTIFY_TICK_WITH_MOCKED_PROVIDER_AND_STORES',baseline:baselineCost,trial:{api_calls:r.calls.length,sql_statements:sql-beforeSQL,storage_ops:r.storageOps,logical_match_puts:r.writes},excluded:['real D1 billed rows/index writes','inherited Worker I/O','actual match-store backend','other watcher objects'],production_validated:false};writeFileSync(out+'/trial-total-cost.json',JSON.stringify(cost,null,2));console.log('TRIAL_COST '+JSON.stringify(cost));
 assert.equal([...rows.values()].filter(x=>x.payload.schema==='FT_OUTCOME_V2_DRAFT').length,1);
});
await test('sidecar SQL cap defers replay without dropping normal Notify scan',async()=>{
 rows.clear();deny=false;const start=sql;
 const r=await run(after,fixture,[],[],{env:{...env,FT_REPLAY_TRIAL_SQL_BUDGET_PER_INVOCATION:'3'}});
 assert.equal(r.replay.status,'DEFERRED_CAPTURE_BUDGET');
 assert.equal(r.calls.length,5);
 assert.equal(r.decision,undefined);
 assert.equal(sql-start,0);
 assert.equal(r.writes,1);
});
await test('sidecar SQL cap covers observation and decision in a single scan',async()=>{
 rows.clear();deny=false;const start=sql;
 const r=await run(after,fixture,[],[],{env:{...env,FT_REPLAY_TRIAL_SQL_BUDGET_PER_INVOCATION:'4'}});
 assert.equal(r.replay.status,'DEFERRED_CAPTURE_BUDGET');
 assert.equal(r.decision,undefined);
 assert.equal(sql-start,0);
 assert.equal(r.calls.length,5);
 assert.equal(r.writes,1);
});
writeFileSync(out+'/recorder-integration-tests.json'   ,JSON.stringify({status:'PASS',checks,worker:'transformed baseline Worker',provider:'mock',D1:'mock',production_validated:false},null,2));
