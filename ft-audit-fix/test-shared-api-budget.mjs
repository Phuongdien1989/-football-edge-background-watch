import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {reserveNotifyAttempt,NOTIFY_BUDGET_KEY,reserveScanAttempt} from './shared-api-budget.mjs';
const t=Date.parse('2026-10-22T12:00:00Z');
function storage(initial){const rows=new Map();if(initial)rows.set(NOTIFY_BUDGET_KEY,initial);let tail=Promise.resolve();const s={get:async k=>rows.get(k),put:async(k,v)=>rows.set(k,structuredClone(v)),transaction(fn){const p=tail.then(()=>fn(s));tail=p.catch(()=>{});return p;}};return {rows,s};}
let checks=0;async function test(name,fn){await fn();checks++;console.log('PASS '+name);}
await test('existing usage is preserved',async()=>{const {s}=storage({day:'2026-10-22',used:7});assert.equal((await reserveNotifyAttempt(s,t,10)).budget.used,8);});
await test('concurrent scan and outcome share last slot',async()=>{const {s,rows}=storage({day:'2026-10-22',used:9});const r=await Promise.all([s.transaction(tx=>reserveNotifyAttempt(tx,t,10)),s.transaction(tx=>reserveNotifyAttempt(tx,t,10))]);assert.equal(r.filter(x=>x.status==='RESERVED').length,1);assert.equal(rows.get(NOTIFY_BUDGET_KEY).used,10);});
await test('restart cannot refill same day',async()=>{const {s}=storage({day:'2026-10-22',used:10});await assert.rejects(reserveScanAttempt({env:{NOTIFY_DAILY_BUDGET:10},ctx:{storage:s}},t),/BUDGET_REACHED/);});
await test('UTC rollover resets only on new day',async()=>{const {s}=storage({day:'2026-10-21',used:10});assert.equal((await reserveNotifyAttempt(s,t,10)).budget.used,1);});
await test('clock rollback does not reset future budget',async()=>{const {s}=storage({day:'2026-10-23',used:10});assert.equal((await reserveNotifyAttempt(s,t,10)).status,'INVALID_SHARED_BUDGET');});
await test('invalid count fails closed',async()=>{const {s}=storage({day:'2026-10-22',used:-1});assert.equal((await reserveNotifyAttempt(s,t,10)).status,'INVALID_SHARED_BUDGET');});
await test('reserved crash is charged after new caller',async()=>{const {s}=storage();await reserveScanAttempt({env:{NOTIFY_DAILY_BUDGET:1},ctx:{storage:s}},t);await assert.rejects(reserveScanAttempt({env:{NOTIFY_DAILY_BUDGET:1},ctx:{storage:s}},t),/BUDGET_REACHED/);});
await test('missing transaction rejects before fetch',async()=>await assert.rejects(reserveScanAttempt({env:{},ctx:{storage:{}}},t),/TRANSACTION_REQUIRED/));
mkdirSync('ft-audit-output',{recursive:true});writeFileSync('ft-audit-output/shared-api-budget-tests.json',JSON.stringify({status:'PASS',checks,storage:'serialized DO mock',production_validated:false},null,2));
