import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../worker_notify_v138_peak_window.js',import.meta.url),'utf8');
let now=Date.parse('2026-10-11T11:59:59Z'),manual=true,superAlarms=0,providerCalls=0,quotaReservations=0;
let alarmAt=null,alarmWrites=0;
class QuotaWatcher {
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async scanControl(){const saved=await this.ctx?.storage.get?.('notify:scan-control');return saved||{enabled:manual,updated:123};}
 async alarm(){if((await this.scanControl()).enabled){superAlarms++;await this.api('/fixtures');}}
 async api(){quotaReservations++;providerCalls++;return [];}
 async fetch(request){return new Response(new URL(request.url).pathname==='/api/notify/status'?JSON.stringify({scan:data.get('notify:status')}):'{}');}
 async devices(){return [{prefs:{enabled:true,h1:true}}];}
}
// Remove only import/export syntax, leaving the implementation under test intact.
const moduleText=source.replace(/^import .*;\n/,'').replace('export function peakWindow','function peakWindow').replace('export class BackgroundWatcher','class BackgroundWatcher').split('export default')[0];
class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
const result=vm.runInNewContext(moduleText+';({peakWindow,BackgroundWatcher})',{QuotaWatcher,Date:FixedDate,Number,String,Math,Error,Response,JSON,URL,Request});
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

const data=new Map([['notify:scan-control',{enabled:true,updated:123}]]);
const manualEnv={PEAK_SCAN_ENABLED:'false',MANUAL_SCAN_MODE_ENABLED:'true',MANUAL_SCAN_TICKS_PER_DAY:'3'};
let initialization;
const ctx={blockConcurrencyWhile:fn=>{initialization=fn();},storage:{
 get:async key=>data.get(key),
 put:async(key,value)=>{if(typeof key==='object'){for(const [k,v]of Object.entries(key))data.set(k,v);}else data.set(key,value);},
 getAlarm:async()=>alarmAt,setAlarm:async t=>{alarmAt=t;alarmWrites++;},deleteAlarm:async()=>{alarmAt=null;}
}};
const restart=async()=>{const watcher=new result.BackgroundWatcher(ctx,manualEnv);await initialization;return watcher;};
w=await restart();
assert.equal((await w.scanControl()).enabled,false,'manual migration starts paused');
assert.equal(alarmAt,null,'old daily wake removed');
assert.equal(data.get('notify:manual-mode:previous-control:v1').enabled,true,'previous control archived');
const before=providerCalls;
await w.alarm();assert.equal(providerCalls,before,'manual mode does not poll while OFF');
data.set('notify:scan-control',{enabled:true,updated:now});
w=await restart();assert.equal((await w.scanControl()).enabled,true,'restart preserves explicit ON');
await w.fetch(new Request('https://test/api/notify/peak-wake',{method:'POST'}));
assert.equal(alarmAt,null,'obsolete cron never auto starts manual mode');
await Promise.all([w.alarm(),w.alarm(),w.alarm(),w.alarm()]);
assert.equal(providerCalls-before,3,'concurrent alarms admit exactly the daily allowance, including final cycle');
assert.equal((await w.scanControl()).manualEnabled,false,'Free budget exhaustion switches scanner OFF');
const rejected=await w.fetch(new Request('https://test/api/notify/scan-control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({enabled:true})}));
assert.equal(rejected.status,409,'ON reports exhausted allowance rather than arming another scan');
assert.equal((await rejected.json()).error,'FREE_SCAN_DAILY_BUDGET_EXHAUSTED');
assert.equal(data.get('notify:scan-control').enabled,false,'rejected ON preserves OFF');
w=await restart();data.set('notify:scan-control',{enabled:true,updated:now});
await w.alarm();assert.equal(providerCalls-before,3,'restart or ON cannot reset daily ledger');
now+=86400000;
assert.equal((await w.scanControl()).scan_budget.used,0,'UTC reset matches provider daily rows budget');
data.set('notify:scan-control',{enabled:false,updated:now});
await w.alarm();assert.equal(providerCalls-before,3,'daily reset never automatically enables scanner');
data.set('notify:scan-control',{enabled:true,updated:now});await w.alarm();
assert.equal(providerCalls-before,4,'explicit ON works at any hour on a new day');
console.log('PASS: default OFF, no automatic wake, persisted manual choice, serialized prepaid Free budget, restart/toggle guard, next-day manual resume');

const today=new Date(now).toISOString().slice(0,10);
const oldBudget={day:'2026-10-10',used:45241};
data.set('notify:budget',oldBudget);
data.set('notify:status',{at:now,startedAt:Date.parse('2026-10-10T20:00:00Z'),apiToday:45241,apiLimit:43000,errors:[{error:'NOTIFY_DAILY_BUDGET_REACHED'}]});
w.env.NOTIFY_DAILY_BUDGET='43000';
let status=await w.fetch(new Request('https://test/api/notify/status')).then(r=>r.json());
assert.equal(status.scan.apiToday,0,'old day cannot appear as today usage');
assert.equal(status.scan.apiDay,today);assert.equal(status.scan.errors.length,0);
assert.equal(status.scan.at,data.get('notify:status').startedAt,'heartbeat reflects last scan rather than ON timestamp');
assert.equal(data.get('notify:budget'),oldBudget,'status GET never resets persisted accounting');
data.set('notify:budget',{day:today,used:45241});
status=await w.fetch(new Request('https://test/api/notify/status')).then(r=>r.json());
assert.equal(status.scan.apiToday,45241,'real exhausted current-day budget remains visible');
assert.equal(status.scan.errors[0].error,'NOTIFY_DAILY_BUDGET_REACHED');
assert.equal(status.notify_budget.remaining,0);
const diagnostics=await w.notifyDiagnostics();assert.equal(diagnostics.enabled_devices,1);assert.equal(diagnostics.budget.exhausted,true);
console.log('PASS: UTC date-aware notification status, preserved current-day exhaustion, read-only accounting, real-cycle heartbeat');
