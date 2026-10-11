import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const v130=readFileSync(new URL('../worker_notify_v130.js',import.meta.url),'utf8');
const v137=readFileSync(new URL('../worker_notify_v137_quota50000.js',import.meta.url),'utf8');
assert.match(v137,/await this\.ctx\.storage\.put\(key,q\)/,'global API reservation persists per accepted request');
assert.match(v130,/await this\.ctx\.storage\.put\('notify:match:'\+id,item\)/,'fixture scan persists each processed match');
// Conservative lower bound only. Excludes status, scheduler, alarms, devices, delivery and other inherited writes.
const calls=Number(process.env.API_DAILY_CALLS||50000);
const ticks=Number(process.env.SCAN_TICKS_PER_DAY||2880);
const fixtures=Number(process.env.FIXTURES_PER_TICK||12);
// Conservative workload projection, not a guaranteed minimum: failed/empty fixtures\n// can now skip writes, and actual fixture count varies by scan.\nconst projectedWrites=calls+ticks*fixtures;
const budget=Number(process.env.DO_FREE_DAILY_WRITE_BUDGET||1000);
const result={schema:'DO_WRITE_PROJECTION_V2',calls,ticks,fixtures,projectedWrites,configuredWriteBudget:budget,withinBudget:projectedWrites<=budget,excluded:['notify:status','scheduler','setAlarm','push latency','subscriptions','other inherited writes']};
console.log(JSON.stringify(result));
assert.ok(projectedWrites>0);
if(process.env.REQUIRE_DO_FREE_SAFE==='1')assert.ok(result.withinBudget,'Projected DO writes exceed configured budget; block release');
