import vm from 'node:vm';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
const repo=new URL('../',import.meta.url).pathname;
let checks=0;
for(const entry of ['worker_notify_v137_quota50000.js','sync-fix/worker/worker_notify_v139_accuracy.js']){
  let calls=0;
  const ctx=vm.createContext({console,Request,Response,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,AbortController,AbortSignal,crypto:webcrypto,setTimeout,clearTimeout,btoa,atob,Buffer,process:{env:{}},fetch:async()=>{calls++;return new Response(JSON.stringify({response:[],errors:[]}))}});
  const cache=new Map(),cf=new vm.SyntheticModule(['DurableObject'],function(){this.setExport('DurableObject',class{constructor(ctx,env){this.ctx=ctx;this.env=env}})},{context:ctx}),nm=new vm.SyntheticModule(['createRequire'],function(){this.setExport('createRequire',createRequire)},{context:ctx});
  async function mod(file){if(!cache.has(file))cache.set(file,fs.readFile(file,'utf8').then(s=>new vm.SourceTextModule(s,{context:ctx,identifier:file})));return cache.get(file)}
  const m=await mod(path.join(repo,entry));await m.link((s,p)=>s==='cloudflare:workers'?cf:s==='node:module'?nm:mod(path.resolve(path.dirname(p.identifier),s)));await m.evaluate();
  const W=m.namespace.BackgroundWatcher,map=new Map(),storage={get:async k=>structuredClone(map.get(k)),put:async(k,v)=>{if(typeof k==='object')for(const [key,value]of Object.entries(k))map.set(key,structuredClone(value));else map.set(k,structuredClone(v))},list:async({prefix})=>new Map([...map].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)])),delete:async k=>map.delete(k)},env={API_TOTAL_DAILY_BUDGET:'72000',NOTIFY_DAILY_BUDGET:'62000',VALIDATION_DAILY_BUDGET:'4000',APISPORTS_KEY:'mock',BACKGROUND_TOKEN:'mock'},day=new Date().toISOString().slice(0,10),key='api:q50000:global:v1';
  let w=new W({storage},env);
  const equal=(a,b)=>{assert.equal(a,b);checks++};
  map.set(key,{day,used:49701,limit:50000});
  equal((await w.quotaStatus()).used,49701);equal((await w.quotaStatus()).remaining,22299);
  await w.api('/fixtures',{live:'all'},true);equal(map.get(key).used,49702);equal(calls,1);
  w=new W({storage},env);equal((await w.quotaStatus()).used,49702);
  map.set(key,{day,used:71998,limit:72000});
  const concurrent=await Promise.allSettled(Array.from({length:20},()=>w.api('/fixtures',{},true)));
  equal(concurrent.filter(r=>r.status==='fulfilled').length,2);equal(map.get(key).used,72000);equal(calls,3);
  assert.ok(concurrent.filter(r=>r.status==='rejected').every(r=>r.reason.message==='API_TOTAL_DAILY_BUDGET_REACHED'));checks++;
  map.set(key,{day:'2000-01-01',used:72000,limit:72000});await w.api('/fixtures',{},true);equal(map.get(key).used,1);equal(map.get(key).day,day);
  // Actual inherited notification scan respects its own pool and global counter.
  map.set('notify:budget',{day,used:61999});w.devices=async()=>[{id:'mock',prefs:{enabled:true,goal:true}}];
  await w.notifyTick();equal(map.get('notify:budget').used,62000);equal(map.get(key).used,2);
  await w.notifyTick();equal(map.get('notify:budget').used,62000);equal(map.get(key).used,2);
  assert.ok(map.get('notify:status').errors.some(e=>e.error==='NOTIFY_DAILY_BUDGET_REACHED'));checks++;
  // LIVE/Smart Follow still shares the global cap after Notification is exhausted.
  await w.api('/fixtures',{live:'all'},true);equal(map.get(key).used,3);
  if(entry.includes('v139')){
    map.set('notify:validation-budget',{day,used:3998});
    const validation=await Promise.allSettled(Array.from({length:12},()=>w.validationApi('/fixtures',{id:1})));
    equal(validation.filter(r=>r.status==='fulfilled').length,2);equal(map.get('notify:validation-budget').used,4000);equal(map.get(key).used,5);
    assert.ok(validation.filter(r=>r.status==='rejected').every(r=>r.reason.message==='VALIDATION_DAILY_BUDGET_REACHED'));checks++;
    const restarted=new W({storage},env);await assert.rejects(()=>restarted.validationApi('/fixtures',{}),/VALIDATION_DAILY_BUDGET_REACHED/);checks++;
  }
  console.log('PASS runtime quota chain '+entry);
}
console.log(`PASS Ultra runtime quota ${checks} assertions: concurrent boundary, durable restart, UTC rollover, LIVE/Notification/Validation pools; zero external requests`);
