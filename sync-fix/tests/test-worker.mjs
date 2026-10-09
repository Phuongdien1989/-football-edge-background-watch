import vm from 'node:vm';import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';import {createRequire} from 'node:module';import {Buffer} from 'node:buffer';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../worker',import.meta.url)),cache=new Map();
const context=vm.createContext({console,Request,Response,Headers,TextEncoder,TextDecoder,URL,URLSearchParams,AbortController,AbortSignal,crypto:webcrypto,setTimeout,clearTimeout,btoa,atob,Buffer,process:{env:{}},fetch:()=>{throw Error('NETWORK_FORBIDDEN');}});
const cf=new vm.SyntheticModule(['DurableObject'],function(){this.setExport('DurableObject',class{constructor(ctx,env){this.ctx=ctx;this.env=env;}});},{context});
const nm=new vm.SyntheticModule(['createRequire'],function(){this.setExport('createRequire',createRequire);},{context});
async function module(file){if(cache.has(file))return cache.get(file);const promise=fs.readFile(file,'utf8').then(src=>new vm.SourceTextModule(src,{context,identifier:file}));cache.set(file,promise);return promise;}
const m=await module(path.join(root,'worker_notify_v138_sync.js'));await m.link((spec,parent)=>spec==='cloudflare:workers'?cf:spec==='node:module'?nm:module(path.resolve(path.dirname(parent.identifier),spec)));await m.evaluate();const W=m.namespace.BackgroundWatcher;
const db=new Map(),storage={get:async key=>db.get(key),put:async(key,val)=>{if(typeof key==='object')for(const [k,v]of Object.entries(key))db.set(k,structuredClone(v));else db.set(key,structuredClone(val));},list:async({prefix})=>new Map([...db].filter(([k])=>k.startsWith(prefix))),setAlarm:async()=>{},delete:async k=>db.delete(k)};
const watcher=new W({storage},{BACKGROUND_TOKEN:'test-secret',FRONTEND_APP_URL:'https://app.example'});
const linkModule=await module(path.join(root,'worker_notify_v128.js')),LinkWatcher=linkModule.namespace.BackgroundWatcher;
Object.getPrototypeOf(LinkWatcher.prototype).send=async(d,p)=>p;
const routed=await new LinkWatcher({storage},{FRONTEND_APP_URL:'https://staging.example'}).send({}, {url:'https://production.example/?fe_fixture=11&fe_snapshot=v1#analysisCard'});
assert.equal(new URL(routed.url).origin,'https://shiny-silence-d892.ngophuonghuy.workers.dev');assert.equal(new URL(routed.url).searchParams.get('fe_snapshot'),'v1');
const f={fixture:{id:11,status:{short:'2H',elapsed:66}},teams:{home:{id:1,name:'HOME'},away:{id:2,name:'AWAY'}},league:{name:'Test'},goals:{home:0,away:0}};
await watcher.uiLiveSet([f]);const at=Date.now();const version=await watcher.publishUISnapshot(f,{captured_at:at,minute:66}, {FT:{score:72}}, {stats:'OK',events:'EMPTY'});
let called=false;Object.getPrototypeOf(W.prototype).send=async function(d,p){called=true;return p;};
const p=await watcher.send({}, {fixture_id:11,created_at:at,url:'https://app.example/?fe_fixture=11',signals:{goal:{value:70}}});assert(called);assert.equal(p.snapshot_version,version);assert.equal(new URL(p.url).searchParams.get('fe_snapshot'),version);
Object.getPrototypeOf(W.prototype).send=async()=>true;await watcher.send({id:'dev1'}, {fixture_id:11,created_at:at,url:'https://app.example/?fe_fixture=11',signals:{goal:{value:70,threshold:70}}});assert.equal(db.get('notify:ui-alert:dev1:11').snapshot_version,version);
Object.getPrototypeOf(W.prototype).send=async()=>false;await watcher.send({id:'failed'}, {fixture_id:11,created_at:at,url:'https://app.example/?fe_fixture=11'});assert.equal(db.has('notify:ui-alert:failed:11'),false);
called=false;await assert.rejects(()=>watcher.send({}, {fixture_id:11,created_at:at-1,url:'https://app.example/'}),/NOT_COMMITTED/);assert.equal(called,false);
let r=await watcher.fetch(new Request('https://worker.example/api/notify/ui-state'));assert.equal(r.status,401);
r=await watcher.fetch(new Request('https://worker.example/api/notify/ui-state?device=dev1',{headers:{authorization:'Bearer test-secret'}}));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');let body=await r.json();assert.equal(body.snapshots[0].version,version);assert.equal(body.live_count,1);assert.equal(body.snapshots[0].last_notification.signals.goal.value,70);
await watcher.uiLiveSet([]);r=await watcher.fetch(new Request('https://worker.example/api/notify/ui-state?fixture=11',{headers:{authorization:'Bearer test-secret'}}));body=await r.json();assert.equal(body.snapshots[0].active_live,false);
await assert.rejects(()=>watcher.publishUISnapshot(f,{captured_at:at-1},{},{}),/OUT_OF_ORDER/);
await watcher.publishUISnapshot(f,null,{}, {stats:'EMPTY'});const empty=db.get('notify:ui:11');assert.equal(empty.snapshot,null);assert.equal(empty.source_health.stats,'EMPTY');assert.equal(empty.revision,2);
// Execute the actual patched scanner with fake provider and no subscription send.
const scanner=new W({storage},{BACKGROUND_TOKEN:'test-secret',NOTIFY_DAILY_BUDGET:100});scanner.devices=async()=>[{id:'dev',prefs:{enabled:true,goal:true,h1:false,gap:false}}];
scanner.api=async endpoint=>endpoint==='/fixtures'?[f]:[];
await scanner.notifyTick();assert.equal(db.get('notify:ui:11').source_health.stats,'EMPTY');assert.equal(db.get('notify:ui-live').ids[0],11);
// Actual nonempty-stat route reaches publication BEFORE any device send.
const stats=[1,2].map(id=>({team:{id},statistics:[['Total Shots',10],['Shots on Goal',3],['Shots insidebox',5],['Corner Kicks',3],['Ball Possession','50%'],['expected_goals','0.8'],['Red Cards',0]].map(([type,value])=>({type,value}))}));
scanner.api=async endpoint=>endpoint==='/fixtures'?[f]:endpoint==='/fixtures/statistics'?stats:[];
await scanner.notifyTick();assert.equal(db.get('notify:ui:11').source_health.stats,'OK');assert.equal(db.get('notify:ui:11').fixture.fixture.id,11);assert(db.get('notify:ui:11').engines.FT);
await fs.writeFile(new URL('./mock-row.json',import.meta.url),JSON.stringify(db.get('notify:ui:11')));
console.log('PASS: real module import, auth, canonical readback, commit-before-send, exact version link, absence from LIVE, revision, actual empty/full scanner with provider mock; zero network');
