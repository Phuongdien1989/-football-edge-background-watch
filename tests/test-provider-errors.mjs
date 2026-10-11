import assert from 'node:assert/strict';
import {providerObservation,providerRateScope} from '../provider_errors.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const response=(status,headers={})=>new Response('{}',{status,headers});
assert.equal(providerRateScope('Too many requests from your IP address'),'IP');
assert.equal(providerRateScope('per-minute request limit'),'MINUTE');
assert.equal(providerRateScope('per-second limit'),'SECOND');
assert.equal(providerRateScope('opaque provider error'),'UNSPECIFIED');
let p=providerObservation(response(200),{errors:{rateLimit:'Too many requests. You have reached your per-minute request limit.'},response:[]});
assert.equal(p.code,'API_PROVIDER_RATE_LIMIT');
p=providerObservation(response(429,{'retry-after':'12','x-ratelimit-limit':'450'}),{errors:[],response:[]});
assert.equal(p.code,'API_PROVIDER_RATE_LIMIT');assert.equal(p.retry_after_ms,12000);assert.equal(p.limits.minute_limit,450);
assert.equal(providerObservation(response(200,{'x-ratelimit-requests-remaining':'0'}),{errors:[],response:[{id:1}]}).code,'OK','last allowed request still returns valid data');
assert.equal(providerObservation(response(200,{'x-ratelimit-requests-remaining':'0'}),{errors:{requests:'daily limit reached'},response:[]}).code,'API_PROVIDER_DAILY_QUOTA_REACHED');
p=providerObservation(response(401),{errors:{token:'bad SECRETKEY secret@example.com https://api.test/SECRETKEY'},response:[]},'SECRETKEY');
assert.equal(p.code,'API_AUTH_OR_SUBSCRIPTION_ERROR');assert.ok(!p.detail.includes('SECRETKEY'));assert.ok(!p.detail.includes('secret@example.com'));
assert.equal(providerObservation(response(503),{response:[]}).code,'API_PROVIDER_SERVER_ERROR');
const source=readFileSync('worker_notify_v137_quota50000.js','utf8');
const method=source.slice(source.indexOf('  providerPacingCfg(){'),source.indexOf('  async recordProviderObservation(')).replace('\n  async beforeProviderRequest()',',\n  async beforeProviderRequest()');
let now=1000,reservations=0,waits=[];
const watcher=vm.runInNewContext('({'+method+'})',{Date:{now:()=>now},n:(v,d=0)=>Number.isFinite(Number(v))?Number(v):d,Number,Math,Promise,setTimeout:(fn,ms)=>{waits.push(ms);now+=ms;fn();}});
watcher.ctx={storage:{get:async()=>null}};watcher.env={API_PROVIDER_MINUTE_LIMIT:'450'};watcher.reserveApiCall=async()=>{reservations++;};watcher._providerMinuteLimit=450;
await Promise.all([watcher.beforeProviderRequest(),watcher.beforeProviderRequest(),watcher.beforeProviderRequest()]);
assert.equal(reservations,3);assert.equal(waits.length,2,'concurrent starts obey provider slots');
// Cold-start burst before any successful provider header: the previous code sent
// all 18 parallel detail requests at the same timestamp.
for(const learned of [undefined,450,300]){
  now=0;const starts=[];delete watcher._providerNextStart;delete watcher._providerStartWork;
  watcher._providerMinuteLimit=learned;watcher.reserveApiCall=async()=>starts.push(now);
  await Promise.all(Array.from({length:18},()=>watcher.beforeProviderRequest()));
  const cap=learned===300?5:7;
  for(const at of starts)assert.ok(starts.filter(t=>t>=at&&t<at+1000).length<=cap,'cold start and stricter learned headers obey rolling second cap');
  assert.ok(starts.at(-1)>2000,'requests cannot burst before first successful response');
}
watcher._providerMinuteLimit=900;assert.equal(watcher.providerPacingCfg().effective_minute_limit,450,'advertised higher limit cannot exceed configured subscription');
watcher._providerMinuteLimit=undefined;assert.equal(watcher.providerPacingCfg().start_gap_ms,143,'missing rate headers preserve bootstrap spacing');
console.log('PASS: cold-start 18-request burst prevented, restart bootstrap and stricter provider limits');
// Cooldown prevents all branches from spending tokens or sending a request.
watcher._providerRetryAt=now+60000;let duringCooldown=0;watcher.reserveApiCall=async()=>duringCooldown++;
const blocked=await Promise.allSettled(Array.from({length:18},()=>watcher.beforeProviderRequest()));
assert.ok(blocked.every(x=>x.status==='rejected'&&x.reason.message==='API_PROVIDER_COOLDOWN'&&x.reason.retryable===false));assert.equal(duringCooldown,0);
watcher._providerCooldownLoaded=false;watcher._providerRetryAt=0;watcher.ctx.storage.get=async()=>({until:now+60000,failures:2});
await assert.rejects(watcher.beforeProviderRequest(),/API_PROVIDER_COOLDOWN/);assert.equal(duringCooldown,0,'restart cannot bypass provider cooldown');
console.log('PASS: shared cooldown blocks all physical calls and reservations, survives restart');
const observerMethod=source.slice(source.indexOf('  async recordProviderObservation('),source.indexOf('  async fetch(request)',source.indexOf('  async recordProviderObservation(')));
const saved=new Map();let cooldownWrites=0;
const observer=vm.runInNewContext('({'+observerMethod+'})',{Date:{now:()=>now},Number,Math});
observer.ctx={storage:{get:async k=>saved.get(k),put:async(k,v)=>{saved.set(k,v);if(k==='api:provider-cooldown:v1')cooldownWrites++;}}};
const rate=()=>({at:now,code:'API_PROVIDER_RATE_LIMIT',limits:{minute_limit:null},retry_after_ms:0});
await observer.recordProviderObservation(rate());const firstUntil=observer._providerRetryAt;
for(let i=0;i<18;i++)await observer.recordProviderObservation(rate());
assert.equal(observer._providerRateFailures,1);assert.equal(cooldownWrites,1,'one batch shares one durable cooldown episode');
await observer.recordProviderObservation({at:now,code:'OK',limits:{minute_limit:450}});
assert.equal(observer._providerRetryAt,firstUntil,'old in-flight success cannot cancel active cooldown');
now=firstUntil;await observer.recordProviderObservation(rate());assert.equal(observer._providerRetryAt-now,120000,'repeat failure increases backoff');
now=observer._providerRetryAt;await observer.recordProviderObservation({at:now,code:'OK',limits:{minute_limit:450}});
assert.equal(observer._providerRateFailures,0);assert.equal(observer._providerRetryAt,0,'successful recovery resets cooldown');
console.log('PASS: bounded progressive cooldown, in-flight race guard and successful recovery');
const base=readFileSync('worker.js','utf8');
assert.ok(base.indexOf('await this.beforeProviderRequest()')<base.indexOf('const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);',base.indexOf('  async api(')),'network timeout starts after provider slot wait');
assert.match(base,/await this\.beforeProviderRequest\(\)/,'each physical retry traverses the prepaid guard');
console.log('PASS: structured API error codes, rate headers, Retry-After, secret redaction, last quota call, serialized request starts, per-attempt accounting');

const start=base.indexOf('  async api(path,params={},strict=false){');
const apiMethod=base.slice(start,base.indexOf('  async listWatches(){',start));
let physical=0;
const baseApi=vm.runInNewContext('({'+apiMethod+'})',{URL,AbortController,Error,Object,JSON,providerObservation,
 setTimeout:()=>0,clearTimeout:()=>{},fetch:async()=>{physical++;return new Response(JSON.stringify({errors:[],response:[]}),{status:physical===1?503:200});}});
class ResilientWatcher{async api(...args){return baseApi.api.call(this,...args);}}
const retrySource=readFileSync('worker_notify_v126.js','utf8').replace(/^import .*;\n/,'').replace('export class BackgroundWatcher','class BackgroundWatcher').split('export default')[0];
const Retry=vm.runInNewContext(retrySource+';BackgroundWatcher',{ResilientWatcher,Error,String,Promise,setTimeout:fn=>fn()});
const retryWatcher=new Retry();retryWatcher.env={APISPORTS_KEY:'TEST_ONLY',APISPORTS_BASE:'https://provider.test'};
let physicalReservations=0;retryWatcher.beforeProviderRequest=async()=>{physicalReservations++;};
await retryWatcher.api('/fixtures',{live:'all'},true);
assert.equal(physical,2);assert.equal(physicalReservations,2,'each actual retry must prepay a separate global token');
console.log('PASS: real retry inheritance counts each outbound HTTP attempt before sending');
