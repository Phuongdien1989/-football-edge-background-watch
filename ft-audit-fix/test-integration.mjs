import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {observeFT,observeFTStats,observeFTRedEvents,observeFTCatalog} from './ft-events.mjs';
const baseline=process.argv[2]||'baseline',out=process.argv[3]||'ft-audit-output';
const {createEngine}=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(out+'/candidate/notify-core.js','utf8')).toString('base64'));
function load(path){let source=readFileSync(path,'utf8').replace(/^import .*;\s*$/gm,'').replace('export class BackgroundWatcher','class BackgroundWatcher').replace('export default base;','return BackgroundWatcher;');
 return new Function('DeepLinkWatcher','base','createHTCollection','readHTContext','createHTHistoryCache','assessHTItem','createEngine','crossing','observeFT','observeFTStats','observeFTRedEvents','observeFTCatalog',source)(class{}, {},()=>({eligible:()=>false}),async()=>({}),()=>({beginCycle(){}}),()=>null,createEngine,()=>({state:{},send:false}),observeFT,observeFTStats,observeFTRedEvents,observeFTCatalog);}
const before=load(baseline+'/candidate/worker_notify_v130.js'),after=load(out+'/candidate/worker_notify_v130.js');
const f=(goals,phase='2H')=>({fixture:{id:42,status:{short:phase,elapsed:75}},goals,teams:{home:{id:1,name:'A'},away:{id:2,name:'B'}}});
async function run(C,fixture,stats=[],events=[]){
 const w=new C(),now=Date.now(),rows=new Map(),storage=new Map(),calls=[];let writes=0,bytes=0;
 const old={id:42,lastAt:now-1000,history:[{captured_at:now-1000}],hcHistory:[{hc:1}],h1History:[{h1:1}],oddsHistory:[],alerts:{},red:0,ui:{fixture:f({home:1,away:0}),captured_at:now-1000,snapshot:{fresh_at:now-1000},engines:{FT:{score:85},H1:{score:72}},goal_estimates:{d:{prob:80}}}};
 rows.set(42,structuredClone(old));w.env={};w.ctx={storage:{get:async k=>storage.get(k),put:async(k,v)=>storage.set(k,v)}};w.scanControl=async()=>({enabled:true});w.devices=async()=>[{id:'d',prefs:{enabled:true,goal:true,h1:false,gap:false}}];w.listNotifyMatches=async()=>[...rows.values()].map(x=>structuredClone(x));w.putNotifyMatch=async(id,x)=>{writes++;bytes+=Buffer.byteLength(JSON.stringify(x));rows.set(id,structuredClone(x));};w.deleteNotifyMatch=async id=>rows.delete(id);w.api=async(path)=>{calls.push(path);return path==='/fixtures'?(fixture?[fixture]:[]):path==='/fixtures/statistics'?stats:path==='/fixtures/events'?events:[]};w.send=async()=>{throw Error('UNEXPECTED_PUSH')};await w.notifyTick();return {row:rows.get(42),old,calls,writes,bytes};
}
const old=await run(before,f({home:2,away:0}));assert.equal(old.row.ui.engines.FT.score,85,'baseline defect must reproduce');
let n=0;
for(const [name,fixture]of [['goal',f({home:2,away:0})],['VAR',f({home:0,away:0})],['score allocation',f({home:0,away:1})],['ended',f({home:1,away:0},'FT')]]){
 const r=await run(after,fixture);assert.equal(r.row.ui.engines.FT.score,null,name);assert.equal(r.row.ui.goal_estimates.d.prob,null);assert.deepEqual(r.row.hcHistory,r.old.hcHistory);assert.deepEqual(r.row.h1History,r.old.h1History);assert.deepEqual(r.row.ui.engines.H1,r.old.ui.engines.H1);assert.equal(r.row.ui.snapshot.fresh_at,r.old.ui.snapshot.fresh_at);assert.equal(r.calls.length,name==='ended'?1:5);n++;
}
const stats=[1,2].map((id)=>({team:{id},statistics:[{type:'Red Cards',value:id===1?1:0},{type:'Total Shots',value:10},{type:'Shots on Goal',value:4},{type:'Shots insidebox',value:6},{type:'Corner Kicks',value:3}]}));
const redResult=await run(after,f({home:1,away:0}),stats);
assert(redResult.row.ftInvalidation?.reasons.includes('RED_CARD'));
assert(redResult.row.ftStatsClock?.receivedAt>0);
assert.equal(redResult.row.ftStatsClock.sourceAt,null);
assert.equal(redResult.row.ui.engines.FT.scoreMode,'BASELINE');
n++;
const missing=await run(after,null);
assert.equal(missing.row.ftCatalogMissing,true);assert.equal(missing.row.ui.engines.FT.score,null);assert.equal(missing.row.ftInvalidation.ended,false);assert.equal(missing.calls.length,1);assert.deepEqual(missing.row.hcHistory,missing.old.hcHistory);n++;
const eventOnly=await run(after,f({home:1,away:0}),[],[{type:'Card',detail:'Red Card',team:{id:1},player:{id:10},time:{elapsed:74}}]);
assert.equal(eventOnly.row.ui.engines.FT.score,null);assert(eventOnly.row.ftInvalidation.reasons.includes('FT_RED_EVENT_CHANGE'));assert.equal(eventOnly.row.red,0);assert.equal(eventOnly.calls.length,5);n++;
const code=readFileSync(out+'/candidate/notify-ui-state.mjs','utf8');const {uiStatePacket}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const row={id:42,history:[],h1History:[],hcHistory:[],cooldown:10,ftCooldownUntil:20,ftResetAt:15,ui:{revision:1,captured_at:1,fixture:f({home:1,away:0}),engines:{},snapshot:{}}};
const packet=uiStatePacket([row],{now:30});assert.equal(packet.snapshots[0].runtime.FT.cooldownUntil,20);assert.equal(packet.snapshots[0].runtime.HC.cooldownUntil,10);n++;
const corrected=await run(after,f({home:2,away:0}));
const writeMeasure={mode:'MOCK_LOGICAL_PUTS_NOT_PRODUCTION_BILLING',goal_with_missing_stats:{baseline_puts:old.writes,candidate_puts:corrected.writes,extra_puts:corrected.writes-old.writes},catalog_disappearance:{puts:missing.writes},events_red_missing_stats:{puts:eventOnly.writes},recorder_runtime_writes:0};
assert.equal(writeMeasure.goal_with_missing_stats.extra_puts,1);
writeFileSync(out+'/write-budget.json',JSON.stringify(writeMeasure,null,2));
writeFileSync(out+'/event-tests.json',JSON.stringify({status:'PASS',unit_checks:16,worker_and_ui_checks:n,baseline_missing_stats_defect_reproduced:true,production_validated:false},null,2));console.log('WORKER_AND_UI_PASS '+n);
