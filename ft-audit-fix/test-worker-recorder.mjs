import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {recordFTScan} from './worker-recorder.mjs';
import {RESERVE_SQL} from './persistent-collector.mjs';
const now=Date.now();
const scan={id:'42:a',fixture:{fixture:{id:42,status:{short:'2H'}},goals:{home:1,away:0}},fixtureReceivedAt:now-5,capturedAt:now,health:{stats:'EMPTY',events:'ERROR',odds:'OK',half:'INVALID'},receipts:{stats:now-4,events:now-3,odds:now-2,half:now-1},payloads:{stats:[],events:[],odds:[{odd:2.9}],half:[]}};
function harness({denied=false,broken=false,readError=false,writeError=false}={}){
 const saved=new Map(),rows=new Map();let sql=0,gets=0,puts=0;
 const db={prepare(q){return {bind(...a){return {async first(){sql++;if(q===RESERVE_SQL){if(broken)throw Error('D1 offline');return denied?null:{used_records:1};}return rows.get(a[0])||null;},async run(){sql++;rows.set(a[0],{content_hash:a[5],payload:JSON.parse(a[6])});return {meta:{changes:1}};}};}};}};
 function owner(epoch='trial-1'){return {env:{FT_REPLAY_TRIAL_ENABLED:'true',FT_REPLAY_TRIAL_EPOCH:epoch,FT_REPLAY_TRIAL_MAX_RECORD_BYTES:'20000',FT_REPLAY_DB:db},ctx:{storage:{async get(k){gets++;if(readError)throw Error('DO offline');return saved.get(k);},async put(k,v){puts++;if(writeError)throw Error('DO offline');saved.set(k,v);}}}};}
 return {owner,rows,saved,metrics:()=>({sql,gets,puts})};
}
let checks=0;async function test(name,fn){await fn();checks++;console.log('PASS '+name);}
await test('disabled and non-FT make no storage calls',async()=>{const h=harness(),o=h.owner();o.env.FT_REPLAY_TRIAL_ENABLED='false';assert.equal((await recordFTScan(o,scan)).status,'DISABLED');o.env.FT_REPLAY_TRIAL_ENABLED='true';assert.equal((await recordFTScan(o,{...scan,fixture:{fixture:{id:42,status:{short:'1H'}}}})).status,'OUT_OF_SCOPE');assert.deepEqual(h.metrics(),{sql:0,gets:0,puts:0});});
await test('captures missing/error/high-price inputs without recommendation filter',async()=>{const h=harness();assert.equal((await recordFTScan(h.owner(),scan)).status,'STORED');const p=[...h.rows.values()][0].payload;assert.equal(p.sources.statistics.status,'EMPTY');assert.equal(p.sources.events.status,'ERROR');assert.equal(p.sources.events.data,null);assert.equal(p.sources.odds.data[0].odd,2.9);assert.equal(p.sources.odds.source_at,null);assert.equal(p.sources.half_statistics.status,'INVALID');assert.deepEqual(h.metrics(),{sql:4,gets:1,puts:0});});
await test('one denial suppresses queued scans and survives restart',async()=>{const h=harness({denied:true}),o=h.owner();const r=await Promise.all(Array.from({length:12},()=>recordFTScan(o,scan)));assert.equal(r.filter(x=>x.status==='BUDGET_DENIED').length,1);assert.equal(r.filter(x=>x.status==='PAUSED').length,11);assert.equal((await recordFTScan(h.owner(),scan)).status,'PAUSED');assert.deepEqual(h.metrics(),{sql:1,gets:2,puts:1});});
await test('D1 error pauses rather than retry loop',async()=>{const h=harness({broken:true});assert.equal((await recordFTScan(h.owner(),scan)).status,'BUDGET_UNAVAILABLE');assert.equal((await recordFTScan(h.owner(),scan)).status,'PAUSED');assert.equal(h.metrics().sql,1);});
await test('pause read failure prevents D1 access',async()=>{const h=harness({readError:true});assert.equal((await recordFTScan(h.owner(),scan)).status,'PAUSE_READ_FAILED');assert.equal(h.metrics().sql,0);});
await test('pause write failure reported, memory remains paused',async()=>{const h=harness({denied:true,writeError:true}),o=h.owner();const r=await recordFTScan(o,scan);assert.equal(r.pause_persisted,false);assert.equal((await recordFTScan(o,scan)).status,'PAUSED');assert.equal(h.metrics().sql,1);});
await test('explicit epoch change allows recheck but does not replenish D1',async()=>{const h=harness({denied:true});await recordFTScan(h.owner(),scan);assert.equal((await recordFTScan(h.owner('trial-2'),scan)).status,'BUDGET_DENIED');assert.equal(h.metrics().sql,2);});
await test('missing configuration fails without storage',async()=>{const h=harness(),o=h.owner();delete o.env.FT_REPLAY_TRIAL_EPOCH;assert.equal((await recordFTScan(o,scan)).status,'INVALID_CONFIG');assert.deepEqual(h.metrics(),{sql:0,gets:0,puts:0});});
mkdirSync('ft-audit-output',{recursive:true});writeFileSync('ft-audit-output/worker-recorder-tests.json',JSON.stringify({status:'PASS',checks,storage:'mock D1 and DO',production_validated:false},null,2));
