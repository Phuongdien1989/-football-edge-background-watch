import assert from 'node:assert/strict';
import {instrumentD1Binding,instrumentD1Env} from '../d1-production-meter.mjs';
let logs=[],calls=0,batches=0;
const previous=console.log;console.log=(msg)=>logs.push(String(msg));
try{
 const db={
  prepare(sql){return {sql,params:[],bind(...p){this.params=p;return this},
   async run(){calls++;return {success:true,meta:{rows_written:sql.includes('fe_notify_live_state')?3:5,changes:1}}},
   async all(){return {results:[1]}},async first(){return {ok:true}},async raw(){return [2]}};},
  async batch(ss){batches++;return Promise.all(ss.map(s=>s.run()))}
 };
 const env={FOOTBALL_DB:db,APISPORTS_KEY:'SECRET_MUST_NOT_LOG'};
 const wrapped=instrumentD1Env(env,'DURABLE_OBJECT');
 assert.notEqual(wrapped.FOOTBALL_DB,db);
 assert.equal(wrapped.APISPORTS_KEY,'SECRET_MUST_NOT_LOG');
 const sql='INSERT INTO live_snapshots (id,fixture_id,source) VALUES (?,?,?)';
 const a=wrapped.FOOTBALL_DB.prepare(sql).bind('PRIVATE_ID',99,'EVIDENCE_FOLLOWUP');
 const b=wrapped.FOOTBALL_DB.prepare(sql).bind('PRIVATE_ID2',99,'SMART_FOLLOW');
 const res=await wrapped.FOOTBALL_DB.batch([a,b]);
 assert.equal(res.length,2);assert.equal(calls,2);assert.equal(batches,1);
 const event=JSON.parse(logs[0].slice('FE_D1_ROUTE_V1 '.length));
 assert.equal(event.summary.EVIDENCE.rows_written,5);
 assert.equal(event.summary.SMART_FOLLOW.rows_written,5);
 assert.equal(event.summary.EVIDENCE.classification,'NEW_UPDATE_RETRY_UNKNOWN');
 assert.deepEqual(await wrapped.FOOTBALL_DB.prepare('SELECT * FROM teams').all(),{results:[1]});
 assert.equal(calls,2,'reads have no extra calls');
 await wrapped.FOOTBALL_DB.prepare('INSERT INTO fe_notify_live_state VALUES(?)').bind('PRIVATE_PAYLOAD').run();
 assert.equal(calls,3);assert.equal(logs.length,2);
 const sync=instrumentD1Binding(db,'EDGE_WORKER');
 await sync.prepare('INSERT INTO entry_decisions VALUES(?)').bind('PRIVATE_JSON').run();
 assert.ok(logs.at(-1).includes('SYNC_ENTRY'));
 for(const privateValue of ['PRIVATE_ID','PRIVATE_ID2','PRIVATE_PAYLOAD','PRIVATE_JSON','SECRET_MUST_NOT_LOG']){
  assert.equal(logs.join('\n').includes(privateValue),false,'no secrets or payloads in metric');
 }
 const fatal=new Error('same D1 error');
 const broken=instrumentD1Binding({prepare(){return {async run(){throw fatal}}}},'EDGE_WORKER');
 await assert.rejects(()=>broken.prepare('INSERT INTO validation_results VALUES(1)').run(),e=>e===fatal);
 assert.equal(logs.length,3);
 previous('PASS: passive meter preserves D1 results/errors, captures batch meta, logs counters only, adds no SQL operations');
}finally{console.log=previous}
