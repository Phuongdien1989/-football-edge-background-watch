import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const config=read('wrangler.toml');
const v130=read('worker_notify_v130.js'),v137=read('worker_notify_v137_quota50000.js');
assert.match(v137,/await this\.ctx\.storage\.put\(key,q\)/,'API block reservation must persist before use');
assert.match(v130,/await this\.putNotifyMatch\(id,item\)/,'LIVE state must use D1-capable adapter');
assert.match(config,/LIVE_STATE_D1_ENABLED\s*=\s*"true"/,'release projection requires D1 actually enabled');
const calls=Number(process.env.API_DAILY_CALLS||50000);
const ticks=Number(process.env.SCAN_TICKS_PER_DAY||2880);
const fixtures=Number(process.env.FIXTURES_PER_TICK||12);
const block=Number(process.env.API_RESERVATION_BLOCK_SIZE||64);
const officialDO=100000,officialD1=100000; // Cloudflare Workers Free SQLite row writes/day
// Upper-bound *model* for a single watcher; account-wide usage requires Cloudflare metrics.
// Include DO alarm, API counter, budget, status, scheduler and HOT state refresh.
// Base, notify, cadence and HOT can each set one alarm per tick.
const doBreakdown={
  apiReservation:Math.ceil(calls/block),
  alarm:4*ticks,
  notificationBudget:ticks,
  diagnosticStatus:ticks,
  schedulerStatus:Math.ceil(ticks/4),
  reserveOther:50000 // Conservative allowance for inherited follow/evidence/device/push writes.
};
const d1Breakdown={
  fixtureSnapshots:ticks*fixtures,
  staleTombstones:ticks*fixtures,
  hotBoost:6*ticks, // Reason can change every tick; 120s throttle is not an unconditional bound.
  reserveOther:10000
};
const sum=x=>Object.values(x).reduce((a,b)=>a+b,0);
const doWrites=sum(doBreakdown),d1Writes=sum(d1Breakdown);
const result={schema:'FE_OFFICIAL_FREE_TIER_RELEASE_GATE_V1',mode:'D1_ENABLED',calls,ticks,fixtures,block,
  officialLimits:{durableObjectRowsWritten:officialDO,d1RowsWritten:officialD1},
  doBreakdown,d1Breakdown,doWrites,d1Writes,doHeadroom:officialDO-doWrites,d1Headroom:officialD1-d1Writes,
  assumptions:'model only; account-wide writes and actual alarms must be checked on Cloudflare before deploy',
  sources:['https://developers.cloudflare.com/durable-objects/platform/pricing/','https://developers.cloudflare.com/d1/platform/pricing/']};
console.log(JSON.stringify(result));
assert.ok(calls>=0&&ticks>=0&&fixtures>=0&&block>=1);
if(process.env.REQUIRE_DO_FREE_SAFE==='1'){
 assert.ok(doWrites<=officialDO,'DO projected rows written exceed official Workers Free daily limit');
 assert.ok(d1Writes<=officialD1,'D1 projected rows written exceed official Workers Free daily limit');
}
