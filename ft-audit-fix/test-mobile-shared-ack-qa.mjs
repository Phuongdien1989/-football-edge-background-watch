// Final review QA: no deployment, no D1 SQL.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
import {indexedDB} from 'fake-indexeddb';
const html=readFileSync('mobile-outbox-candidate/candidate_mobile.html','utf8');
const start='  async function feDbAckBatch(sentRows){',end='  async function feDbSyncStateGet(id){';
const a=html.indexOf(start),b=html.indexOf(end,a);
assert(a>=0&&b>a&&html.indexOf(start,a+1)<0,'SHARED_ACK_BOUNDARY_INVALID');
const name='FE_D1_SHARED_ACK_QA_'+process.pid;
const db=await new Promise((resolve,reject)=>{
 const r=indexedDB.open(name,1);
 r.onupgradeneeded=()=>{r.result.createObjectStore('events',{keyPath:'id'});r.result.createObjectStore('sync_state',{keyPath:'id'});};
 r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
});
async function put(store,row){return new Promise((resolve,reject)=>{
 const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(row);
 tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
});}
async function get(store,id){return new Promise((resolve,reject)=>{
 const tx=db.transaction(store,'readonly');const r=tx.objectStore(store).get(id);
 r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error);
});}
let checks=0;async function test(name,fn){await fn();checks++;console.log('PASS '+name);}
const syncFp=new Map();
const ctx=vm.createContext({FE_DB_STATE:{syncFp},FE_DB_OUTBOX_STORE:'events',FE_DB_SYNC_STORE:'sync_state',feDbOpen:async()=>db,Date,Promise,JSON,Error});
vm.runInContext(html.slice(a,b),ctx);
const ack=ctx.feDbAckBatch;
await test('LIVE_SNAPSHOT without fingerprint clears matching outbox only',async()=>{
 const e={id:'LIVE:1',type:'LIVE_SNAPSHOT',queue_revision:'rev1'};
 await put('events',e);await ack([e]);
 assert.equal(await get('events',e.id),null);
 assert.equal(await get('sync_state',e.id),null);
});
await test('QSIG result with fingerprint writes sync state and removes queue',async()=>{
 const e={id:'QSIG:1',type:'QSIG_RESULT',queue_revision:'q1',sync_key:'QSIG:1',fingerprint:'a'};
 await put('events',e);await ack([e]);
 assert.equal(await get('events',e.id),null);
 assert.equal((await get('sync_state',e.id)).fingerprint,'a');
 assert.equal(syncFp.get(e.id),'a');
});
await test('old QSIG ACK does not delete newer QSIG result',async()=>{
 const old={id:'QSIG:2',type:'QSIG_RESULT',queue_revision:'q1',sync_key:'QSIG:2',fingerprint:'old'};
 const newer={...old,queue_revision:'q2',fingerprint:'new'};
 await put('events',newer);await ack([old]);
 assert.equal((await get('events',old.id)).fingerprint,'new');
 assert.equal((await get('sync_state',old.id)).fingerprint,'old');
 await ack([newer]);assert.equal(await get('events',old.id),null);
 assert.equal((await get('sync_state',old.id)).fingerprint,'new');
});
await test('same transaction supports mixed ENTRY and LIVE batch',async()=>{
 const entry={id:'ENTRY:2',type:'ENTRY_DECISION',queue_revision:'e2',sync_key:'ENTRY:2',fingerprint:'fp2'};
 const live={id:'LIVE:2',type:'LIVE_SNAPSHOT',queue_revision:'l2'};
 await put('events',entry);await put('events',live);
 await ack([entry,live]);assert.equal(await get('events',entry.id),null);assert.equal(await get('events',live.id),null);
 assert.equal((await get('sync_state',entry.id)).fingerprint,'fp2');
});
await test('empty ACK remains a no-op',async()=>{await ack([]);assert.equal(await get('events','LIVE:2'),null);});
db.close();
mkdirSync('ft-audit-output',{recursive:true});
writeFileSync('ft-audit-output/ft-mobile-shared-ack-qa.json',JSON.stringify({status:'PASS',checks,scope:'OFFLINE_IDB_SIMULATION',production_changed:false,D1_writes:0},null,2));
console.log('FE_MOBILE_SHARED_ACK_QA_PASS '+JSON.stringify({checks,production_changed:false}));
