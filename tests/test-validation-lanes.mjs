import vm from 'node:vm';import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';import {createRequire} from 'node:module';
let external=0,total=0;
const ctx=vm.createContext({console,Request,Response,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,AbortController,AbortSignal,crypto:webcrypto,setTimeout,clearTimeout,btoa,atob,Buffer,process:{env:{}},fetch:async()=>{if(++external>50)throw Error('Too many subrequests by single Worker invocation');total++;return new Response(JSON.stringify({response:[],errors:[]}))}}),cache=new Map();
const cf=new vm.SyntheticModule(['DurableObject'],function(){this.setExport('DurableObject',class{constructor(ctx,env){this.ctx=ctx;this.env=env}})},{context:ctx}),nm=new vm.SyntheticModule(['createRequire'],function(){this.setExport('createRequire',createRequire)},{context:ctx});
async function mod(file){if(!cache.has(file))cache.set(file,fs.readFile(file,'utf8').then(s=>new vm.SourceTextModule(s,{context:ctx,identifier:file})));return cache.get(file)}
const m=await mod(new URL('../sync-fix/worker/worker_notify_v140_validation_lanes.js',import.meta.url).pathname);await m.link((s,p)=>s==='cloudflare:workers'?cf:s==='node:module'?nm:mod(path.resolve(path.dirname(p.identifier),s)));await m.evaluate();const W=m.namespace.BackgroundWatcher,P=Object.getPrototypeOf(W.prototype);
const map=new Map(),alarms=[];let alarm=null,enabled=true;
const storage={get:async k=>structuredClone(map.get(k)),put:async(k,v)=>map.set(k,structuredClone(v)),delete:async k=>map.delete(k),getAlarm:async()=>alarm,setAlarm:async at=>{alarm=at;alarms.push(at)}};
const w=new W({storage},{APISPORTS_KEY:'mock',API_TOTAL_DAILY_BUDGET:'72000',VALIDATION_DAILY_BUDGET:'4000'});w.scanControl=async()=>({enabled});
const normalDue=Date.now()+30000;
P.resolveDueValidations=async function(){for(let i=0;i<8;i++)await this.validationApi('/fixtures',{})};
P.accuracyTick=async function(){for(let i=0;i<6;i++)await this.validationApi('/fixtures',{})};
P.alarm=async function(){for(let i=0;i<50;i++)await this.api('/fixtures',{},true);await this.resolveDueValidations();await this.accuracyTick();await storage.setAlarm(normalDue)};
// Reproduce the old same-invocation failure with the real API/global quota methods.
await assert.rejects(()=>P.alarm.call(new P.constructor({storage},w.env)),/Too many subrequests/);
external=0;total=0;map.clear();alarms.length=0;
await w.alarm();assert.equal(external,50);assert.equal(map.get('accuracy:alarm-lane').kind,'VALIDATION');assert.equal(map.get('accuracy:alarm-lane').normal_due,normalDue);assert.ok(alarm<normalDue);
// A separate alarm invocation receives a fresh platform subrequest allowance.
external=0;await w.alarm();assert.equal(external,14);assert.equal(total,64);assert.equal(alarm,normalDue);assert.equal(map.has('accuracy:alarm-lane'),false);assert.equal(map.get('api:q50000:global:v1').used,64);assert.equal(map.get('notify:validation-budget').used,14);
// Pause prevents validation requests and an autonomous scan restart.
map.set('accuracy:alarm-lane',{kind:'VALIDATION',normal_due:normalDue});enabled=false;P.alarm=async()=>{};const before=total,count=alarms.length;await w.alarm();assert.equal(total,before);assert.equal(alarms.length,count);assert.equal(map.has('accuracy:alarm-lane'),false);
// Validation failure restores the inherited scan due time without hiding it.
enabled=true;map.set('accuracy:alarm-lane',{kind:'VALIDATION',normal_due:normalDue});P.resolveDueValidations=async()=>{throw Error('PROVIDER_TEST_FAILURE')};await w.alarm();assert.equal(alarm,normalDue);assert.equal(map.get('accuracy:lane-status').ok,false);
console.log('PASS separate Validation alarm: reproduced 50-subrequest failure, fresh invocation, counters, inherited cadence, pause and error recovery');
