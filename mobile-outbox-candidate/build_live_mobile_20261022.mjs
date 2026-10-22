// 2026-10-22 live Mobile candidate (not deployed). Retains original builder transformations;
// strictly pins PUBLIC Mobile SHA from authenticated no-write production source inspection.
// Deterministic offline Mobile candidate patch. No deployment, no network.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const sourcePath=process.argv[2],targetPath=process.argv[3];
if(!sourcePath||!targetPath)throw Error('Usage: node build_mobile_candidate.mjs baseline.html candidate.html');
let html=readFileSync(sourcePath,'utf8');
const expected='005a74b4768a00f92ac462592b3de63106b2a4db35732103f6095cfed9fdb46d';
if(createHash('sha256').update(html).digest('hex')!==expected)throw Error('MOBILE_PRODUCTION_BASELINE_HASH_MISMATCH');
function rangeReplace(start,end,replacement){
 const a=html.indexOf(start),b=html.indexOf(end,a);
 if(a<0||b<=a||html.indexOf(start,a+1)!==-1)throw Error('SOURCE_BOUNDARY_AMBIGUOUS_'+start);
 html=html.slice(0,a)+replacement+html.slice(b);
}
const newEntry = `  function feDbEntryFingerprint(value){
    // Entire canonical payload: new valid changes, false, null and 0 remain distinct.
    const canonical=(v)=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
    return JSON.stringify(canonical(value));
  }
  async function feDbQueueEntryDecision(r,{schedule=true}={}){
    if(!r?.id)return false;
    const payload=JSON.parse(JSON.stringify(r)),id='ENTRY:'+r.id,fingerprint=feDbEntryFingerprint(payload);
    const task=FE_DB_STATE.evidenceWriteChain.then(async()=>{
      const pending=await feDbOutboxGet(id),old=pending?.fingerprint??await feDbSyncStateGet(id);
      if(old===fingerprint)return false;
      const ok=await feDbOutboxPut({id,type:'ENTRY_DECISION',created_at:Date.now(),payload,sync_key:id,fingerprint});
      if(!ok)throw new Error('ENTRY outbox failed: cannot acknowledge unsaved payload');
      if(schedule)feDbScheduleSync();
      return true;
    });
    FE_DB_STATE.evidenceWriteChain=task.catch(e=>log('ENTRY outbox queue error',e.message));
    return task;
  }
`;
rangeReplace('  async function feDbQueueEntryDecision(r,{schedule=true}={}){','  async function feDbQueueLiveSnapshot(r,{schedule=true}={}){',newEntry);
const newAck = `  async function feDbAckBatch(sentRows){
    // ACK + outbox removal must be one IndexedDB transaction; late ACK leaves newer event.
    if(!sentRows?.length)return;
    const db=await feDbOpen();if(!db)throw new Error('D1 ACK storage unavailable');
    await new Promise((resolve,reject)=>{
      const tx=db.transaction([FE_DB_SYNC_STORE,FE_DB_OUTBOX_STORE],'readwrite'),
        state=tx.objectStore(FE_DB_SYNC_STORE),outbox=tx.objectStore(FE_DB_OUTBOX_STORE),remember=[];
      for(const sent of sentRows){
        if(sent?.sync_key&&sent?.fingerprint){
          state.put({id:sent.sync_key,fingerprint:sent.fingerprint,synced_at:Date.now(),type:sent.type});
          remember.push([sent.sync_key,sent.fingerprint]);
        }
        const req=outbox.get(sent.id);req.onsuccess=()=>{
          const current=req.result;
          if(current&&(sent.queue_revision?current.queue_revision===sent.queue_revision:JSON.stringify(current)===JSON.stringify(sent)))outbox.delete(sent.id);
        };
      }
      tx.oncomplete=()=>{for(const [id,fp] of remember)FE_DB_STATE.syncFp.set(id,fp);resolve()};
      tx.onerror=tx.onabort=()=>reject(tx.error||new Error('D1 ACK transaction failed'));
    });
  }
`;
if(html.split('  async function feDbSyncStateGet(id){').length!==2)throw Error('SYNC_SOURCE_AMBIGUOUS');
html=html.replace('  async function feDbSyncStateGet(id){',newAck+'  async function feDbSyncStateGet(id){');
const old="if(!res?.ok)throw new Error(res?.error||'D1 sync failed');await feDbSyncStateMark(rows);await feDbOutboxDelete(rows);sent+=Number(res.accepted||rows.length);";
const replacement="if(res?.ok!==true||!Number.isInteger(res.accepted)||res.accepted!==rows.length||Number(res.ignored||0)!==0)throw new Error(res?.error||'D1 sync ACK incomplete or invalid; retaining outbox for retry');await feDbAckBatch(rows);sent+=res.accepted;";
if(html.split(old).length!==2)throw Error('OUTBOX_ACK_SOURCE_CHANGED');
html=html.replace(old,replacement);
writeFileSync(targetPath,html);
console.log('FE_D1_MOBILE_CANDIDATE_BUILT '+JSON.stringify({baseHash:expected,bytes:Buffer.byteLength(html),sha256:createHash('sha256').update(html).digest('hex'),productionDeployed:false}));
