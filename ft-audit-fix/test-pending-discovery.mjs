import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {runPendingFT,PAGE_SQL,DISCOVERY_KEY} from './pending-discovery.mjs';
import {OUTCOME_BUDGET_KEY} from './outcome-pass.mjs';
import {buildFTObservation} from './observation.mjs';
const now=Date.now(),fixture={fixture:{id:42,status:{short:'2H'}},goals:{home:1,away:0}};
const observation=buildFTObservation({id:'a',fixture_id:42,decision_at:now-100,fixture});
const row={record_id:'OBS:a',observation_id:'a',fixture_id:42,payload_json:JSON.stringify(observation),has_decision:0,has_outcome:0};
function harness(page=[row]){
 const memory=new Map([[OUTCOME_BUDGET_KEY,{start:now-1000,end:now+100000,max_calls:10,used:0}]]);const saved=new Map();let reads=0,api=0,sql=0,tail=Promise.resolve();
 const storage={get:async k=>memory.get(k),put:async(k,v)=>memory.set(k,structuredClone(v)),transaction(fn){const p=tail.then(()=>fn(storage));tail=p.catch(()=>{});return p;}};
 const db={prepare(q){return {bind(...a){return {async all(){assert.equal(q,PAGE_SQL);reads++;return {results:page.filter(x=>x.record_id>a[0]).slice(0,a[1])};},async first(){sql++;return q.startsWith('UPDATE')?{used_records:1}:saved.get(a[0])||null;},async run(){sql++;saved.set(a[0],{content_hash:a[5]});return {meta:{changes:1}};}};}};}};
 const env={FT_OUTCOME_DISCOVERY_ENABLED:'true',FT_OUTCOME_TRIAL_ENABLED:'true',FT_REPLAY_TRIAL_ENABLED:'true',FT_REPLAY_TRIAL_EPOCH:'x',FT_REPLAY_TRIAL_MAX_RECORD_BYTES:'20000',FT_REPLAY_DB:db,FT_OUTCOME_TRIAL_PAGE_SIZE:'2',FT_OUTCOME_TRIAL_DISCOVERY_INTERVAL_MS:'1000',FT_OUTCOME_TRIAL_DISCOVERY_LEASE_MS:'5000',FT_OUTCOME_TRIAL_MAX_OBSERVATIONS:'2',FT_OUTCOME_TRIAL_MAX_FIXTURES:'2',FT_OUTCOME_TRIAL_MAX_WRITES:'2',FT_OUTCOME_TRIAL_RETRY_MS:'1000',FT_OUTCOME_TRIAL_MAX_ATTEMPTS:'3'};
 const owner=()=>({env:{...env},ctx:{storage},scanControl:async()=>({enabled:true}),api:async()=>{api++;return [{...fixture,fixture:{id:42,status:{short:'FT'}},goals:{home:2,away:0},score:{fulltime:{home:2,away:0}}}];}});
 return {owner,memory,counts:()=>({reads,api,sql})};
}
const run=(o,t=now)=>runPendingFT(o,{clock:()=>t});
let checks=0;async function test(name,fn){await fn();checks++;console.log('PASS '+name);}
await test('pair-ledger mode refuses old discovery query before D1 or API',async()=>{const h=harness(),o=h.owner();o.env.FT_REPLAY_PAIR_TRIAL_ENABLED='true';assert.equal((await run(o)).status,'PAIR_OUTCOME_NOT_WIRED');assert.equal(h.counts().reads,0);assert.equal(h.counts().api,0);});
await test('disabled and scanner off make no discovery query',async()=>{const h=harness(),o=h.owner();o.env.FT_OUTCOME_DISCOVERY_ENABLED='false';assert.equal((await run(o)).status,'DISABLED');o.env.FT_OUTCOME_DISCOVERY_ENABLED='true';o.scanControl=async()=>({enabled:false});assert.equal((await run(o)).status,'SCANNER_OFF');assert.equal(h.counts().reads,0);});
await test('pending record discovered and missing decision preserved',async()=>{const h=harness(),r=await run(h.owner());assert.deepEqual(r.missing_decision,['a']);assert.equal(r.result.results[0].status,'STORED');assert.deepEqual(h.counts(),{reads:1,api:1,sql:4});assert.equal(h.memory.get(DISCOVERY_KEY).cursor,'OBS:a');});
await test('restart respects discovery interval',async()=>{const h=harness();await run(h.owner());assert.equal((await run(h.owner())).status,'NOT_DUE');assert.equal(h.counts().reads,1);});
await test('concurrent discovery has one lease',async()=>{const h=harness();const r=await Promise.all([run(h.owner()),run(h.owner())]);assert.equal(r.filter(x=>x.status==='NOT_DUE').length,1);assert.equal(h.counts().reads,1);});
await test('completed page avoids API, empty next page wraps',async()=>{const h=harness([{...row,has_outcome:1}]);assert.equal((await run(h.owner())).result.status,'NO_PENDING_IN_PAGE');await run(h.owner(),now+1001);assert.equal(h.memory.get(DISCOVERY_KEY).cursor,'');assert.equal(h.counts().api,0);});
await test('storage pause stops discovery SQL',async()=>{const h=harness();h.memory.set('ft:replay:trial:pause:v1',{epoch:'x',reason:'BUDGET_DENIED'});assert.equal((await run(h.owner())).status,'STORAGE_PAUSED');assert.equal(h.counts().reads,0);});
await test('API budget exhaustion avoids D1 page read',async()=>{const h=harness();h.memory.get(OUTCOME_BUDGET_KEY).used=10;assert.equal((await run(h.owner())).status,'API_BUDGET_DENIED');assert.equal(h.counts().reads,0);});
await test('bad payload flagged and cursor advances',async()=>{const h=harness([{...row,payload_json:'broken'}]),r=await run(h.owner());assert.deepEqual(r.invalid_rows,['OBS:a']);assert.equal(h.counts().api,0);assert.equal(h.memory.get(DISCOVERY_KEY).cursor,'OBS:a');});
await test('failed page query does not advance cursor',async()=>{const h=harness(),o=h.owner();o.env.FT_REPLAY_DB={prepare(){throw Error('missing index');}};assert.equal((await run(o)).status,'DISCOVERY_FAILED');assert.equal(h.memory.get(DISCOVERY_KEY).cursor,'');});
mkdirSync('ft-audit-output',{recursive:true});writeFileSync('ft-audit-output/pending-query.json',JSON.stringify({sql:PAGE_SQL}));
writeFileSync('ft-audit-output/pending-discovery-tests.json',JSON.stringify({status:'PASS',checks,storage:'mock',production_validated:false},null,2));
