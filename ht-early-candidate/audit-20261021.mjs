import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import vm from 'node:vm';
import {refreshH1Watch} from './mobile-collection.mjs';
import {assessHTItem} from './assess-item.mjs';
import {priceOver,settlement} from '../ft-overview/core.mjs';
import {createHTSessionBook} from './recommendation-session.mjs';
import {createHTEvents} from './events.mjs';
const now=1792542600000,checks=[],findings=[];
function check(name,fn){fn();checks.push({name,status:'PASS'});}
const fixture={fixture:{id:990001,timestamp:Math.floor((now-18*60000)/1000)},teams:{home:{id:1},away:{id:2}}};
const item=()=>({id:990001,latest:{fixture:structuredClone(fixture),fresh_at:now,minute:18,status:'1H',goals:{home:0,away:0},metrics:{total:{shots:6,sot:2,red:0}},stats_presence:{shots:true,sot:true},market_at:now,market_rows:[{category:'h1_total',values:[{value:'Over',handicap:.5,odd:2.7}]}]}});
const context={at:now-1000,rows:Array.from({length:8},(_,i)=>({fixture_id:100+i,kickoff:Math.floor((now-(i+1)*86400000)/1000),status:'FT',home_team_id:1,away_team_id:2,halftime_home:1,halftime_away:0}))};
check('odds change value without changing independent forecast',()=>{const i=item(),a=assessHTItem(i,context,now);i.latest.market_rows[0].values[0].odd=3.5;const b=assessHTItem(i,context,now);assert.deepEqual(a.model,b.model);assert(b.quote.ev>a.quote.ev);});
check('empty halftime history does not invent model',()=>assert.equal(assessHTItem(item(),{at:now,rows:[]},now).modelOK,false));
check('future context cannot leak into earlier snapshot',()=>assert.equal(assessHTItem(item(),{...context,at:now+1},now).modelOK,false));
check('expired source blocks action',()=>assert.equal(assessHTItem(item(),context,now+56000).action,'WAIT'));
check('blocked market blocks action',()=>{const i=item();i.latest.market_rows[0].status={blocked:true};assert.equal(assessHTItem(i,context,now).marketOK,false);});
check('FT market cannot be used as HT',()=>{const i=item();i.latest.market_rows[0].category='ft_total';assert.equal(assessHTItem(i,context,now).marketOK,false);});
check('missing market time cannot become stats time',()=>{const i=item();delete i.latest.market_at;assert.equal(assessHTItem(i,context,now).marketOK,false);});
check('current score counted exactly once across 60 contracts',()=>{for(const goals of [0,1,2])for(const line of [.5,1,1.25,1.5,1.75])for(const odds of [1.5,2,2.7,4]){const pmf=[.25,.5,.25],q=priceOver(pmf,goals,goals+line,odds);let ev=0;pmf.forEach((p,k)=>{const s=settlement(goals+k,goals+line);ev+=p*(s>0?s*(odds-1):s);});assert(Math.abs(q.ev-ev)<1e-10);}});
check('session waits on stale data and preserves original contract',()=>{const i=item(),b=createHTSessionBook(),s=b.update(i,assessHTItem(i,context,now),now),q=b.update(i,assessHTItem(i,context,now+56000),now+56000);assert.equal(q.state,'WAIT_DATA');assert.deepEqual(q.original,s.original);assert.equal(q.expiresAt,s.expiresAt);});
check('session invalidates when updated score actually reaches it',()=>{const i=item(),b=createHTSessionBook();b.update(i,assessHTItem(i,context,now),now);i.latest.goals.home=1;assert.equal(b.update(i,assessHTItem(i,context,now+1000),now+1000).closeReason,'SCORE_CHANGED');});
async function duplicateGoal(){
 const i=item(),history=[{fresh_at:now,captured_at:now,goals:{home:0,away:0}}],pool=new Map([[i.id,{...i,history}]]),f={...structuredClone(fixture),fixture:{...fixture.fixture,status:{short:'1H',elapsed:18}},goals:{home:1,away:0}};
 const c=vm.createContext({HTEvents:createHTEvents(),h1WatchWriteHistory(){},Date:class extends Date{static now(){return now+1000;}},Map,Set,Number,Math,JSON,Promise,HTCollection:{isEarly:()=>true,eligible:()=>true,plan:()=>[f],appendHistory:()=>({accepted:false})},
  H1_COLLECTION:{generation:1,pool,history:{beginCycle(){}}},H1_WATCH_MAX_ITEMS:5,h1WatchState:{active:true,refreshing:false,items:[],cycle:0},document:{visibilityState:'visible'},clearTimeout(){},ultraHeartbeat:async()=>({rows:[f]}),h1WatchEligible:()=>true,
  fetchH1CollectionSnapshot:async()=>({...i.latest,goals:{home:1,away:0},fixture:f}),mapLimit:async(a,n,fn)=>{for(const x of a)await fn(x);},renderH1Watch(){},status(){},$(){},ultraHubSummary(){return '';},scheduleH1Watch(){}});
 await vm.runInContext('('+refreshH1Watch.toString()+')',c)();return {observedGoal:f.goals.home,storedGoal:pool.get(i.id).latest.goals.home,resetAt:pool.get(i.id).resetAt??null};
}
const goal=await duplicateGoal();if(goal.observedGoal!==goal.storedGoal)findings.push({id:'HT-A01',severity:'HIGH',acceptance:'FAIL',reason:'Known new score discarded with duplicate stats timestamp; old recommendation not invalidated immediately',reproduction:goal});
const html=readFileSync(process.env.HT_AUDIT_HTML||'previous-mobile/site/index.html','utf8');
const resetSource=html.slice(html.indexOf('  function h1WatchResetEvent('),html.indexOf('  function h1WatchWhy('));
assert(resetSource.includes('function h1WatchResetEvent'));
const reset=vm.runInNewContext('('+resetSource.trim()+')',{HTEvents:createHTEvents()});
const previous={goals:{home:1,away:0},metrics:{total:{red:0}}},corrected={goals:{home:0,away:0},metrics:{total:{red:0}}};
const correctionEvent=reset(previous,corrected);if(correctionEvent===null)findings.push({id:'HT-A02',severity:'HIGH',acceptance:'FAIL',reason:'VAR/score correction does not reset legacy HT continuity or cooldown',reproduction:{before:'1-0',after:'0-0',resetEvent:correctionEvent}});
assert(!html.includes('rankHT('),'Ranking wiring changed; re-review required');
findings.push({id:'HT-A03',severity:'FUNCTIONAL_GAP',reason:'New pricing result is not the source of existing HT TOP/Push; ranking function exists but is not wired to current Mobile integration'});
findings.push({id:'HT-A04',severity:'MODEL_LIMIT',reason:'Historical Gamma-Poisson model has no live-pressure/opponent/red-card-rate update, added-time estimate or demonstrated calibration; no automated outcomes for new local recommendation sessions'});
const report={status:findings.some(f=>f.acceptance==='FAIL')?'NOT_READY':'PASS',source_commit:process.env.GITHUB_SHA,production_baseline:'d521619f3319ff715e61e745a2f25fbc3b286ddc',checks,findings,provider_requests:0,d1_writes:0,production_mutations:0};
mkdirSync('ht-audit',{recursive:true});writeFileSync('ht-audit/mechanism-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(report.status!=='PASS')process.exitCode=1;
