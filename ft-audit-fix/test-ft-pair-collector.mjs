import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createFTPairCollector,prepareFTPair,PAIR_INSERT_SQL,PAIR_READ_SQL} from './ft-pair-collector.mjs';
import {RESERVE_SQL} from './persistent-collector.mjs';
import {buildFTObservation} from './observation.mjs';
import {buildFTDecision} from './decision-trace.mjs';
const now=Date.now(),fixture={fixture:{id:42,status:{short:'2H',elapsed:73}},goals:{home:1,away:1}};
const observation=buildFTObservation({id:'test:42:73',fixture_id:42,decision_at:now-1000,fixture});
const decision=buildFTDecision({observation,decision_at:now-500,state:'NOT_EVALUATED',reason:'MISSING_STATS',source_hash:'a'.repeat(64)});
function harness({deny=false,failInsert=false,failRead=false,storedHash=null}={}){
 const rows=new Map(),c={sql:0,budget:0,inserts:0},errs={};
 const db={prepare(sql){
  assert([RESERVE_SQL,PAIR_INSERT_SQL,PAIR_READ_SQL].includes(sql));
  return {bind(...a){return {
   async first(){c.sql++;if(sql===RESERVE_SQL){c.budget++;return deny?null:{used_records:c.budget};}if(failRead)throw Error('read offline');return rows.get(a[0])||null;},
   async run(){c.sql++;assert.equal(sql,PAIR_INSERT_SQL);c.inserts++;if(failInsert)throw Error('insert offline');const key=a[0];
    if(storedHash&&rows.size===0)rows.set(key,{content_hash:storedHash});
    const exists=rows.has(key);if(!exists)rows.set(key,{content_hash:a[4],observation_json:a[5],decision_json:a[6]});
    return {meta:{changes:exists?0:1,rows_written:exists?0:1}};
   }
  };}};
 }};
 return {db,rows,c,errs};
}
let checks=0;async function test(name,fn){await fn();checks++;console.log('PASS '+name);}
const c=(h,extra={})=>createFTPairCollector(h.db,{enabled:true,maxRecordBytes:20000,clock:()=>now,...extra});
await test('disabled causes zero D1 calls',async()=>{const h=harness();assert.equal((await createFTPairCollector(h.db).capture(observation,decision)).status,'DISABLED');assert.equal(h.c.sql,0);});
await test('pair identity and clocks rejected before D1',async()=>{const h=harness();assert.equal((await c(h).capture(observation,{...decision,observation_id:'other'})).status,'INVALID_PAIR');assert.equal(h.c.sql,0);});
await test('decision with future leaked evaluation rejected',async()=>{const h=harness();assert.equal((await c(h).capture(observation,{...decision,evaluation:{score:98}})).status,'INVALID_PAIR');assert.equal(h.c.sql,0);});
await test('one pair stored using three SQL attempts',async()=>{const h=harness();const r=await c(h).capture(observation,decision);assert.equal(r.status,'PAIR_STORED');assert.equal(r.sql_attempts,3);assert.equal(h.c.sql,3);assert.equal(h.rows.size,1);const row=[...h.rows.values()][0];assert.equal(JSON.parse(row.observation_json).id,observation.id);assert.equal(JSON.parse(row.decision_json).observation_id,observation.id);});
await test('exact retry consumes budget but never duplicates a pair',async()=>{const h=harness();await c(h).capture(observation,decision);const r=await c(h).capture(observation,decision);assert.equal(r.status,'PAIR_DUPLICATE');assert.equal(h.rows.size,1);assert.equal(h.c.sql,6);});
await test('budget denial executes only reservation, no row',async()=>{const h=harness({deny:true});assert.equal((await c(h).capture(observation,decision)).status,'PAIR_BUDGET_DENIED');assert.equal(h.c.sql,1);assert.equal(h.rows.size,0);});
await test('insert failure creates zero partial pairs',async()=>{const h=harness({failInsert:true});assert.equal((await c(h).capture(observation,decision)).status,'PAIR_WRITE_UNCONFIRMED');assert.equal(h.c.budget,1);assert.equal(h.rows.size,0);});
await test('ambiguous read failure does not claim saved pair',async()=>{const h=harness({failRead:true});assert.equal((await c(h).capture(observation,decision)).status,'PAIR_WRITE_UNCONFIRMED');assert.equal(h.rows.size,1);});
await test('different decision for same observation is a conflict',async()=>{const h=harness();await c(h).capture(observation,decision);const x=await c(h).capture(observation,{...decision,decision_at:decision.decision_at+1});assert.equal(x.status,'PAIR_CONFLICT');assert.equal(h.rows.size,1);});
await test('paired content hash is canonical',async()=>{const p=await prepareFTPair(observation,decision,20000);assert.match(p.content_hash,/^[a-f0-9]{64}$/);const q=await prepareFTPair(Object.fromEntries(Object.entries(observation).reverse()),Object.fromEntries(Object.entries(decision).reverse()),20000);assert.equal(p.content_hash,q.content_hash);});
await test('oversize pair rejected before D1',async()=>{const h=harness();assert.equal((await c(h,{maxRecordBytes:40}).capture(observation,decision)).status,'INVALID_PAIR');assert.equal(h.c.sql,0);});
await test('invalid recorder clock rejected before D1',async()=>{const h=harness();assert.equal((await c(h,{clock:()=>1}).capture(observation,decision)).status,'INVALID_PAIR_CLOCK');assert.equal(h.c.sql,0);});
mkdirSync('ft-audit-output',{recursive:true});
writeFileSync('ft-audit-output/ft-3d-atomic-pair-tests.json',JSON.stringify({status:'PASS',checks,scope:'MOCK_D1_ONLY',production_validated:false,real_d1_query_cost_unmeasured:true,partial_pair_rows_impossible_per_single_insert:true},null,2));
