import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync(new URL('../worker_notify_v127.js',import.meta.url),'utf8');
const begin=src.indexOf('  async fetch(request){');
const end=src.indexOf('  async notifyTick(){',begin);
assert.ok(begin>=0&&end>begin);
const method=src.slice(begin,end);
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status});
let writes=0,alarms=0;
const state=new Map([['notify:scan-control',{enabled:false,updated:123}],['notify:status',{at:100,startedAt:90}]]);
const obj=vm.runInNewContext('({'+method+'})',{URL,Date,JSON,Number,Response,reply});
obj.ctx={storage:{get:async key=>state.get(key),put:async(key,value)=>{writes++;state.set(key,value)},setAlarm:async()=>{alarms++}}};
obj.scanControl=async()=>{const c=state.get('notify:scan-control');return {enabled:c?.enabled!==false,updated:Number(c?.updated||0)}};
const call=async enabled=>{
 const request=new Request('https://example.test/api/notify/scan-control',{method:'POST',body:JSON.stringify({enabled})});
 return (await obj.fetch(request)).json();
};
for(let i=0;i<12;i++){const result=await call(false);assert.equal(result.unchanged,true)}
assert.equal(writes,0,'repeated pause should not write');
assert.equal(alarms,0,'repeated pause should not schedule alarms');
const resumed=await call(true);
assert.equal(resumed.scan_control.enabled,true);
assert.equal(writes,2,'transition persists control and status');
assert.equal(alarms,1,'resume schedules exactly once');
assert.equal(state.get('notify:status').at,100,'ON must not invent a fresh scan heartbeat');
assert.equal(state.get('notify:status').startedAt,90);
for(let i=0;i<12;i++){const result=await call(true);assert.equal(result.unchanged,true)}
assert.equal(writes,2,'repeated resume should not write');
assert.equal(alarms,1,'repeated resume should not schedule alarms');
obj.scanControl=async()=>({enabled:false,manualEnabled:true,scheduledPaused:true,updated:123});
const priorWrites=writes,priorAlarms=alarms;
assert.equal((await call(true)).unchanged,true,'repeated resume during closed hours is idempotent against manual state');
assert.equal(writes,priorWrites);assert.equal(alarms,priorAlarms);
await call(false);assert.equal(state.get('notify:scan-control').enabled,false,'manual pause works during scheduled closure');
console.log('PASS: runtime pause/resume transitions, including scheduled closure, are idempotent');
