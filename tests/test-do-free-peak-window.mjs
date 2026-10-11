import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../worker_notify_v138_peak_window.js',import.meta.url),'utf8');
let now=Date.parse('2026-10-11T11:59:59Z'),manual=true,superAlarms=0,providerCalls=0,quotaReservations=0;
let alarmAt=null,alarmWrites=0;
class QuotaWatcher {
 async scanControl(){return {enabled:manual,updated:123};}
 async alarm(){if((await this.scanControl()).enabled){superAlarms++;await this.api('/fixtures');}}
 async api(){quotaReservations++;providerCalls++;return [];}
 async fetch(){return new Response('{}');}
}
// Remove only import/export syntax, leaving the implementation under test intact.
const moduleText=source.replace(/^import .*;\n/,'').replace('export function peakWindow','function peakWindow').replace('export class BackgroundWatcher','class BackgroundWatcher').split('export default')[0];
const result=vm.runInNewContext(moduleText+';({peakWindow,BackgroundWatcher})',{QuotaWatcher,Date:{now:()=>now},Number,String,Math,Error,Response,JSON,URL,Request});
const env={PEAK_SCAN_ENABLED:'true',PEAK_SCAN_START:'19:00',PEAK_SCAN_END:'05:00'};
const at=s=>now=Date.parse(s);
assert.equal(result.peakWindow(env).allowed,false,'18:59:59 Vietnam closed');
at('2026-10-11T12:00:00Z');
assert.equal(result.peakWindow(env).allowed,true,'19:00 opens exactly');
assert.equal(result.peakWindow(env).closesAt,Date.parse('2026-10-11T22:00:00Z'));
at('2026-10-11T21:59:59Z');assert.equal(result.peakWindow(env).allowed,true,'04:59:59 Vietnam open');
at('2026-10-11T22:00:00Z');assert.equal(result.peakWindow(env).allowed,false,'05:00 closes exactly');
assert.equal(result.peakWindow(env).nextStart,Date.parse('2026-10-12T12:00:00Z'));
assert.equal(result.peakWindow(env).activeMinutes,600);
assert.equal(result.peakWindow({PEAK_SCAN_ENABLED:'false'}).allowed,true);
assert.throws(()=>result.peakWindow({...env,PEAK_SCAN_START:'25:00'}),/INVALID_CLOCK/);
assert.throws(()=>result.peakWindow({...env,PEAK_SCAN_END:'19:00'}),/NOT_ALLOWED/);
const daytime={...env,PEAK_SCAN_START:'08:00',PEAK_SCAN_END:'10:00'};
at('2026-10-11T01:00:00Z');assert.equal(result.peakWindow(daytime).allowed,true);
at('2026-10-11T03:00:00Z');assert.equal(result.peakWindow(daytime).allowed,false);
const make=()=>{const w=new result.BackgroundWatcher();w.env=env;w.ctx={storage:{getAlarm:async()=>alarmAt,setAlarm:async t=>{alarmAt=t;alarmWrites++;}}};return w;};
let w=make();at('2026-10-11T01:30:00Z'); // 08:30 Vietnam
for(let i=0;i<10;i++)await w.alarm();
assert.equal(superAlarms,0,'closed hours must bypass all superclass polling');
assert.equal(providerCalls,0);assert.equal(quotaReservations,0);
assert.equal(alarmWrites,1,'repeated closed-hour events do not repeatedly re-arm the same opening');
assert.equal(alarmAt,Date.parse('2026-10-11T12:00:00Z'));
await assert.rejects(w.api('/fixtures'),/SCAN_OUTSIDE_PEAK_WINDOW/);
assert.equal(quotaReservations,0,'closed-hour manual scan cannot reserve provider quota');
w=make(); // restart loses memory; durable next alarm remains
await w.alarm();assert.equal(alarmWrites,1);
manual=false;const saved=alarmAt;await w.alarm();assert.equal(alarmAt,saved,'manual pause must not arm a new wake');
manual=true;at('2026-10-11T12:00:00Z');await w.alarm();
assert.equal(superAlarms,1);assert.equal(providerCalls,1,'open window retains inherited scanner');
manual=false;await w.alarm();assert.equal(providerCalls,1,'manual pause wins inside peak hours');
manual=true;alarmAt=null;
await w.fetch(new Request('https://test/api/notify/peak-wake',{method:'POST'}));
assert.equal(alarmAt,now+1000,'cron can bootstrap a worker without an alarm');
const n=alarmWrites;await w.fetch(new Request('https://test/api/notify/peak-wake',{method:'POST'}));
assert.equal(alarmWrites,n,'cron never postpones an already scheduled scan');
console.log('PASS: Vietnam overnight/daytime boundaries, no polling/quota outside window, single wake, restart, manual pause, cron bootstrap');
