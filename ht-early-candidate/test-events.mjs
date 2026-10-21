import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHTEvents} from './events.mjs';
import {refreshH1Watch} from './mobile-collection.mjs';
import {createHTSessionBook} from './recommendation-session.mjs';
import {assessHTItem} from './assess-item.mjs';
const now=1792542600000,E=createHTEvents(),cases=[];
const latest=()=>({status:'1H',minute:18,captured_at:now,fresh_at:now,goals:{home:0,away:0},metrics:{total:{red:0,shots:6}},stats_presence:{shots:true},market_at:now,market_rows:[{category:'h1_total',values:[{value:'Over',handicap:.5,odd:2.7}]}],fixture:{fixture:{id:990001,timestamp:Math.floor((now-18*60000)/1000)},teams:{home:{id:1},away:{id:2}}}});
function check(name,fn){fn();cases.push({name,status:'PASS'});}
for(const [name,before,after,type] of [['goal',{home:0,away:0},{home:1,away:0},'GOAL'],['VAR reduction',{home:1,away:0},{home:0,away:0},'SCORE_CORRECTION'],['same-total allocation correction',{home:1,away:0},{home:0,away:1},'SCORE_CORRECTION']])check(name+' resets without renewing stats or appending history',()=>{const old={...latest(),goals:before},history=[old],i={latest:old,history},event=E.apply(i,{...old,goals:after},now+1000);assert.equal(event.type,type);assert.equal(i.latest.fresh_at,now);assert.equal(i.latest.captured_at,now);assert.equal(i.history,history);assert.equal(i.resetAt,now+1000);assert(i.cooldownUntil>now+1000);assert.equal(i.latest.market_rows.length,0);assert.equal(E.apply(i,{...old,goals:after},now+2000),null);assert.equal(i.resetAt,now+1000);});
for(const [n,red,type]of [['red increase',1,'RED_CARD'],['red correction',0,'RED_CORRECTION']])check(n,()=>{const old=latest();old.metrics.total.red=red?0:1;const i={latest:old};assert.equal(E.apply(i,{...old,metrics:{total:{red}}},now+1000).type,type);assert.equal(i.latest.fresh_at,now);});
check('ended half invalidates without extending clock',()=>{const i={latest:latest()};assert.equal(E.apply(i,{status:'HT',goals:i.latest.goals},now+1000).type,'HALF_ENDED');assert.equal(i.state,'ENDED');});
check('unknown red count is not a fabricated correction',()=>assert.equal(E.classify(latest(),{...latest(),metrics:{total:{}}}),null));
check('unchanged fixture creates no reset',()=>assert.equal(E.apply({latest:latest()},latest(),now+1000),null));
const context={at:now-1000,rows:Array.from({length:8},(_,i)=>({fixture_id:800+i,kickoff:Math.floor((now-(i+1)*86400000)/1000),status:'FT',home_team_id:1,away_team_id:2,halftime_home:1,halftime_away:0}))};
check('event reaches session and blocks recommendation immediately',()=>{const i={id:990001,latest:latest()},book=createHTSessionBook();book.update(i,assessHTItem(i,context,now),now);E.apply(i,{...i.latest,goals:{home:1,away:0}},now+1000);const row=assessHTItem(i,context,now+1000);assert.equal(row.action,'WAIT');assert.equal(book.update(i,row,now+1000).closeReason,'SCORE_CHANGED');});
async function integration({goal=false,red=false,failStats=false}={}){
 const i={id:990001,latest:latest(),history:[{fresh_at:now,captured_at:now}]},pool=new Map([[i.id,i]]),f={...i.latest.fixture,goals:goal?{home:1,away:0}:i.latest.goals};f.fixture={...f.fixture,status:{short:'1H',elapsed:18}};let fetched=0;
 const c=vm.createContext({HTEvents:E,Date:class extends Date{static now(){return now+1000;}},Map,Set,Number,Math,JSON,Promise,HTCollection:{isEarly:()=>true,eligible:()=>true,plan:()=>[f],appendHistory:()=>({accepted:false})},H1_COLLECTION:{generation:1,pool,history:{beginCycle(){}}},H1_WATCH_MAX_ITEMS:5,h1WatchState:{active:true,refreshing:false,items:[],cycle:0},document:{visibilityState:'visible'},clearTimeout(){},ultraHeartbeat:async()=>({rows:[f]}),h1WatchEligible:()=>true,fetchH1CollectionSnapshot:async()=>{fetched++;if(failStats)throw Error('STATS_ERROR');return {...i.latest,metrics:{total:{red:red?1:0}}};},mapLimit:async(a,n,fn)=>{for(const x of a)await fn(x);},h1WatchWriteHistory(){},renderH1Watch(){},status(){},$(){},ultraHubSummary(){return '';},scheduleH1Watch(){}});
 await vm.runInContext('('+refreshH1Watch.toString()+')',c)();return {i,fetched};
}
for(const failStats of [false,true]){const {i,fetched}=await integration({goal:true,failStats});assert.equal(i.latest.goals.home,1);assert.equal(i.latest.fresh_at,now);assert.equal(i.resetAt,now+1000);assert.equal(fetched,0);cases.push({name:'known goal handled before '+(failStats?'failing':'duplicate')+' stats',status:'PASS'});}
const {i}=await integration({red:true});assert.equal(i.latest.metrics.total.red,1);assert.equal(i.latest.fresh_at,now);cases.push({name:'red event processed before statistics deduplication',status:'PASS'});
console.log(JSON.stringify({status:'PASS',tests:cases.length,cases,provider_requests:0,d1_writes:0}));
