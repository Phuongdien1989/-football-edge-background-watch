import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../worker_notify_v137_quota50000.js',import.meta.url),'utf8');
const start=source.indexOf('  async reserveApiCall(){');
const end=source.indexOf('  async quotaStatus(){',start);
assert.ok(start>=0&&end>start);
const method=source.slice(start,end);
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const day=new Date().toISOString().slice(0,10);
let writes=0,saved={day,used:0,limit:130};
const storage={get:async()=>structuredClone(saved),put:async(k,v)=>{writes++;saved=structuredClone(v)}};
function watcher(block=64){
 const o=vm.runInNewContext('({'+method+'})',{Date,n,Error,Math});
 o.ctx={storage};o.env={API_RESERVATION_BLOCK_SIZE:block};o.quotaCfg=()=>({total:130});
 o.quotaWork=fn=>{const p=(o._chain||Promise.resolve()).then(fn);o._chain=p.catch(()=>{});return p};
 return o;
}
let o=watcher();
await Promise.all(Array.from({length:65},()=>o.reserveApiCall()));
assert.equal(writes,2,'65 calls should persist only two prepaid blocks');
assert.equal(saved.used,128,'prepaid count includes unused reservations');
o=watcher(); // restart forfeits remaining prepaid tokens
await o.reserveApiCall();
assert.equal(saved.used,130,'restart must not reuse unspent tokens');
assert.equal(writes,3);
await o.reserveApiCall();
await assert.rejects(o.reserveApiCall(),/API_TOTAL_DAILY_BUDGET_REACHED/);
assert.equal(writes,3,'rejections never write');
o=watcher();
await assert.rejects(o.reserveApiCall(),/API_TOTAL_DAILY_BUDGET_REACHED/);
assert.equal(writes,3,'restart cannot overspend hard cap');
console.log('PASS: prepaid blocks, concurrent calls, restart, hard cap, no-write rejections');
