import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../worker_notify_v136_hot_priority.js',import.meta.url),'utf8');
const start=source.indexOf('  async applyHotPriority(){');
const end=source.indexOf('  async send(device,payload){',start);
assert.ok(start>=0&&end>start,'scheduler method must be present');
const method=source.slice(start,end);
let now=1_800_000_000_000;
const DateMock={now:()=>now};
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const writes=[];
const records=new Map([['notify:match:123',{id:123,lastAt:now,last:{at:now}}]]);
const storage={
  get:async k=>records.get(k),
  put:async(k,v)=>{writes.push(k);records.set(k,structuredClone(v));}
};
const obj=vm.runInNewContext('({'+method+'})',{Date:DateMock,num});
obj.ctx={storage};
obj.getNotifyMatch=id=>storage.get('notify:match:'+id);
obj.putNotifyMatch=(id,item)=>storage.put('notify:match:'+id,item);
let reason='GAP_NEAR';
obj.hotPriorityCandidates=async()=>({rows:[{id:123,score:1075,reason}],cfg:{hotMs:20000,normalMs:30000,hotSlots:6},totalHot:1});
const run=()=>obj.applyHotPriority();
await run();
assert.deepEqual(writes,['notify:match:123','notify:scheduler-status'],'first tick writes boost and status');
writes.length=0;
now+=20_000;
await run();
assert.equal(writes.length,0,'repeat tick must not write HOT or status');
now+=100_000;
await run();
assert.deepEqual(writes,['notify:match:123','notify:scheduler-status'],'refresh at 120 seconds');
writes.length=0;
reason='H1_NEAR';
now+=20_000;
await run();
assert.deepEqual(writes,['notify:match:123'],'reason change immediately updates HOT boost');
writes.length=0;
now+=20_000;
obj.hotPriorityCandidates=async()=>({rows:[],cfg:{hotMs:20000,normalMs:30000,hotSlots:6},totalHot:0});
await run();
assert.equal(writes.length,0,'no candidates should not produce duplicate writes');
console.log('PASS: scheduler runtime simulation (120s throttle, reason changes, no duplicate writes)');
