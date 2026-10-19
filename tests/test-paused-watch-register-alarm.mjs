import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const base=execFileSync('git',['show','3c97629e51251c56f9edeb8d0f67a7a0dad957a2:worker.js'],{encoding:'utf8'});
const begin=base.indexOf('  async ensureAlarm(delayMs=null){'),end=base.indexOf('  async register(body){',begin);assert(begin>=0&&end>begin);
const method=base.slice(begin,end),legacy=vm.runInNewContext('class NativeWatcher{'+method+'};NativeWatcher',{Date,Number});
function fixture(C){const w=new C();w.ctx={storage:{getAlarm:async()=>w.alarmAt??null,setAlarm:async x=>{w.alarmAt=x;w.writes++}}};w.writes=0;w.listWatches=async()=>[{ended:false,expires_at:Date.now()+60000,level:'focus'}];w.evidenceJobs=async()=>[];w.cfg=(n,d)=>d;w.scanControl=async()=>({enabled:false});return w}
const before=fixture(legacy);await before.ensureAlarm(1000);assert.equal(before.writes,1,'reproduce: baseline arms alarm despite OFF');
const text=readFileSync(new URL('../worker_notify_v135_full_pause.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export class BackgroundWatcher','class BackgroundWatcher').split('export default')[0];
const Fixed=vm.runInNewContext(text+';BackgroundWatcher',{NativeWatcher:legacy,Date,Number});
const after=fixture(Fixed);for(let i=0;i<5;i++)await after.ensureAlarm(1000);assert.equal(after.writes,0,'OFF registrations never arm or delete alarms');
after.scanControl=async()=>({enabled:true});const at=await after.ensureAlarm(1000);assert.equal(after.writes,1);assert(at>=Date.now()+9000,'existing minimum delay retained');await after.ensureAlarm(1000);assert.equal(after.writes,1,'existing alarm is not duplicated');
after.alarmAt=null;after.listWatches=async()=>[];after.evidenceJobs=async()=>[{pending:true}];after.scanControl=async()=>({enabled:false});await after.ensureAlarm(1000);assert.equal(after.writes,1,'OFF Evidence cannot arm');after.scanControl=async()=>({enabled:true});await after.ensureAlarm(1000);assert.equal(after.writes,2,'ON Evidence retains wake');
console.log('PAUSED_WATCH_ALARM: baseline bug reproduced; fixed OFF zero alarm writes; ON/watch/Evidence/idempotency preserved. No provider calls.');
