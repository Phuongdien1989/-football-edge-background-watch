import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHTSessionBook,SESSION_MS} from './recommendation-session.mjs';
import {assessHTItem} from './assess-item.mjs';
import {createHTCollection} from './collection.mjs';
import {createHTEvents} from './events.mjs';
import {fetchH1CollectionSnapshot,refreshH1Watch} from './mobile-collection.mjs';
let now=1792542600000,count=0;const cases=[];
const check=async(name,fn)=>{await fn();cases.push({name,status:'PASS'});count++;};
function fixture(){return {fixture:{id:990001,timestamp:Math.floor((now-18*60000)/1000),status:{short:'1H',elapsed:18}},teams:{home:{id:1,name:'Home'},away:{id:2,name:'Away'}},goals:{home:0,away:0}};}
function item(){return {id:990001,latest:{fixture:fixture(),fresh_at:now,minute:18,status:'1H',goals:{home:0,away:0},metrics:{total:{shots:6,sot:2,inbox:3,xg:.4,red:0}},stats_presence:{shots:true,sot:true,inbox:true,xg:true},market_at:now,market_rows:[{category:'h1_total',values:[{value:'Over',handicap:.5,odd:2.7},{value:'Under',handicap:.5,odd:1.5}]}]}};}
const context=()=>({at:now-1000,rows:Array.from({length:8},(_,i)=>({fixture_id:100+i,kickoff:Math.floor((now-(i+1)*86400000)/1000),status:'FT',home_team_id:1,away_team_id:2,halftime_home:1,halftime_away:0}))});
function row(i=item(),at=now){return assessHTItem(i,context(),at);}
await check('price changes affect value, not independent forecast',()=>{const i=item(),a=row(i);i.latest.market_rows[0].values[0].odd=3.5;const b=row(i);assert.deepEqual(a.model,b.model);assert(b.quote.ev>a.quote.ev);assert.equal(a.quote.fairOdds,b.quote.fairOdds);});
await check('five minutes fixed despite repeated live updates',()=>{const b=createHTSessionBook(),i=item(),s=b.update(i,row(i),now);assert(s);const original=structuredClone(s.original);for(const dt of [1000,5000,90000,299999]){const t=now+dt;i.latest.fresh_at=t;i.latest.market_at=t;const next=b.update(i,row(i,t),t);assert.equal(next.expiresAt,now+SESSION_MS);assert.deepEqual(next.original,original);}});
await check('low price waits without changing original recommendation',()=>{const b=createHTSessionBook(),i=item(),s=b.update(i,row(i),now);i.latest.market_rows[0].values[0].odd=1.2;const q=b.update(i,row(i),now+1000);assert.equal(q.state,'WAIT_PRICE');assert.equal(q.original.odds,s.original.odds);assert.equal(q.id,s.id);});
await check('price recovery resumes same session',()=>{const b=createHTSessionBook(),i=item(),s=b.update(i,row(i),now);i.latest.market_rows[0].values[0].odd=1.2;b.update(i,row(i),now+1000);i.latest.market_rows[0].values[0].odd=2.8;const q=b.update(i,row(i),now+2000);assert.equal(q.state,'ACTIVE');assert.equal(q.id,s.id);});
await check('stale data cannot remain actionable for five minutes',()=>{const b=createHTSessionBook(),i=item();b.update(i,row(i),now);assert.equal(b.update(i,row(i,now+56000),now+56000).state,'WAIT_DATA');});
await check('goal invalidates immediately and exact cancellation snapshot cannot reopen',()=>{const b=createHTSessionBook(),i=item();b.update(i,row(i),now);i.latest.goals.home=1;const t=now+1000;i.latest.fresh_at=t;const q=b.update(i,{...row(i,t),action:'TRIAL_OVER',dataOK:true,marketOK:true,modelOK:true,quote:{ev:.1},recommendation:{line:1.5,odds:2}},t);assert.equal(q.closeReason,'SCORE_CHANGED');assert(q.closedAt);});
await check('red card invalidates immediately',()=>{const b=createHTSessionBook(),i=item();b.update(i,row(i),now);i.latest.metrics.total.red=1;assert.equal(b.update(i,row(i),now+1000).closeReason,'RED_STATE_CHANGED');});
await check('half ended invalidates immediately',()=>{const b=createHTSessionBook(),i=item();b.update(i,row(i),now);i.latest.status='HT';assert.equal(b.update(i,row(i),now+1000).closeReason,'HALF_ENDED');});
await check('cooldown invalidates immediately',()=>{const b=createHTSessionBook(),i=item();b.update(i,row(i),now);i.cooldownUntil=now+60000;assert.equal(b.update(i,row(i),now+1000).closeReason,'RESET_OR_COOLDOWN');});
await check('clock reversal invalidates',()=>{const b=createHTSessionBook(),i=item();b.update(i,row(i),now);assert.equal(b.update(i,row(i),now-1).closeReason,'CLOCK_CHANGED');});
await check('expiry evaluates a fresh source and starts a new five-minute session',()=>{const b=createHTSessionBook(),i=item(),s=b.update(i,row(i),now),t=now+SESSION_MS;i.latest.fresh_at=t;i.latest.market_at=t;const q=b.update(i,row(i,t),t);assert.notEqual(q.id,s.id);assert.equal(q.expiresAt,t+SESSION_MS);assert.equal(b.export().history[0].closeReason,'EXPIRED');});
await check('expiry with stale data closes without reopening',()=>{const b=createHTSessionBook(),i=item();b.update(i,row(i),now);const q=b.update(i,row(i,now+SESSION_MS),now+SESSION_MS);assert.equal(q.state,'EXPIRED');});
await check('reload preserves original and deadline without duplicate opening event',()=>{const events=[],b=createHTSessionBook(),i=item(),s=b.update(i,row(i),now);const restored=createHTSessionBook({saved:b.export(),onEvent:e=>events.push(e)});const q=restored.update(i,row(i),now+1000);assert.equal(q.id,s.id);assert.equal(q.expiresAt,s.expiresAt);assert.equal(events.length,0);});
await check('unchanged render emits no repeat event or state mutations',()=>{const events=[],b=createHTSessionBook({onEvent:e=>events.push(e)}),i=item();b.update(i,row(i),now);const before=JSON.stringify(b.export());for(let n=1;n<20;n++)b.update(i,row(i),now+n);assert.equal(events.length,1);assert.equal(JSON.stringify(b.export()),before);});
await check('another line does not replace the original contract mid-session',()=>{const i=item();i.latest.market_rows[0].values.push({value:'Over',handicap:1,odd:6});assert.equal(assessHTItem(i,context(),now,{line:.5}).recommendation.line,.5);i.latest.market_rows[0].values=i.latest.market_rows[0].values.filter(v=>v.handicap!==.5);assert.equal(assessHTItem(i,context(),now,{line:.5}).marketOK,false);});
function acquisition({cached=true,fail=false,stopped=false}={}){
 let calls=0,events=0,clock=now;class Clock extends Date{static now(){return clock;}}
 const f=fixture(),i=item(),entry={fields:{stats:{at:now,data:[]},...(cached?{market:{at:now-5000,data:i.latest.market_rows}}:{})}};
 const c=vm.createContext({Date:Clock,HTCollection:createHTCollection(),H1_COLLECTION:{generation:1,context:{rows:[]},history:{contextFor:async x=>x}},h1WatchState:{active:!stopped},
  ULTRA_HUB:{heartbeat:{at:now}},ULTRA_HUB_POLICY:{BACKGROUND:{stats:18000,market:25000}},ultraEntry:()=>entry,
  ultraField:async(e,k,ttl,load)=>{if(e.fields[k]&&clock-e.fields[k].at<ttl)return e.fields[k].data;const data=await load();e.fields[k]={at:clock,data};return data;},
  football:async p=>{calls++;assert.equal(p,'/odds/live');if(fail)throw Error('RATE_LIMIT');return i.latest.market_rows;},
  compactFixtureMeta:()=>({}),autoModeForFixture:()=> 'LIVE',statMap:()=>({}),watchAggregate:()=>i.latest.metrics,watchStatsPresence:()=>i.latest.stats_presence,
  ultraLiveRaw:async()=>{events++;throw Error('QUIET_MUST_NOT_DEEPEN');},getBetReference:async()=>({byId:{}}),oddsCompact:x=>x,eventsCompact:x=>x,
  groupCoverageScore:()=>({score:85,integrity_score:90}),watchDataHealth:()=>({level:'HEALTHY'}),h1WatchMarketInfo:r=>({valid_count:r.length})});
 const fn=vm.runInContext('('+fetchH1CollectionSnapshot.toString()+')',c);
 return {i,f,entry,run:()=>fn(i,f,1),calls:()=>calls,events:()=>events,setTime:t=>clock=t};
}
await check('quiet HT retains fresh shared market with zero provider calls',async()=>{const a=acquisition(),s=await a.run();assert.equal(s.market_rows.length,1);assert.equal(s.market_at,now-5000);assert.equal(a.calls(),0);assert.equal(a.events(),0);});
await check('quiet HT fetches missing market once and reuses shared cadence',async()=>{const a=acquisition({cached:false});await a.run();await a.run();assert.equal(a.calls(),1);assert.equal(a.events(),0);});
await check('market failure does not make stale price fresh or erase valid stats',async()=>{const a=acquisition({fail:true});a.entry.fields.market.at=now-60000;const s=await a.run();assert.equal(s.fresh_at,now);assert.equal(s.market_at,now-60000);assert.equal(row({...a.i,latest:s}).marketOK,false);});
await check('OFF prevents all market acquisition',async()=>{const a=acquisition({stopped:true,cached:false});assert.equal(await a.run(),null);assert.equal(a.calls(),0);});
await check('market-only refresh keeps stats source identity and history unchanged',async()=>{
 const i=item(),before=i.latest.fresh_at,history=[{fresh_at:before}],pool=new Map([[i.id,{...i,history}]]),f=fixture();
 const c=vm.createContext({HTEvents:createHTEvents(),Date:class extends Date{static now(){return now;}},Map,Set,Number,Math,JSON,Promise,HTCollection:{isEarly:()=>true,eligible:()=>true,plan:()=>[f],appendHistory:()=>({accepted:false})},
  H1_COLLECTION:{generation:1,pool,history:{beginCycle(){}}},H1_WATCH_MAX_ITEMS:5,h1WatchState:{active:true,refreshing:false,items:[],cycle:0},
  document:{visibilityState:'visible'},clearTimeout(){},ultraHeartbeat:async()=>({rows:[f]}),h1WatchEligible:()=>true,
  fetchH1CollectionSnapshot:async()=>({...i.latest,market_at:before+1000,market_rows:[{newQuote:true}]}),mapLimit:async(a,n,fn)=>{for(const x of a)await fn(x);},
  renderH1Watch(){},status(){},$(){},ultraHubSummary(){return '';},scheduleH1Watch(){}});
 await vm.runInContext('('+refreshH1Watch.toString()+')',c)();assert.equal(pool.get(i.id).history.length,1);assert.equal(pool.get(i.id).latest.fresh_at,before);assert.equal(pool.get(i.id).latest.market_rows[0].newQuote,true);
});
mkdirSync('ht-early-candidate/generated',{recursive:true});writeFileSync('ht-early-candidate/generated/session-test-report.json',JSON.stringify({status:'PASS',tests:count,cases,provider_calls:0,d1_writes:0},null,2));console.log(JSON.stringify({status:'PASS',tests:count,cases}));
