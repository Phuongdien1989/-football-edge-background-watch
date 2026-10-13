import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {uiStatePacket} from '../notify-ui-state.mjs';
const require=createRequire(import.meta.url);
const front=require('./fixtures/fe-ui-sync-core.cjs');
const now=Date.now(),device='a'.repeat(64),other='b'.repeat(64);
const item={id:1,history:[{captured_at:now}],h1History:[],hcHistory:[{captured_at:now-30000,metrics:{gap:60}},{captured_at:now,metrics:{gap:75}}],
 last:{at:now,sourceHealth:{stats:'OK'}},ui:{fixture:{fixture:{id:1,status:{short:'2H',elapsed:66}},teams:{home:{name:'Home'},away:{name:'Away'}},goals:{home:0,away:0}},
 captured_at:now,revision:now,version:'1:'+now,snapshot:{minute:66},engines:{FT:{score:80,scoreMode:'FULL'}},
 hc_snapshot:{captured_at:now,metrics:{gap:75}},goal_estimates:{[device]:{prob:80,source:'MODEL'},[other]:{prob:70,source:'CALIBRATED'}}}};
const packet=uiStatePacket([item],{device,now});
assert(front.valid(packet.snapshots[0]));
const store=front.makeStore();assert(store.apply(packet));assert.equal(front.disposition(store.read(1),now).key,'CURRENT');
assert.equal(packet.snapshots[0].goal_estimate.prob,80);
assert(!JSON.stringify(packet).includes(other),'Never publish another device calibration or the private goal map');
assert.equal(packet.snapshots[0].runtime.HC.history.length,1,'HC must use prior history before appending the current snapshot');
packet.snapshots[0].runtime.HC.history[0].metrics.gap=0;assert.equal(item.hcHistory[0].metrics.gap,60);
const error=uiStatePacket([{...item,last:{sourceHealth:{stats:'ERROR'},reason:'STATS_UNAVAILABLE'}}],{now,device});
assert.equal(front.disposition(error.snapshots[0],now).key,'ERROR');
assert.equal(front.disposition(uiStatePacket([item],{now:now+70000}).snapshots[0],now+70000).key,'STALE');
assert.equal(uiStatePacket([{id:2,last:{reason:'STATS_UNAVAILABLE'}}],{now}).snapshots.length,0,'Do not invent a snapshot for empty old records');
const old=structuredClone(item);old.ui.revision--;old.ui.captured_at--;old.ui.version='older';assert(store.apply(uiStatePacket([old],{device,now:now+1})));assert.equal(store.read(1).version,item.ui.version);

// Execute the actual production candidate GET route with D1 newer than legacy DO.
const source=readFileSync('worker_notify_v137_quota50000.js','utf8');
const body=source.slice(source.indexOf('export class BackgroundWatcher'),source.indexOf('export default base')).replace('export class','class');
class Base{constructor(ctx,env){this.ctx=ctx;this.env=env;}async fetch(){return new Response('NOT_FOUND',{status:404});}}
const reply=(d,status=200)=>Response.json(d,{status});
const C=new Function('HotPriorityWatcher','uiStatePacket','reply','n',body+';return BackgroundWatcher;')(Base,uiStatePacket,reply,(v,d=0)=>Number.isFinite(Number(v))?Number(v):d);
const d1=new Map([[1,item]]),legacy={...item,ui:{...item.ui,version:'legacy',revision:now-1000,captured_at:now-1000}};
let apiCalls=0,rowWrites=0,legacyWrites=0;
const db={prepare(sql){return {bind(id){return {...this,first:async()=>d1.has(id)?{payload:JSON.stringify(d1.get(id))}:null};},
 run:async()=>{assert(sql.startsWith('CREATE TABLE IF NOT EXISTS'));return {success:true};},
 all:async()=>({results:[...d1].map(([fixture_id,x])=>({fixture_id,payload:JSON.stringify(x)}))})};}};
const ctx={storage:{get:async key=>key.startsWith('notify:match:')?legacy:null,list:async()=>new Map([['notify:match:1',legacy]]),put:async()=>{legacyWrites++;},delete:async()=>{rowWrites++;}}};
const c=new C(ctx,{LIVE_STATE_D1_ENABLED:'true',FOOTBALL_DB:db});c.api=async()=>{apiCalls++;throw Error('UNEXPECTED_PROVIDER_CALL');};
const response=await c.fetch(new Request('https://internal/api/notify/ui-state?fixture=1&device='+device));
assert.equal(response.status,200);assert.equal((await response.json()).snapshots[0].version,item.ui.version);
assert.equal(apiCalls,0);assert.equal(rowWrites,0);assert.equal(legacyWrites,0);
assert.equal((await c.fetch(new Request('https://internal/api/notify/ui-state?fixture=abc'))).status,400);
assert.equal((await c.fetch(new Request('https://internal/api/notify/ui-state?device=invalid'))).status,400);
d1.set(1,{__fe_deleted:true});assert.equal((await (await c.fetch(new Request('https://internal/api/notify/ui-state?fixture=1'))).json()).snapshots.length,0);

// HC validation must follow the D1-aware accessor instead of frozen legacy DO.
const validation=readFileSync('worker_notify_v131.js','utf8');
const method=validation.slice(validation.indexOf('  async resolveGapValidation('),validation.indexOf('  async resolveDueValidations(')).replace('async resolveGapValidation(','async function(');
const resolve=new Function('num','return '+method)((v,d=null)=>Number.isFinite(Number(v))?Number(v):d);
let readD1=false,finished;
await resolve.call({getNotifyMatch:async()=>{readD1=true;return {last:{gap:75,at:Date.now()}};},ctx:{storage:{get:async()=>{throw Error('READ_FROZEN_LEGACY');}}},
 finishValidation:async(key,v,result)=>{finished=result;},deferValidation:async()=>{throw Error('UNEXPECTED_DEFER');}},'key',{fixture_id:1,gap_signed:72,threshold:70});
assert(readD1);assert.equal(finished,'SAME_ABOVE_THRESHOLD');
console.log('PASS: unchanged frontend consumes D1 snapshots; no provider calls, stale/failure guards, private calibration isolation and HC validation migration');
