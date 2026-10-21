import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {patchStatus} from './patch.mjs';
import {createHTCollection} from '../ht-early-candidate/collection.mjs';
import {createHTHistoryCache} from '../ht-early-candidate/history.mjs';
const root=process.argv[2]||'scan-status-fix/source';
const inputs=Object.fromEntries(['worker_notify_v130.js','worker_notify_v138_peak_window.js'].map(p=>[p,readFileSync(root+'/'+p,'utf8')]));
const patched=patchStatus(inputs);let clock=1792569510000;
class Clock extends Date{static now(){return clock;}}
class Parent{async fetch(){return Response.json({scan:await this.ctx.storage.get('notify:status'),devices:[]});}}
const load=s=>vm.runInNewContext(s.replace(/^import .*$/gm,'').replace('export class BackgroundWatcher','class BackgroundWatcher').replace('export default base;','')+'\nBackgroundWatcher', {DeepLinkWatcher:Parent,createEngine:()=>({}),createHTCollection,createHTHistoryCache,readHTContext:async()=>({rows:[]}),Date:Clock,Response,Request,URL,TextEncoder,console,structuredClone});
const Old=load(inputs['worker_notify_v130.js']),New=load(patched['worker_notify_v130.js']);
function instance(Class,prior){const writes=[],db=new Map([['notify:status',prior],['notify:budget',{day:new Date(clock).toISOString().slice(0,10),used:0}]]);const w=new Class();w.env={NOTIFY_DAILY_BUDGET:43000};w.ctx={storage:{get:async k=>structuredClone(db.get(k)),put:async(k,v)=>{writes.push(k);db.set(k,structuredClone(v));}}};w.scanControl=async()=>({enabled:true});w.devices=async()=>[{id:'test',prefs:{enabled:true,h1:true}}];w.listNotifyMatches=async()=>[];w.api=async()=>[];return {w,db,writes};}
const prior={at:clock-30000,startedAt:clock-30000,errors:[{error:'LIVE_DISCOVERY_UPSTREAM_ERROR:API_PROVIDER_COOLDOWN'}],alertsAccepted:0,signalCrossings:0};
const old=instance(Old,prior);await old.w.notifyTick();assert.equal(old.db.get('notify:status').errors.length,1,'REPRO_STALE_FAILURE');
const next=instance(New,prior);await next.w.notifyTick();assert.equal(next.db.get('notify:status').errors.length,0);assert.equal(next.writes.filter(k=>k==='notify:status').length,1);
clock+=30000;next.writes.length=0;await next.w.notifyTick();assert.equal(next.writes.filter(k=>k==='notify:status').length,0,'NO_DURABLE_WRITE_EVERY_CYCLE');
let view=await (await next.w.fetch(new Request('https://internal/api/notify/status'))).json();assert.equal(view.scan.at,clock);assert.equal(view.scan.errors.length,0);assert.equal(view.scan.live,0);assert.equal(view.scan.alertsAccepted,0);
const current=await next.w.notifyStatusView();clock+=10000;assert.equal((await next.w.notifyStatusView()).at,current.at,'GET_NEVER_REFRESHES_HEARTBEAT');
const checkpoint=instance(New,{at:clock,errors:[],alertsAccepted:0,signalCrossings:0});
clock+=59000;await checkpoint.w.notifyTick();assert.equal(checkpoint.writes.filter(k=>k==='notify:status').length,0);
clock+=1000;await checkpoint.w.notifyTick();assert.equal(checkpoint.writes.filter(k=>k==='notify:status').length,1,'DURABLE_HEARTBEAT_WITHIN_UI_90_SECOND_WINDOW');
next.db.set('notify:status',{at:clock,paused:true,scanEnabled:false,errors:[]});assert.equal((await next.w.notifyStatusView()).paused,true,'PAUSE_WINS');
const restart=instance(New,next.db.get('notify:status'));assert.equal((await restart.w.notifyStatusView()).at,clock,'RESTART_USES_DURABLE_TIMESTAMP');
clock+=1000;restart.w.api=async()=>{throw Error('API_PROVIDER_COOLDOWN')};await restart.w.notifyTick();assert.equal(restart.db.get('notify:status').errors.length,1,'CURRENT_ERROR_NOT_HIDDEN');
const failureWrites=restart.writes.filter(k=>k==='notify:status').length;clock+=30000;await restart.w.notifyTick();assert.equal(restart.writes.filter(k=>k==='notify:status').length,failureWrites,'REPEATED_FAILURE_STILL_THROTTLED');
clock+=120001;restart.w.api=async()=>[];await restart.w.notifyTick();assert.equal(restart.db.get('notify:status').errors.length,0);
assert(patched['worker_notify_v138_peak_window.js'].includes('status=await this.notifyStatusView()'));
console.log(JSON.stringify({status:'PASS',reproduced_old_stale_failure:true,cases:13,no_provider_requests:true,no_push_sends:true,no_extra_per_cycle_status_write:true,durable_status_interval_seconds:60}));
