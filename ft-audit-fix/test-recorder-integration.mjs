import {runFTOutcomePass,OUTCOME_BUDGET_KEY} from './outcome-pass.mjs';
import {recordFTDecision} from './decision-trace.mjs';
import {recordFTScan} from './worker-recorder.mjs';
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {observeFT,observeFTStats,observeFTRedEvents,observeFTCatalog} from './ft-events.mjs';
const baseline=process.argv[2]||'baseline',out=process.argv[3]||'ft-audit-output';
const {createEngine}=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(out+'/candidate/notify-core.js','utf8')).toString('base64'));
function load(path){let source=readFileSync(path,'utf8').replace(/^import .*;\s*$/gm,'').replace('export class BackgroundWatcher','class BackgroundWatcher').replace('export default base;','return BackgroundWatcher;');
 return new Function('DeepLinkWatcher','base','createHTCollection','readHTContext','createHTHistoryCache','assessHTItem','createEngine','crossing','observeFT','observeFTStats','observeFTRedEvents','observeFTCatalog','recordFTScan','recordFTDecision','runFTOutcomePass',source)(class{}, {},()=>({eligible:()=>false}),async()=>({}),()=>({beginCycle(){}}),()=>null,createEngine,()=>({state:{},send:false}),observeFT,observeFTStats,observeFTRedEvents,observeFTCatalog,recordFTScan,recordFTDecision,runFTOutcomePass);}
const before=load(out+'/candidate/worker_notify_v130.js'),after=load(out+'/recorder-trial/worker_notify_v130.js');
const f=(goals,phase='2H')=>({fixture:{id:42,status:{short:phase,elapsed:75}},goals,teams:{home:{id:1,name:'A'},away:{id:2,name:'B'}}});
async function run(C,fixture,stats=[],events=[],options={}){
 const w=new C(),now=Date.now(),rows=new Map(),storage=options.storage||new Map(),calls=[];let writes=0,bytes=0;
 const old={id:42,lastAt:now-1000,history:[{captured_at:now-1000}],hcHistory:[{hc:1}],h1History:[{h1:1}],oddsHistory:[],alerts:{},red:0,ui:{fixture:f({home:1,away:0}),captured_at:now-1000,snapshot:{fresh_at:now-1000},engines:{FT:{score:85},H1:{score:72}},goal_estimates:{d:{prob:80}}}};
 rows.set(42,structuredClone(old));w.env=options.env||{};w.ctx={storage:{get:async k=>storage.get(k),put:async(k,v)=>storage.set(k,v)}};w.scanControl=async()=>({enabled:true});w.devices=async()=>[{id:'d',prefs:{enabled:true,goal:true,h1:false,gap:false}}];w.listNotifyMatches=async()=>[...rows.values()].map(x=>structuredClone(x));w.putNotifyMatch=async(id,x)=>{writes++;bytes+=Buffer.byteLength(JSON.stringify(x));rows.set(id,structuredClone(x));};w.deleteNotifyMatch=async id=>rows.delete(id);w.api=async(path)=>{calls.push(path);if(options.failEvents&&path==='/fixtures/events')throw Error('PROVIDER_TEST_ERROR');return path==='/fixtures'?(fixture?[fixture]:[]):path==='/fixtures/statistics'?stats:path==='/fixtures/events'?events:[]};w.send=async()=>{throw Error('UNEXPECTED_PUSH')};await w.notifyTick();return {worker:w,row:rows.get(42),old,calls,writes,bytes,replay:w.ftReplayLast,decision:w.ftReplayDecisionLast,storage};
}

const fixture=f({home:1,away:0}),rows=new Map();let sql=0,reservations=0,deny=false;
const db={prepare(q){return {bind(...a){return {async first(){sql++;if(q.startsWith('UPDATE ft_replay_budget_v1')){reservations++;return deny?null:{used_records:reservations};}return rows.get(a[0])||null;},async run(){sql++;rows.set(a[0],{content_hash:a[5],payload:JSON.parse(a[6])});return {meta:{changes:1}};}};}};}};
const env={FT_REPLAY_TRIAL_ENABLED:'true',FT_REPLAY_TRIAL_EPOCH:'integration-1',FT_REPLAY_TRIAL_MAX_RECORD_BYTES:'20000',FT_REPLAY_DB:db};
let checks=0;async function test(name,fn){await fn();checks++;console.log('PASS '+name);}
await test('disabled trial Worker preserves scan API and logical writes',async()=>{const a=await run(before,fixture),b=await run(after,fixture);assert.deepEqual(a.calls,b.calls);assert.equal(a.writes,b.writes);assert.equal(b.replay.status,'DISABLED');assert.equal(sql,0);});
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
writeFileSync(out+'/recorder-integration-tests.json'  ,JSON.stringify({status:'PASS',checks,worker:'transformed baseline Worker',provider:'mock',D1:'mock',production_validated:false},null,2));
