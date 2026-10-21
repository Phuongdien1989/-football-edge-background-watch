import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createTrialCollector} from './trial-collector.mjs';
const input=(id='one')=>({id,fixture_id:42,decision_at:1000,fixture:{fixture:{id:42,status:{short:'2H'}},goals:{home:1,away:0}},sources:{statistics:{status:'EMPTY',received_at:999,data:[]}}});
function database(fail=false){const rows=new Map();return {rows,prepare(sql){return {bind(...a){return {async first(){if(fail)throw Error('unavailable');return rows.get(a[0])||null;},async run(){rows.set(a[0],{content_hash:a[5],payload:a[6]});return {meta:{changes:1}};}};}};}};}
const limits={enabled:true,maxAttempts:2,maxRecordBytes:20000,maxSessionBytes:40000};
let checks=0;async function check(name,fn){await fn();checks++;console.log('PASS '+name);}
await check('default disabled zero SQL',async()=>{const c=createTrialCollector(null);assert.equal((await c.capture(null)).status,'DISABLED');assert.equal(c.metrics().sqlAttempts,0);});
await check('explicit limits required',()=>assert.throws(()=>createTrialCollector(null,{enabled:true}),/EXPLICIT/));
let measured;
await check('capture and exact retry measured',async()=>{const c=createTrialCollector(database(),limits);assert.equal((await c.capture(input())).status,'STORED');assert.equal((await c.capture(input())).status,'DUPLICATE');measured=c.metrics();assert.equal(measured.sqlAttempts,4);assert.equal(measured.insertAttempts,1);});
await check('concurrent captures cannot exceed session attempts',async()=>{const c=createTrialCollector(database(),limits);const r=await Promise.all(['a','b','c'].map(x=>c.capture(input(x))));assert.deepEqual(r.map(x=>x.status),['STORED','STORED','SESSION_LIMIT']);assert.equal(c.metrics().sqlAttempts,6);});
await check('byte limit stops before SQL',async()=>{const c=createTrialCollector(database(),{...limits,maxSessionBytes:1});assert.equal((await c.capture(input())).status,'SESSION_BYTES_LIMIT');assert.equal(c.metrics().sqlAttempts,0);});
await check('oversize stops before SQL',async()=>{const c=createTrialCollector(database(),{...limits,maxRecordBytes:1});assert.equal((await c.capture(input())).status,'INVALID_RECORD');assert.equal(c.metrics().sqlAttempts,0);});
await check('missing inputs not coerced',async()=>{const d=database(),c=createTrialCollector(d,limits);assert.equal((await c.capture(null)).status,'INVALID_INPUT');assert.equal(c.metrics().sqlAttempts,0);});
await check('freeze input before queued write',async()=>{const d=database(),c=createTrialCollector(d,limits),x=input();const p=c.capture(x);x.fixture.goals.home=99;await p;const saved=JSON.parse([...d.rows.values()][0].payload);assert.equal(saved.fixture.goals.home,1);assert.equal(saved.sources.odds.data,null);});
await check('failure consumes budget and does not throw into caller',async()=>{const c=createTrialCollector(database(true),{...limits,maxAttempts:1});assert.equal((await c.capture(input())).status,'RECORD_FAILED');assert.equal((await c.capture(input())).status,'SESSION_LIMIT');assert.equal(c.metrics().sqlAttempts,1);});
mkdirSync('ft-audit-output',{recursive:true});
writeFileSync('ft-audit-output/trial-collector-tests.json',JSON.stringify({status:'PASS',checks,measured,storage:'mocked D1',production_writes:0,provider_requests:0},null,2));
