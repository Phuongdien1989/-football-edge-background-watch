import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {indexedDB} from 'fake-indexeddb';
const html=readFileSync('mobile-outbox-candidate/candidate_mobile.html','utf8');
function extract(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a);
 assert.ok(a>=0&&b>a&&html.indexOf(start,a+1)<0,'candidate unique boundary '+start);
 return html.slice(a,b);
}
const outbox=new Map(),known=new Map(),syncFp=new Map();
let puts=0,schedules=0;
const state={evidenceWriteChain:Promise.resolve(),syncFp};
const context=vm.createContext({
 FE_DB_STATE:state,Date,JSON,Map,Set,Promise,Object,Array,String,Number,Error,console,
 feDbOutboxGet:async id=>outbox.get(id)||null,
 feDbSyncStateGet:async id=>known.get(id)||null,
 feDbOutboxPut:async event=>{puts++;outbox.set(event.id,{...event,queue_revision:'rev-'+puts});return true;},
 feDbScheduleSync:()=>schedules++,
 log:()=>{}
});
vm.runInContext(extract('  function feDbEntryFingerprint(value){','  async function feDbQueueLiveSnapshot(r,{schedule=true}={}){'),context);
const fp=context.feDbEntryFingerprint,enqueue=context.feDbQueueEntryDecision;
const e={id:'E-1',fixture_id:811,minute:0,entry_score:{home:0,away:0},candidate_supported:false,policy_status:'WATCH',resolution:'PENDING',market:{line:0,price:null}};
assert.equal(await enqueue(e),true,'first entry queued');
assert.equal(puts,1);
assert.equal(await enqueue({...e,entry_score:{away:0,home:0}}),false,'key order not a meaningful delta');
assert.equal(puts,1);
assert.equal(await enqueue(e),false,'lost ACK must not generate duplicate pending record');
assert.equal(puts,1);
assert.notEqual(fp(e),fp({...e,minute:null}),'minute 0 and missing must differ');
assert.notEqual(fp(e),fp({...e,candidate_supported:null}),'false and null differ');
const settled={...e,resolution:'RESOLVED',outcome:'HIT',resolved_at:3200,unit_pl:0};
assert.equal(await enqueue(settled),true,'new legitimate outcome is queued');
assert.equal(puts,2);
assert.equal(outbox.get('ENTRY:E-1').payload.outcome,'HIT');
assert.equal(outbox.get('ENTRY:E-1').payload.unit_pl,0);
const pending=outbox.get('ENTRY:E-1');
known.set('ENTRY:E-1',pending.fingerprint);
outbox.delete('ENTRY:E-1');
assert.equal(await enqueue({...settled}),false,'already ACKed fingerprint not sent again');
assert.equal(puts,2);
assert.equal(await enqueue({...settled,unit_pl:1}),true,'valid correction must not be discarded');
assert.equal(puts,3);
const dbName='FE_D1_QA_ACK_'+Date.now();
const db=await new Promise((resolve,reject)=>{
 const r=indexedDB.open(dbName,1);r.onupgradeneeded=()=>{
  r.result.createObjectStore('events',{keyPath:'id'});
  r.result.createObjectStore('sync_state',{keyPath:'id'});
 };r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
});
const put=async record=>new Promise((resolve,reject)=>{
 const tx=db.transaction('events','readwrite');tx.objectStore('events').put(record);
 tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
});
const get=async(store,id)=>new Promise((resolve,reject)=>{
 const tx=db.transaction(store,'readonly'),r=tx.objectStore(store).get(id);
 r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);
});
const ackctx=vm.createContext({
 FE_DB_STATE:state,FE_DB_OUTBOX_STORE:'events',FE_DB_SYNC_STORE:'sync_state',
 feDbOpen:async()=>db,Date,Promise,JSON,Error
});
vm.runInContext(extract('  async function feDbAckBatch(sentRows){','  async function feDbSyncStateGet(id){'),ackctx);
const old={id:'ENTRY:E-2',type:'ENTRY_DECISION',queue_revision:'rev-old',sync_key:'ENTRY:E-2',fingerprint:'old'};
const next={...old,queue_revision:'rev-new',fingerprint:'new'};
await put(next);
await ackctx.feDbAckBatch([old]);
assert.equal((await get('events',old.id)).queue_revision,'rev-new','late ACK must retain revised queued event');
assert.equal((await get('sync_state',old.sync_key)).fingerprint,'old','late ACK records sent state only');
await ackctx.feDbAckBatch([next]);
assert.equal(await get('events',next.id),null,'matching ACK deletes outbox event');
assert.equal((await get('sync_state',next.sync_key)).fingerprint,'new','fingerprint committed atomically');
assert.equal(syncFp.get(next.sync_key),'new','in-memory cache updated only after committed transaction');
assert.ok(html.includes("res.accepted!==rows.length||Number(res.ignored||0)!==0"),'partial ACK must not drop events');
assert.ok(!html.includes("await feDbSyncStateMark(rows);await feDbOutboxDelete(rows);"),'old non-atomic ACK sequence removed');
console.log('FE_D1_MOBILE_OUTBOX_QA_PASS '+JSON.stringify({first_saved:true,duplicate_rejected:true,lost_ack_no_requeue:true,late_ack_keeps_new_revision:true,settled_outcome_preserved:true,minute_zero_distinct_from_missing:true,atomic_ack:true,partial_ack_rejected:true,productionDeploy:false}));
db.close();
