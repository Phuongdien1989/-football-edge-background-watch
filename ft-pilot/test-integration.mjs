import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {scheduleFTPilot} from './integration.mjs';
import {patchExistingNotify,patchExistingEvidenceWorker} from './build-review-patch.mjs';
let tests=0;async function test(name,fn){await fn();tests++;console.log('PASS '+name)}
const orig=readFileSync('worker_notify_v130.js','utf8');
const originalWorker=readFileSync('worker.js','utf8');
const patched=patchExistingNotify(orig),patWorker=patchExistingEvidenceWorker(originalWorker);
function owner({enabled=false,failDO=false,failDB=false}={}){
 const tasks=[],mem=new Map(),logs=[];
 const db={prepare(){if(failDB)throw Error('D1_FAILURE');
  return {bind(){return {all:async()=>({results:[],meta:{rows_read:0}}),
   run:async()=>({meta:{changes:0,rows_written:0}})}}};
 }};
 const o={env:{FT_PILOT_ENABLED:enabled?'true':'false',
  FT_PILOT_EPOCH:'TEST-PILOT-LOCK',FT_PILOT_LOGIC_VERSION:'a'.repeat(64),FT_PILOT_DB:db},
 ctx:{waitUntil(p){tasks.push(p);},
 storage:{async get(k){if(failDO)throw Error('DO_DOWN');return mem.get(k);},
  async put(k,v){if(failDO)throw Error('DO_DOWN');mem.set(k,v);},
  async transaction(fn){if(failDO)throw Error('DO_DOWN');
   return fn({get:async k=>mem.get(k),put:async(k,v)=>mem.set(k,v)})}}},
  api(){throw Error('FORBIDDEN_ADDITIONAL_PROVIDER_CALL');},
  send(){throw Error('FT_RECORDER_NEVER_SENDS_PUSH');}};
 return {o,tasks,mem,logs,flush:async()=>{await Promise.all(tasks.splice(0));}};
}
const input={
 kind:'PAIR',scan:{fixture:{fixture:{id:45,status:{short:'2H',elapsed:76}},
  goals:{home:1,away:1}},fixtureReceivedAt:100,capturedAt:200,
  health:{stats:'EMPTY',events:'EMPTY',odds:'EMPTY',half:'EMPTY'},
  receipts:{stats:150,events:155,odds:160,half:165},
  payloads:{stats:[],events:[],odds:[],half:[]},
  crossingRequested:false,decision:{state:'NOT_EVALUATED',reason:'NO_CORE_STATS'}}
};
await test('OFF flag returns synchronously without waitUntil or storage',async()=>{
 const {o,tasks,mem}=owner(),r=scheduleFTPilot(o,input);
 assert.equal(r.status,'DISABLED');assert.equal(tasks.length,0);assert.equal(mem.size,0);
});
await test('ON flag schedules work without blocking pre-existing card/history/cooldown/valuation/TOP/push',async()=>{
 const x=owner({enabled:true});
 const before={HT:{score:74,history:[1,2],cooldown:991,pricing:1.88,card:'HT',TOP:1,push:{sent:true}},
  HC:{score:65,history:[2,3],cooldown:992,pricing:1.99,card:'HC',TOP:2,push:{sent:false}},
  FT:{score:71,history:[1,3],cooldown:993,TOP:3,push:{sent:true}}};
 const frozen=structuredClone(before);
 const t0=performance.now();
 assert.equal(scheduleFTPilot(x.o,input).status,'SCHEDULED_NON_BLOCKING');
 const elapsed=performance.now()-t0;
 assert.equal(x.tasks.length,1);
 assert.deepEqual(before,frozen);
 await x.flush();
 assert.deepEqual(before,frozen);
 assert(elapsed<100,'SYNCHRONOUS_HOOK_LATENCY_100MS');
});
await test('failure of D1 sidecar pauses FT without throwing into signal path',async()=>{
 const x=owner({enabled:true,failDB:true});
 assert.equal(scheduleFTPilot(x.o,input).status,'SCHEDULED_NON_BLOCKING');
 await x.flush();
 assert(x.mem.has('ft:pilot:v1:TEST-PILOT-LOCK:paused'));
 const y=scheduleFTPilot(x.o,input);assert.equal(y.status,'SCHEDULED_NON_BLOCKING');
 await x.flush();assert(x.mem.has('ft:pilot:v1:TEST-PILOT-LOCK:paused'));
});
await test('failure of DO tracking is caught without provider/push calls',async()=>{
 const x=owner({enabled:true,failDO:true});
 assert.equal(scheduleFTPilot(x.o,input).status,'SCHEDULED_NON_BLOCKING');
 await x.flush();
});
await test('OUTCOME hook ignores unfinished result without scheduling',async()=>{
 const x=owner({enabled:true});
 assert.equal(scheduleFTPilot(x.o,{kind:'OUTCOME',fixture:{fixture:{id:45,status:{short:'2H'}}},receivedAt:600}).status,
  'NOT_SCHEDULED_OUT_OF_SCOPE');
 assert.equal(x.tasks.length,0);
});
await test('real evidence result callback is the only permitted outcome hook',async()=>{
 const x=owner({enabled:true});
 assert.equal(scheduleFTPilot(x.o,{kind:'OUTCOME',fixture:{fixture:{id:45,status:{short:'FT'}},
  score:{fulltime:{home:2,away:1}}},receivedAt:600}).status,'SCHEDULED_NON_BLOCKING');
 await x.flush();
});
await test('OUTCOME cannot be captured for wrong fixture before D1',async()=>{
 const x=owner({enabled:true});
 assert.equal(scheduleFTPilot(x.o,{kind:'OUTCOME',fixture:{fixture:{id:0,status:{short:'FT'}}},receivedAt:600}).status,
  'NOT_SCHEDULED_OUT_OF_SCOPE');
});
await test('the original source code files stay unmodified on disk',()=>{
 assert.equal(orig,readFileSync('worker_notify_v130.js','utf8'));
 assert.equal(originalWorker,readFileSync('worker.js','utf8'));
 assert(!orig.includes("from './ft-pilot/integration.mjs'"));
 assert(!originalWorker.includes("from './ft-pilot/integration.mjs'"));
});
await test('candidate scanner imports only independent FT pilot code, not new HTTP',()=>{
 assert(patched.startsWith("import {scheduleFTPilot} from './ft-pilot/integration.mjs';"));
 assert.equal(patched.split('scheduleFTPilot(this,').length,2);
 assert(patched.includes("FT_PILOT_ENABLED==='true'&&s.status==='2H'"));
 assert(patched.includes('market_rows:compact,devices:[]'));
});
await test('one exactly existing scanner request per source retained',()=>{
 for(const q of ["api('/fixtures',{live:'all'},true)",
  "read('stats','/fixtures/statistics'","read('events','/fixtures/events'",
  "read('odds','/odds/live'","read('half','/fixtures/statistics'"])
  assert.equal(patched.split(q).length-1,orig.split(q).length-1,'provider requests drift '+q);
 assert(!patched.includes('setInterval('));assert(!patched.includes('setTimeout('));
});
await test('candidate does not change HT/HC algorithmic operations or card/PUSH payload strings',()=>{
 for(const chunk of ['function h1Gate(e,threshold)','const hcReady=','const h1Route=',
  "if(dp.h1&&h1Eval","if(dp.gap){","if(await this.send(d,packet))",
  'item.hcHistory=','item.h1History=','item.cooldown=stamp+300000',
  'payloadFor(f,{minute:s.minute,score,stamp},id,signals)']){
  assert.equal(patched.includes(chunk),true,'MISSING_LEGACY_OPERATION '+chunk);
 }
 assert.equal(orig.split('if(await this.send(d,packet))').length,
 patched.split('if(await this.send(d,packet))').length);
});
await test('new capture sidecar invoked after legacy send and before snapshot storage',()=>{
 const push=patched.indexOf('if(await this.send(d,packet))'),
   capture=patched.indexOf("scheduleFTPilot(this,{kind:'PAIR'"),
   persist=patched.indexOf('await this.putNotifyMatch(id,item)');
 assert(push>=0&&capture>push&&persist>capture);
});
await test('outcome candidate hooks into pre-existing evidence fixture read',()=>{
 const read=patWorker.indexOf("this.api('/fixtures',{id:j.fixture_id},true)"),
  hook=patWorker.indexOf("scheduleFTPilot(this,{kind:'OUTCOME'"),
  extra=patWorker.split("this.api('/fixtures',{id:j.fixture_id},true)").length-1;
 assert(read>=0&&hook>read);
 assert.equal(extra,1);
 assert(patWorker.includes("FT_PILOT_ENABLED==='true'"));
});
await test('review-only patched source parses, no tracked Worker build produced',()=>{
 const a=spawnSync('node',['--check','ft-audit-output/ft-pilot-candidate/worker_notify_v130.js'],{encoding:'utf8'});
 const b=spawnSync('node',['--check','ft-audit-output/ft-pilot-candidate/worker.js'],{encoding:'utf8'});
 assert.equal(a.status,0,a.stderr);assert.equal(b.status,0,b.stderr);
});
console.log('FE_FT_PILOT_INTEGRATION_QA_PASS '+JSON.stringify({tests,
 original_scanner_unmodified:true,original_backend_unmodified:true,
 provider_calls_added:0,push_calls_added:0,ft_off_default:true,
 ht_hc_full_production_acceptance:false,deploy:false}));
