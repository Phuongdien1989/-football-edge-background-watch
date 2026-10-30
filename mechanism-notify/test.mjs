import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {POLICY,mechanismPrefs,capabilities,evaluateMechanisms,priceCandidates,legacyCandidates,planDelivery,mechanismPayload} from './core.mjs';
import {deliverMechanisms} from './deliver.mjs';
import {createFTContextCache} from './context.mjs';
import {assessHTItem} from '../ht-early-candidate/assess-item.mjs';
import {readLegacy} from '../ft-overview/adapter.mjs';
import {assess} from '../ft-overview/core.mjs';
import {reviewFTDecision} from '../ft-overview/experimental-decision.mjs';
import {createHTCollection} from '../ht-early-candidate/collection.mjs';
import {createHTHistoryCache} from '../ht-early-candidate/history.mjs';
let now=Date.now(),tests=0;
const check=async(name,f)=>{await f();tests++;console.log('PASS '+name);};
const fixture={fixture:{id:999991,timestamp:Math.floor((now-12*60000)/1000),status:{short:'1H',elapsed:12}},teams:{home:{id:1,name:'Home'},away:{id:2,name:'Away'}},league:{name:'Regression League'},goals:{home:0,away:0}};
const metrics={total:{shots:8,sot:4,inbox:4,xg:.6,corners:2,red:0}},presence={shots:true,sot:true,inbox:true,xg:true,red:true,core:true};
const marketRows=[{category:'h1_total',update:now,bookmaker:{name:'QA'},values:[{value:'Over',handicap:.5,odd:2.7},{value:'Under',handicap:.5,odd:1.5}]},{category:'over_under',update:now,bookmaker:{name:'QA'},values:[{value:'Over',handicap:2.5,odd:3.5},{value:'Under',handicap:2.5,odd:1.3}]}];
const snapshot={captured_at:now,fresh_at:now,minute:12,status:'1H',goals:{home:0,away:0},metrics,stats_presence:presence,market_rows:marketRows,market_at:now};
const htContext={at:now-1000,rows:Array.from({length:8},(_,i)=>({fixture_id:800+i,kickoff:Math.floor((now-(i+1)*86400000)/1000),status:'FT',home_team_id:1,away_team_id:2,halftime_home:1,halftime_away:1}))};
const ftRows=htContext.rows.map(r=>({fixture_id:r.fixture_id,date:new Date(r.kickoff*1000).toISOString(),status:'FT',home_id:1,away_id:2,goals:{home:3,away:2}}));
const ftBundle={observed_at:now,meta:{fixture_id:fixture.fixture.id,teams:fixture.teams,fixture:fixture.fixture},normalized:{home_recent:ftRows,away_recent:ftRows}};
const item={id:fixture.fixture.id,history:[],alerts:{}};
const input={fixture,snapshot,item,htContext,ftBundle,now};
const packet=evaluateMechanisms(input),prefs={...mechanismPrefs(),goal:true,gap:true};
let candidates=priceCandidates(packet,prefs,fixture,snapshot);
await check('HT before minute 20 has the exact card valuation, not legacy H1 score',()=>{
 const r=assessHTItem({id:item.id,latest:{...snapshot,fixture},history:[]},htContext,now);
 assert.equal(r.action,'TRIAL_OVER');assert.deepEqual(packet.results.ht.quote,r.quote);assert(candidates.some(c=>c.kind==='ht'));
 const replay=assessHTItem({id:item.id,latest:{...snapshot,fixture}},packet.context.ht,now);assert.deepEqual(replay.quote,r.quote);
});
await check('FT Overview and FT V2 retain separate exact shared assessments',()=>{
 for(const kind of ['ftOverview','ftV2']){const s=readLegacy({read:()=>({watchState:{items:[{id:item.id,latest:{...snapshot,fixture},history:[]}]}})},{read:()=>[ftBundle]},{conditionedFT:kind==='ftV2'})[0],r=assess(s,now,{trialRecommendations:true});assert.deepEqual(packet.results[kind].quote,r.quote);if(kind==='ftV2')assert.equal(packet.results[kind].action,reviewFTDecision(r).action);assert(candidates.some(c=>c.kind===kind));}
 assert.notEqual(packet.results.ftOverview.modelVersion,packet.results.ftV2.modelVersion);
});
await check('shared server context wins over an unrelated browser DEEP bundle at same observation',()=>{
 const base={id:item.id,latest:snapshot,serverRow:{notification_context:packet.context}};
 const s=readLegacy({read:()=>({watchState:{items:[base]}})},{read:()=>[{...ftBundle,normalized:{home_recent:[],away_recent:[]}}]},{conditionedFT:true})[0];
 assert.equal(assess(s,now,{trialRecommendations:true}).quote.ev,packet.results.ftV2.quote.ev);
 base.serverRow.notification_context={...packet.context,observedAt:now-1};assert.equal(readLegacy({read:()=>({watchState:{items:[base]}})},{read:()=>[]},{conditionedFT:true})[0].model,null);
});
await check('no stats, stale data, future clock, cooldown, absent history or market never manufacture a recommendation',()=>{
 const variations=[{snapshot:{...snapshot,stats_presence:{},metrics:{total:{}}}},{now:now+60001},{now:now-6000},{item:{...item,cooldown:now+300000,h1CooldownUntil:now+300000}},{htContext:{at:now,rows:[]},ftBundle:null},{snapshot:{...snapshot,market_rows:[]}}];
 for(const change of variations){const p=evaluateMechanisms({...input,...change});assert.equal(priceCandidates(p,prefs,fixture,change.snapshot||snapshot).length,0,JSON.stringify(change));}
});
await check('ended half and bad current price suppress HT without changing forecast probability',()=>{
 const bad=structuredClone(snapshot);bad.market_rows[0].values[0].odd=1.01;const r=evaluateMechanisms({...input,snapshot:bad});assert.equal(r.results.ht.action,'WAIT');assert.equal(r.results.ht.quote.win,packet.results.ht.quote.win);
 const ended=evaluateMechanisms({...input,snapshot:{...snapshot,status:'2H',minute:55}});assert.notEqual(ended.results.ht.action,'TRIAL_OVER');
});
await check('HC research has no fabricated side while legacy GAP remains a distinctly labelled signal',()=>{
 assert.equal(packet.results.hc.action,'NO_ENTRY_PUSH');const c=legacyCandidates({gap:{value:73,threshold:70,actual:'+73 Home'}},now,snapshot);const p=mechanismPayload(fixture,snapshot,c,now);assert.match(p.body,/TÍN HIỆU/);assert.match(p.body,/chưa phải giá vào/);assert.equal(p.recommendations.length,0);assert(p.url.includes('#fe-tabs/hc/'+item.id));
});
await check('per-mechanism OFF is honored without disabling other mechanisms',()=>{
 const c=priceCandidates(packet,{h1:false,ftOverview:false,ftV2:true},fixture,snapshot);assert.deepEqual(c.map(x=>x.kind),['ftV2']);
});
let first=planDelivery(null,candidates,{now,observedAt:now,results:packet.results});
for(const r of Object.values(first.state.records))r.deliveryState='ACCEPTED';
await check('one grouped delivery reserves all eligible mechanisms and preserves original five-minute reference',()=>{
 assert.equal(first.send.length,3);const p=mechanismPayload(fixture,snapshot,first.send,now);assert.equal(p.fixture_id,item.id);assert(p.url.includes('#fe-tabs/ht/'+item.id));assert.match(p.body,/Regression League/);assert.equal(p.recommendations.length,3);assert(new TextEncoder().encode(JSON.stringify(p)).length<=3500);
 const second=planDelivery(first.state,candidates.map(c=>({...c,at:now+30000,odds:3.9})),{now:now+30000,observedAt:now+30000,results:packet.results});assert.equal(second.send.length,0);assert.equal(second.state.referenceUntil,first.state.referenceUntil);assert.deepEqual(second.state.records.ht.reference,first.state.records.ht.reference);
});
await check('restart, duplicate observations, stale observations and clock rollback cannot repeat a reserved delivery',()=>{
 for(const at of [now,now-1000,now+30000,now+300001]){const p=planDelivery(structuredClone(first.state),candidates.map(c=>({...c,at})),{now:at,observedAt:at,results:packet.results});assert.equal(p.send.length,0);}
 assert.equal(planDelivery(null,candidates,{now:now-1,observedAt:now}).send.length,0);
});
await check('missing data does not rearm, but a confirmed negative price followed by a new positive observation does',()=>{
 const missing=planDelivery(first.state,[],{now:now+60000,observedAt:now+60000,results:{ht:{action:'WAIT_PRICE'}}});assert.equal(missing.state.records.ht.armed,false);
 const noEV=planDelivery(first.state,[],{now:now+60000,observedAt:now+60000,results:{ht:{action:'WAIT_PRICE',quote:{ev:-.1}}}});assert.equal(noEV.state.records.ht.armed,true);
 const next=planDelivery(noEV.state,candidates.map(c=>({...c,at:now+300001})),{now:now+300001,observedAt:now+300001});assert.deepEqual(next.send.map(c=>c.kind),['ht']);
});
await check('new contract and event can send only after the existing fixture hold, never for an older observation',()=>{
 const c=candidates.map(c=>({...c,identity:c.identity+'new',at:now+300001}));assert.equal(planDelivery(first.state,c,{now:now+300001,observedAt:now+300001}).send.length,3);assert.equal(planDelivery(first.state,c,{now:now+1000,observedAt:now+300001}).send.length,0);
});
await check('durable reservation precedes transport; uncertain ACK is not retried on restart',async()=>{
 const data=new Map(),events=[];let transport=true;
 const w={ctx:{storage:{get:async k=>structuredClone(data.get(k)),put:async(k,v)=>{events.push(v.outcome);data.set(k,structuredClone(v));}}},send:async()=>{assert.equal([...data.values()][0].outcome,'RESERVED');events.push('SEND');if(!transport)throw Error('ACK_LOST');return true;}};
 const opts={device:{id:'test',prefs},fixture,snapshot,item,packet,legacySignals:{},now};
 assert.equal((await deliverMechanisms(w,opts)).sent,true);assert.deepEqual(events,['RESERVED','SEND','PUSH_SERVICE_ACCEPTED']);events.length=0;await deliverMechanisms(w,opts);assert.deepEqual(events,[]);
 data.clear();transport=false;const r=await deliverMechanisms(w,opts);assert.equal(r.state,'TRANSPORT_UNCONFIRMED');events.length=0;await deliverMechanisms(w,opts);assert.deepEqual(events,[]);
 const uncertain=[...data.values()][0],at=now+300001,retry=planDelivery(uncertain,candidates.map(c=>({...c,at})),{now:at,observedAt:at});assert.equal(retry.send.length,3,'UNKNOWN_ACK_RETRIES_ONLY_FROM_A_NEW_VALID_OBSERVATION_AFTER_HOLD');
});
await check('indexed FT context performs reads only and caches per fixture/team; no provider warm-up',async()=>{
 let reads=0;const db={prepare(sql){assert.match(sql,/SELECT/);assert(!/INSERT|UPDATE|DELETE|CREATE/.test(sql));return {bind(){return {async all(){reads++;return {success:true,results:htContext.rows.map(r=>({...r,score_home:3,score_away:2}))};}};}};}};
 const cache=createFTContextCache(),b=await cache.read(db,fixture,now);assert.equal(reads,2);assert.equal(b.normalized.home_recent.length,8);await cache.read(db,fixture,now+1000);assert.equal(reads,2);
 assert.equal((await createFTContextCache().read({prepare(){throw Error('quota')}},fixture,now)).normalized.home_recent.length,0);
});
// Exercise the complete deployed scanner method, using deterministic API replies.
await check('real scanner hook sends a priced early HT without a legacy H1 crossing and adds zero provider requests',async()=>{
 const source=readFileSync('mechanism-release/candidate/worker_notify_v130.js','utf8'),records=new Map(),calls=[],pushes=[];
 class Clock extends Date{static now(){return now;}}
 const engine={statMap:()=>({}),watchStatsPresence:()=>presence,watchAggregate:()=>metrics,handicapAggregate:()=>({dataTier:'BASELINE'}),normalizeLiveMarkets:()=>marketRows,createLiveOddsSnapshot:()=>({captured_at:now}),liveSnapshotFingerprint:()=>'',summarizeLiveOddsHistory:()=>null,normalizeHalfStatistics:()=>({first_half:{},second_half:{}}),groupCoverageScore:()=>({score:72,integrity_score:100}),eventsCompact:()=>[],watchMarketInfo:()=>({}),watchEvaluate:()=>({scoreMode:'BASELINE',score:null}),hcWindow:()=>({usable:false}),hcGameRegime:()=>null,hcTeamStates:()=>({liveGap:0}),h1WatchEvaluate:()=>({scoreMode:'EARLY_EVIDENCE',score:null}),grEstimate:()=>null};
 const db={prepare(){return {bind(){return {all:async()=>({success:true,results:htContext.rows.map(r=>({...r,score_home:3,score_away:2}))})};}};}};
 class Base{constructor(){this.env={NOTIFY_DAILY_BUDGET:43000,FOOTBALL_DB:db};this.ctx={storage:{get:async k=>structuredClone(records.get(k)),put:async(k,v)=>records.set(k,structuredClone(v))}};}async devices(){return [{id:'test',prefs:{enabled:true,h1:true,goal:false,gap:false,ftOverview:false,ftV2:false}}];}async scanControl(){return {enabled:true};}async listNotifyMatches(){return [...records].filter(([k])=>k.startsWith('match:')).map(([,v])=>structuredClone(v));}async putNotifyMatch(id,v){records.set('match:'+id,structuredClone(v));}async deleteNotifyMatch(){}async api(path,params){calls.push([path,params]);return path==='/fixtures'?[fixture]:[{}];}async send(d,p){pushes.push(p);return true;}}
 const ctx={DeepLinkWatcher:Base,createEngine:()=>engine,createHTCollection,createHTHistoryCache:()=>({beginCycle(){},contextFor:async()=>htContext}),readHTContext:async()=>htContext,assessHTItem,crossing:()=>({state:{armed:true},send:false}),mechanismPrefs,capabilities,evaluateMechanisms,createFTContextCache,deliverMechanisms,Date:Clock,Response,Request,URL,TextEncoder,structuredClone,console};
 const Class=vm.runInNewContext(source.replace(/^import .*$/gm,'').replace('export class BackgroundWatcher','class BackgroundWatcher').replace('export default base;','')+'\nBackgroundWatcher',ctx),w=new Class();await w.notifyTick();
 assert.equal(calls.length,5);assert.equal(pushes.length,1,JSON.stringify([...records]));assert.equal(pushes[0].recommendations[0].kind,'ht');assert.equal(records.get('match:'+fixture.fixture.id).last.h1Score,null);assert.equal(records.get('notify:status').alertsAccepted,1);
 now+=30000;await new Class().notifyTick();assert.equal(calls.length,10);assert.equal(pushes.length,1);
 const off=new Class();off.scanControl=async()=>({enabled:false});await off.notifyTick();assert.equal(calls.length,10);
});
console.log(JSON.stringify({status:'PASS',tests,real_provider_calls:0,real_push_calls:0,real_D1_writes:0}));
