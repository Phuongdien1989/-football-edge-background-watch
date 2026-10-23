// Actual inherited v130 notifyTick executed side-by-side under equal,
 // deterministic, locally mocked API fixtures. Real createEngine() from
 // notify-core-h1.js. No Cloudflare import, production API or D1 is invoked.
 // Does NOT replace production CPU/latency/Push acceptance testing.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {patchExistingNotify} from './build-review-patch.mjs';
import {uiStatePacket} from '../notify-ui-state.mjs';
import {fromBridges} from '../ui-tabs-preview/read-model.mjs';
const root='ft-audit-output/ft-pilot-parity';mkdirSync(root,{recursive:true});
const FIXED=Date.UTC(2026,9,23,7,30,0);
const clock=`export const clockNow=()=>${FIXED};`;
writeFileSync(root+'/clock.mjs',clock);
writeFileSync(root+'/stub-crossing.mjs',`export function crossing(previous,value,threshold,now){
 const r={armed:true,lastSent:0,...previous};
 if(value==null||!Number.isFinite(value))return {state:r,send:false};
 if(value<threshold-5)r.armed=true;
 return {state:r,send:!!r.armed&&value>=threshold&&now-r.lastSent>=300000};
}`);
writeFileSync(root+'/stub-base.mjs',`
export default {};
export class BackgroundWatcher {
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.requests=[];this.sends=[];this.delays=[];}
 async devices(){return structuredClone(this.ctx.seedDevices);}
 async api(path,params,strict){
  this.requests.push({path,params,strict});
  const key=path+':'+(params.fixture??params.id??'all')+':'+(params.half?'half':'full');
  const result=this.ctx.responses[key];
  if(result instanceof Error)throw result;
  return structuredClone(result??[]);
 }
 async listNotifyMatches(){return [...this.ctx.data.entries()]
  .filter(([k])=>k.startsWith('notify:match:')).map(([,v])=>structuredClone(v));}
 async putNotifyMatch(id,item){this.ctx.data.set('notify:match:'+id,structuredClone(item));}
 async deleteNotifyMatch(id){this.ctx.data.delete('notify:match:'+id);}
 async send(d,packet){this.sends.push({id:d.id,payload:structuredClone(packet)});
  return this.ctx.pushAccepted!==false;}
 async fetch(){throw Error('NOT_EXERCISED_BY_PARITY_HARNESS');}
 async alarm(){throw Error('NOT_EXERCISED_BY_PARITY_HARNESS');}
}
`);
const original=readFileSync('worker_notify_v130.js','utf8');
const patched=patchExistingNotify(original);
function adapt(text,isPilot){
 const head=`import {clockNow} from './clock.mjs';\n`;
 return head+text
 .replace("from './worker_notify_v128.js'","from './stub-base.mjs'")
 .replace("from './notify-core-h1.js'","from '../../notify-core-h1.js'")
 .replace("from './worker_notify.js'","from './stub-crossing.mjs'")
 .replace("from './ft-pilot/integration.mjs'","from '../../ft-pilot/integration.mjs'")
 .replaceAll('Date.now()','clockNow()');
}
writeFileSync(root+'/before.mjs',adapt(original,false));
writeFileSync(root+'/after.mjs',adapt(patched,true));
const {BackgroundWatcher:Before}=await import(pathToFileURL(resolve(root+'/before.mjs')));
const {BackgroundWatcher:After}=await import(pathToFileURL(resolve(root+'/after.mjs')));
const clone=x=>structuredClone(x);
function stats(homeId,awayId,multiplier=1){
 const side=(id,ratio)=>({team:{id},statistics:[
  {type:'Total Shots',value:Math.round(18*ratio*multiplier)},
  {type:'Shots on Goal',value:Math.round(8*ratio*multiplier)},
  {type:'Shots insidebox',value:Math.round(11*ratio*multiplier)},
  {type:'Corner Kicks',value:Math.round(7*ratio*multiplier)},
  {type:'expected_goals',value:Math.round(1.7*ratio*multiplier*100)/100},
  {type:'Ball Possession',value:Math.round(54*ratio)+'%'},
  {type:'Red Cards',value:0}]});
 return [side(homeId,1),side(awayId,.7)];
}
function fx(id,status,minute,home=1,away=0){
 return {fixture:{id,status:{short:status,elapsed:minute}},
  league:{name:'Actual Evaluator Replay'},teams:{home:{id:id+1,name:'Alpha '+id},away:{id:id+2,name:'Beta '+id}},
  goals:{home,away},score:{halftime:{home:0,away:0},fulltime:null}};
}
function odds(fixture){
 const id=fixture.fixture.id;
 return [{fixture:{id},status:{stopped:false,blocked:false,finished:false},
  odds:[{id:5,name:'Over/Under',values:[
   {value:'Over 2.5',handicap:'2.5',odd:'1.91',main:true},
   {value:'Under 2.5',handicap:'2.5',odd:'1.95',main:true}
  ]}]}];
}
function responseSet(scenario){
 const f=scenario.fixture;
 const id=f.fixture.id;
 return {
  '/fixtures:all:full':[f],
  ['/fixtures/statistics:'+id+':full']:scenario.statsError?new Error('RATE_LIMIT'):scenario.noStats?[]:stats(id+1,id+2),
  ['/fixtures/events:'+id+':full']:[{type:'Goal',time:{elapsed:12},team:{id:id+1},player:{name:'Source Event'}}],
  ['/odds/live:'+id+':full']:scenario.oddsError?new Error('RATE_LIMIT'):odds(f),
  ['/fixtures/statistics:'+id+':half']:scenario.noStats?[]:stats(id+1,id+2,.44)
 };
}
function makeContext(scenario){
 const data=new Map();
 const f=scenario.fixture,id=f.fixture.id;
 if(scenario.prior){
  const p=scenario.prior;
  data.set('notify:match:'+id,clone({
   id,history:[{captured_at:FIXED-8*60000,minute:f.fixture.status.elapsed-8,
    goals:{home:p.home,away:p.away},
    stats_presence:{shots:true,sot:true,inbox:true,corners:true,xg:true},
    metrics:{total:{shots:5,sot:2,inbox:4,corners:3,xg:.4,red:0}}}],
   h1History:[],hcHistory:[],oddsHistory:[],
   score:p.home+'-'+p.away,red:0,half:f.fixture.status.short,changedAt:FIXED-900000,
   lastAt:FIXED-30000,alerts:{'device-1:h1':{armed:true,lastSent:0},
    'device-1:goal':{armed:true,lastSent:0},'device-1:gap':{armed:true,lastSent:0}}
  }));
 }
 const tasks=[],storage={
  get:async key=>clone(data.get(key)),
  put:async(key,value)=>{data.set(key,clone(value));},
  transaction:async fn=>fn({get:async key=>clone(data.get(key)),put:async(key,x)=>data.set(key,clone(x))})
 };
 const context={responses:responseSet(scenario),pushAccepted:scenario.pushAccepted,
  seedDevices:[{id:'device-1',prefs:{enabled:true,h1:true,goal:true,gap:true,
   h1Threshold:1,goalThreshold:1,gapThreshold:1}}],
  data,storage,waitUntil(p){tasks.push(p);}};
 return {context,tasks};
}
const projected=(w,ctx)=>{
 const match=[...ctx.data.entries()].filter(([k])=>k.startsWith('notify:match:'))
   .map(([k,v])=>[k,v]);
 const items=match.map(([,v])=>v);
 const mobile=uiStatePacket(items,{device:'device-1',now:FIXED});
 // Explicit mock rank is exactly the same incoming ranked TOP reference.
 // This tests UI adapter non-regression, NOT the independent TOP ranker.
 const ranked=items.map((item,i)=>({
   id:item.id,ft:{...item,latest:item.ui?.snapshot},
   h1:{...item,latest:item.ui?.h1_snapshot||item.ui?.snapshot},
   hc:{...item,latest:item.ui?.hc_snapshot||item.ui?.snapshot},
   __rank:{top:i+1,primary:{engine:'FT'}},__addon:{rankWhy:'Existing TOP preserved'}
 }));
 const legacy={read:()=>({watchState:{items},h1WatchState:{items},
  handicapWatchState:{pool:items}})};
 const tabs=fromBridges({legacy,master:{masterRows:()=>ranked},
  overviewRows:()=>[]},FIXED);
 return {
  match,
  mobile,
  tabs,
  scannerStatus:ctx.data.get('notify:status')||null,
  notifyBudget:ctx.data.get('notify:budget')||null,
  requests:w.requests,
  sends:w.sends
 };
};
const cases=[
 {name:'1H HT+HC valuation and alert state',fixture:fx(11001,'1H',32,0,0),prior:{home:0,away:0}},
 {name:'2H FT+HC price history and eligible Push',fixture:fx(11002,'2H',70,1,1),prior:{home:1,away:1}},
 {name:'2H missing statistics, class NOT_RECOMMENDED',fixture:fx(11003,'2H',63,1,0),noStats:true},
 {name:'2H odds provider error preserves HT HC analytics',fixture:fx(11004,'2H',76,2,1),oddsError:true,prior:{home:2,away:1}},
 {name:'2H stats provider error',fixture:fx(11005,'2H',79,1,2),statsError:true},
 {name:'2H goal/reset cooldown',fixture:fx(11006,'2H',67,1,2),prior:{home:0,away:0}},
 {name:'2H Push transport rejected',fixture:fx(11007,'2H',70,1,1),prior:{home:1,away:1},pushAccepted:false}
];
const modes=[{name:'OFF',flag:'false',d1Fault:false},
 {name:'ON_D1_FAULT',flag:'true',d1Fault:true},
 {name:'ON_BUDGET_EXHAUSTED',flag:'true',d1Fault:false,budget:true}];
const samples=[];let checks=0;
const originalDateNow=Date.now;
Date.now=()=>FIXED;
try{
for(const scenario of cases)for(const mode of modes){
 const a=makeContext(scenario),b=makeContext(scenario);
 if(mode.budget){
  b.context.data.set('ft:pilot:v1:DUAL-REPLAY-EPOCH:sql-budget',{used:60,reserved_writes:240});
 }
 const env={NOTIFY_DAILY_BUDGET:'43000',FT_PILOT_ENABLED:mode.flag,
  FT_PILOT_EPOCH:'DUAL-REPLAY-EPOCH',FT_PILOT_LOGIC_VERSION:'a'.repeat(64),
  FT_PILOT_DB:{prepare(){throw Error('LOCAL_D1_FAULT_INJECTED')}}};
 const before=new Before(a.context,{...env,FT_PILOT_ENABLED:'false'});
 const after=new After(b.context,env);
 const t0=performance.now();await before.notifyTick();const t1=performance.now();
 const t2=performance.now();await after.notifyTick();const t3=performance.now();
 await Promise.all(b.tasks);
 const left=projected(before,a.context),right=projected(after,b.context);
 try{assert.deepEqual(right,left,
  'LEGACY_BEFORE_AFTER_DRIFT '+scenario.name+' '+mode.name);}catch(err){
  const firstDiff=(x,y,where='root')=>{
   if(Object.is(x,y))return null;
   if(typeof x!==typeof y||!x||!y||typeof x!=='object')return {at:where,before:x,after:y};
   const keys=new Set([...Object.keys(x),...Object.keys(y)]);
   for(const k of keys){const d=firstDiff(x[k],y[k],where+'.'+k);if(d)return d;}
   return {at:where,reason:'OBJECT_ORDER'};
  };
  console.error('FE_FT_PILOT_DUAL_REPLAY_DIFF '+JSON.stringify({
   scenario:scenario.name,mode:mode.name,difference:firstDiff(left,right)}).slice(0,1800));
  throw err;
 }
 if(mode.flag==='false'){
  assert.equal(b.tasks.length,0);
  assert.equal([...b.context.data.keys()].filter(x=>x.startsWith('ft:pilot:')).length,0);
 }else{
  assert.equal(b.tasks.length,scenario.fixture.fixture.status.short==='2H'?1:0);
 }
 checks++;
 samples.push({scenario:scenario.name,mode:mode.name,
  before_ms:Math.round((t1-t0)*100)/100,after_ms:Math.round((t3-t2)*100)/100,
  push_packets:before.sends.length,api_requests:before.requests.length,
  state_equal:true});
}
}finally{Date.now=originalDateNow;}
const result={checks,scenarios:cases.length,modes:modes.map(x=>x.name),
  using_real_createEngine:true,using_real_notifyTick:true,
  provider_calls_added:0,ht_hc_ft_stored_state_equal:true,push_packets_equal:true,
  actual_uiStatePacket_equal:true,existing_tabs_card_inputs_and_mock_top_equal:true,
  scanner_control_unchanged:true,simulation_not_production_cpu_acceptance:true,
  paired_latency_ms:samples,production_deploy:false};
writeFileSync(root+'/dual-replay-report.json',JSON.stringify(result,null,2));
console.log('FE_FT_PILOT_REAL_ENGINE_DUAL_REPLAY_PASS '+JSON.stringify({
 checks,scenarios:cases.length,modes:modes.map(x=>x.name),provider_calls_added:0,
 stored_state_push_mobile_tabs_equal:true,production_measured:false
}));
