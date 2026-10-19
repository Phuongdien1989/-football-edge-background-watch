import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
const root=readFileSync('worker.js','utf8');
const start=root.indexOf('  async armBackgroundAlarm('),end=root.indexOf('  async register(body)',start);
const methods=root.slice(start,end).replace('\n  async ensureAlarm',',\n  async ensureAlarm');
const api=vm.runInNewContext('({'+methods+'})',{Date,Number});
class Root{constructor(){this.enabled=false;this.alarms=0;this.alarmAt=null;this.data=new Map();this.env={APISPORTS_KEY:'FAKE_TEST_KEY'};this.ctx={storage:{get:async k=>this.data.get(k),put:async(k,v)=>this.data.set(k,v),list:async({prefix})=>new Map([...this.data].filter(([k])=>k.startsWith(prefix))),setAlarm:async at=>{this.alarmAt=at;this.alarms++},getAlarm:async()=>this.alarmAt}}}async scanControl(){return {enabled:this.enabled}}async fetch(){return new Response('{}',{status:404})}async listWatches(){return [{ended:false,expires_at:Date.now()+60000,level:'focus'}]}async evidenceJobs(){return []}cfg(k,d){return d}}
Object.assign(Root.prototype,api);
function load(file,bindings){const s=readFileSync(file,'utf8').replace(/^import .*;\n/gm,'').replace(/export function /g,'function ').replace('export class BackgroundWatcher','class BackgroundWatcher').split('export default')[0];return vm.runInNewContext(s+';BackgroundWatcher',{...bindings,URL,Request,Response,Date,JSON,Number,String,Math,Object,Array,Map,Promise,Error,TextEncoder,Uint8Array,crypto:webcrypto,btoa,atob})}
const Web=load('worker_notify.js',{ExistingWatcher:Root});const H1=load('worker_notify_v130.js',{DeepLinkWatcher:Web});const Native=load('worker_notify_v132_native.js',{ValidationWatcher:H1});
const request=(path,body)=>new Request('https://test'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
for(const enabled of [false,true]){
 const w=new H1();w.enabled=enabled;
 const sub=await w.fetch(request('/api/notify/subscribe',{subscription:{endpoint:'https://fcm.googleapis.com/example',keys:{p256dh:'A'.repeat(88),auth:'A'.repeat(22)}},prefs:{enabled:true}}));assert.equal(sub.status,200);const j=await sub.json();assert.equal(j.ok,true);assert.equal(w.alarms,enabled?1:0,'Web subscribe respects OFF/ON');
 const settings=await w.fetch(request('/api/notify/settings',{id:j.id,prefs:{enabled:true,goalThreshold:60,gapThreshold:60}}));assert.equal(settings.status,200);assert.equal(w.alarms,enabled?2:0,'H1 settings respects OFF/ON');
 const legacy=new Web();legacy.enabled=enabled;const r=await legacy.fetch(request('/api/notify/subscribe',{subscription:{endpoint:'https://fcm.googleapis.com/legacy',keys:{p256dh:'A'.repeat(88),auth:'A'.repeat(22)}},prefs:{enabled:true}}));const d=await r.json();await legacy.fetch(request('/api/notify/settings',{id:d.id,prefs:{enabled:true}}));assert.equal(legacy.alarms,enabled?2:0,'Legacy web settings respects OFF/ON');
 for(const platform of ['android','ios']){const native=new Native();native.enabled=enabled;const r=await native.fetch(request('/api/notify/native/subscribe',{platform,token:platform==='ios'?'a'.repeat(64):'A'.repeat(80),prefs:{enabled:true}}));assert.equal(r.status,200);assert.equal((await r.json()).ok,true);assert.equal(native.alarms,enabled?1:0,'Native subscribe respects OFF/ON');}
 const watch=new Root();watch.enabled=enabled;await watch.ensureAlarm(1000);assert.equal(watch.alarms,enabled?1:0,'Smart Follow respects OFF/ON');if(enabled){await watch.ensureAlarm(1000);assert.equal(watch.alarms,1,'existing alarm never duplicates')}
 const evidence=new Root();evidence.enabled=enabled;evidence.listWatches=async()=>[];evidence.evidenceJobs=async()=>[{pending:true}];await evidence.ensureAlarm(1000);assert.equal(evidence.alarms,enabled?1:0,'Evidence respects OFF/ON');
}
// Reproduce old root ensureAlarm bug with actual production source, not an invented mock implementation.
const before=execFileSync('git',['show','3c97629e51251c56f9edeb8d0f67a7a0dad957a2:worker.js'],{encoding:'utf8'});const b=before.indexOf('  async ensureAlarm(delayMs=null){'),e=before.indexOf('  async register(body)',b);const old=vm.runInNewContext('({'+before.slice(b,e)+'})',{Date,Number});const legacy=new Root();await old.ensureAlarm.call(legacy,1000);assert.equal(legacy.alarms,1,'baseline bug reproduced');
console.log('COMPLETE_PAUSE_PASS: actual Web/H1 settings/Android/iOS subscriptions, Smart Follow/Evidence OFF zero alarm writes; ON and idempotency retained; baseline bug reproduced; no external calls.');
