import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHTCollection} from './collection.mjs';
import {createHTTemporal} from './temporal.mjs';
import * as mobileFunctions from './mobile-collection.mjs';
let now=1792526400000;
class Clock extends Date {static now(){return now;}}
const policy=createHTCollection(),temporal=createHTTemporal();
const mobile=readFileSync('ht-early-candidate/generated/index.html','utf8');
const worker=readFileSync('ht-early-candidate/generated/backend/worker_notify_v130.js','utf8');
const backend=readFileSync('ht-early-candidate/generated/backend/notify-core-h1.js','utf8');
const baseline=readFileSync('ui-tabs-preview/generated/candidate/index.html','utf8');
const normalize=x=>JSON.parse(JSON.stringify(x));
function fn(source,name) {
  const token=source.includes('  async function '+name+'(')?'  async function '+name+'(':'  function '+name+'(';
  const start=source.indexOf(token);assert(start>=0,name);
  const ends=['\n  function ','\n  async function '].map(t=>source.indexOf(t,start+token.length)).filter(i=>i>=0);
  return source.slice(start,Math.min(...ends));
}
const fixtures=Array.from({length:12},(_,i)=>({fixture:{id:i+1,status:{short:'1H',elapsed:8}},teams:{home:{id:100+i,name:'H'+i},away:{id:200+i,name:'A'+i}},league:{name:'Test'},goals:{home:0,away:0}}));
const presence={shots:true,sot:true,inbox:true,corners:true,xg:true,core:true,pressure:true,chance:true,momentum:true,coverage:5};
const snap=(minute=8,at=now)=>({captured_at:at,fresh_at:at,minute,status:'1H',goals:{home:0,away:0},dq:72,integrity:100,metrics:{total:{shots:4,sot:1,inbox:2,corners:1,xg:.2,red:0}},stats_presence:presence,market:{raw_count:0,valid_count:0,has_over:false},events:[],data_health:{level:'HEALTHY'}});
let count=0;const check=async(name,run)=>{await run();count++;console.log('PASS '+name);};
await check('only valid first-half fixtures eligible from minute zero',()=>{
  assert(policy.eligible({...fixtures[0],fixture:{id:1,status:{short:'1H',elapsed:0}}}));
  for(const status of [{short:'2H',elapsed:40},{short:'HT',elapsed:45},{short:'1H',elapsed:null},{short:'1H',elapsed:46}])assert(!policy.eligible({...fixtures[0],fixture:{id:1,status}}));
});
await check('planner OFF has no work; ON is bounded and IDs distinct',()=>{
  assert.equal(policy.plan(fixtures,new Map()).length,0);
  const selected=policy.plan([...fixtures,fixtures[0]],new Map(),{enabled:true,slots:99,now});
  assert.equal(selected.length,5);assert.equal(new Set(selected.map(f=>f.fixture.id)).size,5);
});
await check('quiet/unseen fixtures are revisited even with four active fixtures',()=>{
  const pool=new Map(fixtures.map(f=>[f.fixture.id,{lastProbeAt:now-1000,latest:snap(),collectionActive:f.fixture.id<=4}])),visited=new Set();
  for(let i=0;i<12;i++) {
    const batch=policy.plan(fixtures,pool,{enabled:true,slots:5,now:now+i*22000});
    for(const f of batch){visited.add(f.fixture.id);pool.get(f.fixture.id).lastProbeAt=now+i*22000;pool.get(f.fixture.id).latest=snap(8,now+i*22000);}
  }
  assert.equal(visited.size,fixtures.length);
});
await check('cached or stale/future responses do not create new history',()=>{
  const s=snap(),a=policy.appendHistory([],s,now);assert(a.accepted);
  assert(!policy.appendHistory(a.history,{...s,captured_at:now+1000},now+1000).accepted);
  assert(!policy.appendHistory([],{...s,fresh_at:now-56000},now).accepted);
  assert(!policy.appendHistory([],{...s,fresh_at:now+1},now).accepted);
  const slim=policy.appendHistory([],{...s,fixture:fixtures[0],market_rows:[{large:'payload'}]},now);
  assert.equal(slim.history[0].fixture,undefined);assert.equal(slim.history[0].market_rows,undefined);assert.deepEqual(slim.history[0].metrics,s.metrics);
});
await check('early evidence has no strength probability, recommendation or Push eligibility',()=>{
  const e=policy.earlyEvaluation({history:[snap()]},snap(),temporal);
  assert.equal(e.score,null);assert.equal(e.recommendation,'WAIT');assert.equal(e.scoreMode,'EARLY_EVIDENCE');assert.equal(e.accel,null);
  const gate=vm.createContext({});vm.runInContext(worker.match(/function h1Gate\([\s\S]*?\n}\n/)[0],gate);assert.equal(gate.h1Gate(e,1),false);
});
function makeMobile() {
  const calls=[],timers=[],writes=[],errors=[],ctx=vm.createContext({Date:Clock,Math,Map,Set,Number,Object,Array,Promise,HTCollection:policy,HTTemporal:temporal,H1_COLLECTION:{pool:new Map(),generation:0},H1_WATCH_MAX_ITEMS:5,
    loadHTCollectionContext:async()=>({at:now,rows:[]}),h1WatchState:{active:false,refreshing:false,items:[],cycle:0},ULTRA_HUB:{heartbeat:{at:now},entries:new Map()},ULTRA_HUB_POLICY:{BACKGROUND:{stats:18000}},
    document:{visibilityState:'visible'},els:{fkey:{value:'TEST_PLACEHOLDER'}},$:()=>({checked:true}),status:(el,msg,type)=>{if(type==='err')errors.push(msg);},showToast:()=>{},
    clearTimeout:()=>{},setTimeout:(f,ms)=>{timers.push(ms);return timers.length;},h1WatchNextInterval:()=>22000,updateH1WatchClock:()=>{},
    feCaptureOtherEngines:()=>({}),feRestoreOtherEngines:()=>{},h1WatchInitAudio:()=>{},feMarkEngineManualStop:()=>{},h1WatchReadHistory:()=>[],h1WatchWriteHistory:i=>writes.push(normalize(i.history)),
    feLiveSourceValid:()=>true,renderH1Watch:()=>{},ultraHubSummary:()=>'',
    ultraHeartbeat:async()=>{calls.push('heartbeat');return {rows:fixtures,at:now};},
    h1WatchThresholds:()=>({watch:54,candidate:64,ready:72,strong:79}),watchHealthLabel:()=>'',
    h1WatchCalRecord:()=>calls.push('calibration'),h1WatchCalSettle:()=>{},qsigUpdateH1:()=>{},h1WatchAlert:()=>calls.push('alert'),grTrack:()=>{},evidenceMaybeRefresh:()=>{},
    gpBuildShadow:async()=>null,lvmBuildShadow:async()=>null,lpvBuildShadow:async()=>null,rbBuildShadow:async()=>null,fmdBuildShadow:async()=>null,valUpdate:async()=>null,fmdAttachValidationT0:async()=>{},fmdJournalUpdate:async()=>null,fmdBenchmarkRefresh:async()=>{}});
  for(const name of ['startH1Watch','refreshH1Watch','scheduleH1Watch','stopH1Watch'])vm.runInContext(mobileFunctions[name].toString(),ctx);
  vm.runInContext(fn(baseline,'mapLimit'),ctx);
  const names=['watchClamp','watchMetricAvailable','watchMetricDelta','h1WatchWindow','h1WatchHistoryAge','h1WatchDisplayWindow','h1WatchFindBaseline','h1WatchMomentum','h1WatchQualityScore','h1WatchGameScore','h1WatchPressure','h1WatchChance','h1WatchMarketScore','h1WatchContextScore','h1WatchCore','h1WatchEvaluate','h1WatchEligible','h1WatchResetEvent','h1WatchApplyState'];
  vm.runInContext(names.map(n=>fn(mobile,n)).join('\n'),ctx);
  ctx.fetchH1CollectionSnapshot=async(item,f)=>{calls.push('snapshot:'+item.id);return {...snap(f.fixture.status.elapsed),fixture:f};};
  return {ctx,calls,timers,writes,errors};
}
await check('Mobile starts only on manual start and stops without losing collected history',async()=>{
  const m=makeMobile();await m.ctx.refreshH1Watch();assert.equal(m.calls.length,0);
  await m.ctx.startH1Watch();assert.equal(m.ctx.h1WatchState.items.length,5);assert.equal(m.calls.filter(x=>x.startsWith('snapshot:')).length,5);
  assert.deepEqual(m.errors,[]);
  assert(m.ctx.h1WatchState.items.every(i=>i.eval.scoreMode==='EARLY_EVIDENCE'&&i.state==='BASELINE'));
  assert.equal(m.calls.filter(x=>x==='alert'||x==='calibration').length,0);
  const saved=m.writes.length;m.ctx.stopH1Watch();await m.ctx.refreshH1Watch();assert.equal(m.writes.length,saved);assert.equal(m.ctx.H1_COLLECTION.pool.size,12);
});
await check('Mobile pause during discovery prevents all detail calls',async()=>{
  const m=makeMobile();let release,started;const entered=new Promise(r=>started=r);
  m.ctx.ultraHeartbeat=()=>{started();return new Promise(r=>release=r);};
  const p=m.ctx.startH1Watch();await entered;m.ctx.stopH1Watch();release({rows:fixtures});await p;
  assert.equal(m.calls.filter(x=>x.startsWith('snapshot:')).length,0);assert.equal(m.timers.length,0);
});
await check('Mobile pause during history loading prevents discovery and detail calls',async()=>{
  const m=makeMobile();let release;m.ctx.loadHTCollectionContext=()=>new Promise(r=>release=r);
  const p=m.ctx.startH1Watch();m.ctx.stopH1Watch();release({rows:[]});await p;assert.equal(m.calls.length,0);assert.equal(m.timers.length,0);
});
await check('Mobile pause during a detail request does not publish or schedule',async()=>{
  const m=makeMobile();let release;let waiting;
  const entered=new Promise(r=>waiting=r);
  m.ctx.fetchH1CollectionSnapshot=()=>{waiting();return new Promise(r=>release=r);};
  // Single fixture makes the in-flight completion and cancellation deterministic.
  m.ctx.ultraHeartbeat=async()=>({rows:[fixtures[0]]});
  const p=m.ctx.startH1Watch();await entered;m.ctx.stopH1Watch();release(snap());await p;
  assert.equal(m.writes.length,0);assert.equal(m.ctx.h1WatchState.items.length,0);assert.equal(m.timers.length,0);
});
await check('Mobile carries received early history into minute20 evaluator',async()=>{
  const m=makeMobile();let minute=17;
  m.ctx.ultraHeartbeat=async()=>({rows:[{...fixtures[0],fixture:{id:1,status:{short:'1H',elapsed:minute}}}]});
  await m.ctx.startH1Watch();
  for(let i=1;i<=6;i++){now+=30000;minute=17+i*.5;await m.ctx.refreshH1Watch(true);}
  const item=m.ctx.H1_COLLECTION.pool.get(1);assert.equal(item.history.length,7);assert.equal(item.latest.minute,20);assert.equal(item.eval.baselineAge,3);assert.notEqual(item.eval.scoreMode,'EARLY_EVIDENCE');
  m.ctx.stopH1Watch();
});
await check('Mobile collection failure cannot turn OFF into auto ON',async()=>{
  const m=makeMobile();m.ctx.ultraHeartbeat=async()=>{throw Error('PROVIDER_ERROR');};await m.ctx.startH1Watch();
  m.ctx.stopH1Watch();const before=m.calls.length;await m.ctx.refreshH1Watch(true);assert.equal(m.calls.length,before);assert.equal(m.ctx.h1WatchState.active,false);
});
function makeAcquisition({activeStats=false}={}) {
  const m=makeMobile(),ctx=m.ctx,network=[],persist=[];
  ctx.h1WatchState.active=true;
  ctx.ULTRA_HUB.metrics={reuse:0,stats:0,events:0,market:0,half:0,players:0,persist:0};
  ctx.ULTRA_HUB.inflight=new Map();ctx.ULTRA_HUB.cleanupAt=now;
  ctx.ULTRA_HUB_POLICY.BACKGROUND={stats:18000,events:25000,market:25000,half:90000,players:300000,lineups:1200000};
  ctx.ultraTierFor=()=> 'BACKGROUND';ctx.ultraSig=x=>JSON.stringify(x);
  ctx.ultraEntry=id=>{if(!ctx.ULTRA_HUB.entries.has(id))ctx.ULTRA_HUB.entries.set(id,{id,fields:{},changed:{},lastPersistAt:0});return ctx.ULTRA_HUB.entries.get(id);};
  ctx.football=async(path,params)=>{network.push({path,params});return path==='/fixtures/statistics'?[{total:{shots:activeStats?4:0,sot:activeStats?1:0,inbox:0,corners:0,xg:0,red:0}}]:[];};
  ctx.compactFixtureMeta=f=>f;ctx.autoModeForFixture=()=> 'LIVE';ctx.statMap=rows=>rows[0]||{};ctx.watchAggregate=sm=>({total:sm.total||{}});ctx.watchStatsPresence=()=>presence;
  ctx.eventsCompact=x=>x;ctx.groupCoverageScore=()=>({score:72,integrity_score:100});ctx.watchDataHealth=()=>({level:'HEALTHY'});ctx.h1WatchMarketInfo=()=>({valid_count:0,has_over:false});
  ctx.getBetReference=async()=>({byId:{}});ctx.oddsCompact=x=>x;ctx.ultraPersonnelContext=()=>({});ctx.ultraContentFreshness=()=>({});ctx.ultraPersistSnapshot=x=>persist.push(x);ctx.playersMatchCompact=x=>x;ctx.TZ='Asia/Bangkok';
  vm.runInContext(['ultraInflight','ultraAcceptField','ultraField','ultraLiveRaw'].map(n=>fn(baseline,n)).join('\n'),ctx);
  vm.runInContext(mobileFunctions.fetchH1CollectionSnapshot.toString(),ctx);
  return {...m,network,persist};
}
await check('actual shared HUB acquisition: quiet early fixture costs one stats probe, cached repeat costs zero',async()=>{
  const m=makeAcquisition(),item={id:1,history:[]};
  const s=await m.ctx.fetchH1CollectionSnapshot(item,fixtures[0],0);
  assert.equal(m.network.length,1);assert.equal(m.network[0].path,'/fixtures/statistics');assert.equal(s.fresh_at,now);
  await m.ctx.fetchH1CollectionSnapshot(item,fixtures[0],0);assert.equal(m.network.length,1);
});
await check('actual shared HUB acquisition deepens activity without duplicating stats or requesting half/player history',async()=>{
  const m=makeAcquisition({activeStats:true}),s=await m.ctx.fetchH1CollectionSnapshot({id:1,history:[]},fixtures[0],0);
  assert.equal(m.network.length,3);assert.equal(m.network.filter(x=>x.path==='/fixtures/statistics').length,1);
  assert(m.network.every(x=>!x.params.half&&!x.path.includes('players')));assert.equal(s.source,'HT_EARLY_SHARED_HUB');
});
await check('actual shared HUB reuses nested heartbeat statistics without another provider call',async()=>{
  const m=makeAcquisition(),f={...fixtures[0],statistics:[{total:{shots:0,sot:0,inbox:0,corners:0,xg:0,red:0}}]};
  await m.ctx.fetchH1CollectionSnapshot({id:1,history:[]},f,0);assert.equal(m.network.length,0);
});
await check('fresh verified server snapshot is reused without requests or a renewed timestamp',async()=>{
  const m=makeAcquisition(),s={...snap(8,now-10000),source:'NOTIFY_SERVER'},item={id:1,latest:s,serverRow:{source_health:{stats:'OK'}}};
  const result=await m.ctx.fetchH1CollectionSnapshot(item,fixtures[0],0);assert.equal(m.network.length,0);assert.equal(result.fresh_at,now-10000);
  const changed={...fixtures[0],goals:{home:1,away:0}};await m.ctx.fetchH1CollectionSnapshot(item,changed,0);assert(m.network.length>0);
});
await check('invalid stats response cannot make an old cache look fresh',async()=>{
  const m=makeAcquisition(),entry=m.ctx.ultraEntry(1);entry.fields.stats={at:now-60000,data:[{total:{shots:0}}]};
  m.ctx.football=async()=>null;
  await assert.rejects(m.ctx.fetchH1CollectionSnapshot({id:1},fixtures[0],0),/INVALID_RESPONSE/);assert.equal(entry.fields.stats.at,now-60000);
});
await check('stop during stats request prevents follow-on event and market requests',async()=>{
  const m=makeAcquisition({activeStats:true});let release;let entered;
  const waiting=new Promise(r=>entered=r);
  m.ctx.football=()=>{entered();return new Promise(r=>release=r);};
  const p=m.ctx.fetchH1CollectionSnapshot({id:1},fixtures[0],0);await waiting;m.ctx.stopH1Watch();release([{total:{shots:4,sot:1,inbox:2,xg:.2}}]);
  assert.equal(await p,null);assert.equal(m.persist.length,0);
});
function makeBackend(source,enabled=true) {
  const calls=[],puts=[],records=new Map();
  const fullCore={
    statMap:()=>({stats:true}),watchStatsPresence:()=>presence,watchAggregate:()=>snap().metrics,handicapAggregate:()=>({...snap().metrics,dataTier:'PARTIAL'}),normalizeLiveMarkets:()=>[],
    createLiveOddsSnapshot:()=>({captured_at:now}),liveSnapshotFingerprint:()=>'',summarizeLiveOddsHistory:()=>null,normalizeHalfStatistics:()=>({first_half:{},second_half:{}}),
    groupCoverageScore:()=>({score:72,integrity_score:100}),eventsCompact:x=>x,watchMarketInfo:()=>({}),watchEvaluate:()=>({score:45,scoreMode:'FULL'}),
    hcWindow:()=>({usable:false}),hcTeamStates:()=>({liveGap:0}),hcGameRegime:()=>({}),grEstimate:()=>({prob:null})};
  const coreCtx=vm.createContext({Date:Clock,Math,createBaseEngine:()=>fullCore,createHTTemporal,createHTCollection});
  vm.runInContext(backend.replace(/^import .*\n/gm,'').replace('export function createEngine','function createEngine'),coreCtx);
  class Base {constructor(){this.env={NOTIFY_DAILY_BUDGET:43000};this.ctx={storage:{get:async k=>records.get(k),put:async(k,v)=>{puts.push(k);records.set(k,normalize(v));}}};}
    async devices(){return [{id:'device',prefs:{enabled:true,h1:true,goal:false,gap:false,h1Threshold:72}}];}
    async scanControl(){return {enabled};}async listNotifyMatches(){return [...records].filter(([k])=>k.startsWith('match:')).map(([,v])=>normalize(v));}
    async putNotifyMatch(id,item){puts.push('match:'+id);records.set('match:'+id,normalize(item));}async deleteNotifyMatch(id){records.delete('match:'+id);}
    async api(path,params){calls.push({path,params});return path==='/fixtures'?[fixtures[0]]:[{observed:true}];}async send(){calls.push({path:'PUSH'});return true;}}
  const ctx=vm.createContext({Date:Clock,Math,Map,Set,Number,TextEncoder,Response,Request,URL,DeepLinkWatcher:Base,base:{},createEngine:coreCtx.createEngine,createHTCollection,readHTContext:async()=>({at:now,rows:[]}),assessHTItem:()=>({state:'MODEL_WAIT'}),crossing:(prev,candidate)=>({state:prev||{},send:candidate!=null})});
  const clean=source.replace(/^import .*\n/gm,'').replace('export class BackgroundWatcher','class BackgroundWatcher').replace('export default base;','');
  vm.runInContext(clean+'\nthis.TestWatcher=BackgroundWatcher;',ctx);
  return {watcher:new ctx.TestWatcher(),calls,puts,records};
}
const originalWorker=readFileSync(process.argv[2]||'worker_notify_v130.js','utf8');
await check('backend early collection adds zero provider calls and zero persistence operations per replayed tick',async()=>{
  const before=makeBackend(originalWorker),after=makeBackend(worker);
  await before.watcher.notifyTick();await after.watcher.notifyTick();
  assert.deepEqual(normalize(after.calls),normalize(before.calls));assert.deepEqual(after.puts,before.puts);
  const item=after.records.get('match:1');assert.equal(item.h1History.length,1);assert.equal(item.last.h1Mode,'EARLY_EVIDENCE');assert.equal(item.last.h1Score,null);assert.equal(item.ui.engines.H1.recommendation,'WAIT');
  assert.equal(before.records.get('match:1').h1History.length,0);
});
await check('backend OFF and missing scan permission fail closed without requests or writes',async()=>{
  for(const enabled of [false,undefined]){const m=makeBackend(worker,enabled===false?false:null);await m.watcher.notifyTick();assert.equal(m.calls.length,0);assert.equal(m.puts.length,0);}
});
await check('FT and HC calculations/crossings stay unchanged in backend early replay',async()=>{
  const a=makeBackend(originalWorker),b=makeBackend(worker);await a.watcher.notifyTick();await b.watcher.notifyTick();
  const old=a.records.get('match:1'),updated=b.records.get('match:1');
  for(const key of ['history','hcHistory','oddsHistory','cooldown'])assert.deepEqual(updated[key],old[key]);
  assert.deepEqual(updated.ui.engines.FT,old.ui.engines.FT);assert.deepEqual(updated.ui.hc_snapshot,old.ui.hc_snapshot);
});
await check('unrelated FT/HC entrypoints in Mobile remain byte-identical',()=>{
  for(const name of ['startLiveWatch','refreshLiveWatch','startHandicapWatch','refreshHandicapWatch','watchEvaluate','hcEvaluate'])assert.equal(fn(mobile,name),fn(baseline,name),name);
});
writeFileSync('ht-early-candidate/generated/collection-test-report.json',JSON.stringify({status:'PASS',tests:count,production_deployed:false,real_provider_calls:0,real_d1_writes:0,backend_replay:{extra_api_calls:0,extra_storage_operations:0},mobile:{max_detail_fixtures_per_existing_round:5,oldest_first_scout_slot:1,new_timers:0},remaining:['precise HT valuation before minute20','browser and real-phone acceptance','production rollout and real quota measurement']},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',tests:count}));
