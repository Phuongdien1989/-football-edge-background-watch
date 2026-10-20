import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createHTTemporal} from './temporal.mjs';
import {createHTCollection} from './collection.mjs';
const now=1792526400000;
class Clock extends Date {static now(){return now;}}
const mobile=readFileSync('ht-early-candidate/generated/index.html','utf8');
const backend=readFileSync('ht-early-candidate/generated/backend/notify-core-h1.js','utf8');
const baseline=readFileSync('ui-tabs-preview/generated/candidate/index.html','utf8');
const build=JSON.parse(readFileSync('ht-early-candidate/generated/build-report.json','utf8'));
assert(build.worker_baseline_blob,'BUILD_STAGE_2_REQUIRED');
const sha=s=>createHash('sha256').update(s).digest('hex');
assert.equal(sha(mobile),build.mobile_candidate_sha256,'STALE_MOBILE_BUILD');
assert.equal(sha(backend),build.backend_candidate_sha256,'STALE_BACKEND_BUILD');
assert.equal(sha(createHTTemporal.toString()),build.shared_factory_sha256,'STALE_TEMPORAL_FACTORY');
assert.equal(sha(createHTCollection.toString()),build.collection_factory_sha256,'STALE_COLLECTION_FACTORY');
assert(mobile.includes(createHTCollection.toString()),'MOBILE_COLLECTION_FACTORY_DRIFT');
function fn(source,name,indent='  ') {
  const start=source.indexOf(indent+'function '+name+'(');assert(start>=0,name);
  const next=['\n'+indent+'function ','\n'+indent+'async function '].map(t=>source.indexOf(t,start+1)).filter(n=>n>=0);
  return source.slice(start,Math.min(...next));
}
const shared=createHTTemporal();
const back=vm.createContext({Date:Clock,Math,createBaseEngine:()=>({}),createHTTemporal,createHTCollection});
vm.runInContext(backend.replace(/^import .*\n/gm,'').replace('export function createEngine','function createEngine'),back);
const names=['watchClamp','watchMetricAvailable','watchMetricDelta','h1WatchFindBaseline','h1WatchWindow','h1WatchHistoryAge','h1WatchDisplayWindow','h1WatchGameScore','h1WatchPressure','h1WatchChance','h1WatchMomentum','h1WatchMarketScore','h1WatchContextScore','h1WatchQualityScore','h1WatchCore','h1WatchEvaluate','qsigTrend'];
const front=vm.createContext({Date:Clock,Math,HTTemporal:shared,HTCollection:createHTCollection()});
vm.runInContext(names.map(n=>fn(mobile,n)).join('\n'),front);
const old=vm.createContext({Date:Clock,Math});vm.runInContext(names.map(n=>fn(baseline,n)).join('\n'),old);
const plain=v=>JSON.parse(JSON.stringify(v));
const presence={shots:true,sot:true,inbox:true,corners:true,xg:true,pressure:true,chance:true,momentum:true,core:true,coverage:5};
const snapshot=(ago,values={})=>({captured_at:now-ago*60000,fresh_at:now,minute:32-ago,status:'1H',goals:{home:0,away:0},metrics:{total:{shots:0,sot:0,inbox:0,corners:0,xg:0,red:0,...values}},stats_presence:{...presence},dq:90,integrity:100,market:{raw_count:1,valid_count:1,has_over:true,best_over:{line:.5,odd:1.9},move:{line_delta:0,over_price_delta:0}}});
const current=snapshot(0,{shots:9,sot:2,inbox:5,corners:2,xg:.5});
const short={initialDQ:90,initialIntegrity:100,history:[snapshot(2,{shots:6,sot:1,inbox:3,corners:1,xg:.3}),snapshot(1.5,{shots:6,sot:1,inbox:3,corners:1,xg:.3}),snapshot(1,{shots:7,sot:1,inbox:4,corners:1,xg:.35}),snapshot(.5,{shots:8,sot:2,inbox:4,corners:2,xg:.45}),current]};
let tests=0;const check=(name,run)=>{run();tests++;console.log('PASS '+name);};
check('reproduces old false acceleration, fixes partial-window classification',()=>{
  const before=old.h1WatchEvaluate(short,current),after=front.h1WatchEvaluate(short,current);
  assert.equal(before.score,91);assert.equal(before.accel,1);assert.equal(old.qsigTrend(before),'ACCELERATING');
  assert.equal(after.accel,null);assert.equal(after.accelValid,false);assert.equal(after.mature,false);
  assert.equal(after.recent5.status,'partial');assert.equal(after.pressure5.mature,false);assert.equal(after.pressure10.mature,false);
  assert.equal(front.qsigTrend(after),'ACTIVE');
});
const full={...short,history:Array.from({length:21},(_,i)=>snapshot(10-i*.5,{shots:i,sot:i/4,inbox:i/2,corners:i/6,xg:i/20}))};
const fc=full.history.at(-1);
check('complete continuous windows preserve measured activity',()=>{
  const e=front.h1WatchEvaluate(full,fc);assert.equal(e.recent5.status,'complete');assert.equal(e.recent10.status,'complete');
  assert.equal(e.mature,true);assert.equal(e.accel,0);assert.equal(e.accelValid,true);assert.equal(front.qsigTrend(e),'SUSTAINED');
});
const increasing={...short,history:Array.from({length:13},(_,i)=>snapshot(6-i*.5,{shots:i<=6?i:(6+(i-6)*2),sot:i<=6?i/4:(1.5+(i-6)/2),inbox:i/2,xg:i/20}))};
check('real disjoint-period acceleration still recognized',()=>{
  const e=front.h1WatchEvaluate(increasing,increasing.history.at(-1));assert(e.accel>.35);assert.equal(e.accelValid,true);assert.equal(front.qsigTrend(e),'ACCELERATING');
});
const quiet={...short,history:Array.from({length:13},(_,i)=>snapshot(6-i*.5,{shots:i<=6?0:i-6,sot:i<=6?0:(i-6)/3,inbox:i<=6?0:i-6,xg:i<=6?0:(i-6)/20}))};
check('zero previous rate is not a fabricated 100 percent increase',()=>{
  const m=shared.momentum(quiet,quiet.history.at(-1));assert.equal(m.accel,null);assert.equal(m.accelValid,false);assert.equal(m.accelKind,'FROM_QUIET');
});
check('twelve-minute interruption restarts evidence age',()=>{
  const gap={...short,history:[snapshot(12,{shots:3}),current]};
  const e=front.h1WatchEvaluate(gap,current);assert.equal(e.baselineAge,0);assert.equal(e.scoreMode,'BASELINE');assert.equal(e.accel,null);
});
check('existing seventy-second continuity boundary is respected',()=>{
  assert.equal(shared.historyAge({history:[snapshot(70/60),current]},current),1.2);
  assert.equal(shared.historyAge({history:[snapshot(70.001/60),current]},current),0);
});
check('goal, red-card, phase and explicit reset invalidate old segment',()=>{
  for(const edit of [s=>s.goals.home=1,s=>s.metrics.total.red=1,s=>s.status='HT']) {
    const cur=structuredClone(current);edit(cur);assert.equal(shared.historyAge(short,cur),0);
  }
  assert.equal(shared.historyAge({...short,resetAt:now-60000},current),1);
});
check('duplicate/out-of-order samples do not create evidence or mutate inputs',()=>{
  const sample={...short,history:[...short.history].reverse().concat(short.history[0])},before=JSON.stringify(sample);
  assert.equal(shared.historyAge(sample,current),2);assert.equal(JSON.stringify(sample),before);
  assert.equal(shared.historyAge({history:[current,current]},current),0);
});
check('zero DQ remains zero; current DQ takes precedence over initial DQ',()=>{
  assert.equal(old.h1WatchQualityScore({initialDQ:0,initialIntegrity:100},{...current,dq:0}),3);
  assert.equal(shared.qualityScore({initialDQ:90,initialIntegrity:100},{...current,dq:0},now),1);
  assert.equal(shared.qualityScore({},{...current,dq:0,integrity:0},now),0);
  assert.equal(shared.qualityScore({},{...current,dq:null,integrity:null},now),0);
  assert.equal(shared.qualityScore({},{...current,dq:'',integrity:''},now),0);
});
check('missing, stale and future timestamps are not refreshed by evaluation',()=>{
  for(const fresh_at of [undefined,now-56000,now+1])assert(shared.qualityScore(short,{...current,fresh_at},now)<=1);
});
check('metric absence differs from observed zero',()=>{
  const zero=snapshot(0),base=snapshot(5);const item={history:Array.from({length:11},(_,i)=>snapshot(5-i*.5))};
  assert.equal(shared.windowFor(item,zero,5).delta.sot,0);
  const missing=structuredClone(zero);missing.stats_presence.sot=false;
  assert.equal(shared.windowFor(item,missing,5).delta.sot,null);
  assert.equal(base.metrics.total.sot,0);
});
check('Mobile/backend full evaluator parity across all replay cases',()=>{
  for(const item of [short,full,increasing,quiet,{...short,history:[snapshot(12),current]}]) {
    const cur=item.history.at(-1);assert.deepEqual(plain(front.h1WatchEvaluate(item,cur)),plain(back.h1WatchEvaluate(item,cur)));
  }
});
check('FT trend behavior unchanged for unmarked existing evaluations',()=>{
  for(const e of [{},{accel:1,recent5:{delta:{sot:1}}},{recent5:{delta:{shots:3}},recent10:{delta:{shots:4}}}])assert.equal(front.qsigTrend(e),old.qsigTrend(e));
  const candidate=fn(mobile,'qsigTrend').replace('\n    if(e?.h1_temporal)return HTTemporal.trend(e);','');assert.equal(candidate,fn(baseline,'qsigTrend'));
});
check('all inline classic scripts parse without executing app side effects',()=>{
  for(const match of mobile.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!/type=["'](?:module|application\/ld\+json|application\/json)/.test(match[1]))new vm.Script(match[2]);
});
check('HT has one pricing view while the FT Goal Radar path remains byte-identical',()=>{
  const text=fn(mobile,'grHTML'),guard="    if(engine==='H1')return '<div class=\"watch-alert-note\">Dự báo bàn HT và giá kèo nằm trong card HT Pricing. Các điểm bên dưới mô tả diễn biến trận.</div>';";
  assert(text.includes(guard));assert.equal(text.replace('\n'+guard,''),fn(baseline,'grHTML'));
  const c=vm.createContext({});vm.runInContext(text,c);const html=c.grHTML({},'H1');assert(html.includes('HT Pricing'));assert(!html.includes('%'));
});
const report={status:'PASS',tests,production_deployed:false,provider_requests:0,d1_writes:0,old_short:plain(old.h1WatchEvaluate(short,current)),candidate_short:plain(front.h1WatchEvaluate(short,current)),remaining:['remaining-HT-goal valuation and exact market contract pricing','browser/phone acceptance','production deployment and LIVE/PUSH verification']};
writeFileSync('ht-early-candidate/generated/test-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',tests,production_deployed:false}));
