import assert from 'node:assert/strict';
import {spawnSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPersistentCollector,RESERVE_SQL} from './persistent-collector.mjs';
const dir=mkdtempSync(join(tmpdir(),'ft-budget-')),path=join(dir,'test.sqlite');
let sqlCalls=0;
function query(sql,args=[]){
 sqlCalls++;
 const p=spawnSync('python3',['ft-audit-fix/sqlite-d1-bridge.py'],{input:JSON.stringify({path,sql,args}),encoding:'utf8'});
 if(p.status!==0)throw Error(p.stderr);
 return JSON.parse(p.stdout);
}
const db={prepare(sql){return {bind(...args){return {async first(){return query(sql,args).row;},async run(){const r=query(sql,args);return {meta:{changes:r.changes}};}};}};}};
const input=(id='x')=>({id,fixture_id:42,decision_at:1000,fixture:{fixture:{id:42,status:{short:'2H'}},goals:{home:1,away:0}}});
const options={enabled:true,maxRecordBytes:20000,clock:()=>2000};
function reset(records=2,bytes=40000){
 query('DELETE FROM ft_replay_budget_v1');
 query('DELETE FROM ft_replay_records_v1');
 query('INSERT INTO ft_replay_budget_v1(id,window_start,window_end,max_records,max_bytes) VALUES(1,1000,3000,?,?)',[records,bytes]);
}
let checks=0;
async function test(name,fn){await fn();checks++;console.log('PASS '+name);}
try{
 query(readFileSync('ft-audit-fix/persistent-budget.sql','utf8'));
 query(readFileSync('ft-audit-fix/replay-ledger.sql','utf8'));
 await test('disabled makes no query',async()=>{const n=sqlCalls;assert.equal((await createPersistentCollector(null).capture(null)).status,'DISABLED');assert.equal(sqlCalls,n);});
 await test('missing budget denies without ledger write',async()=>{assert.equal((await createPersistentCollector(db,options).capture(input())).status,'BUDGET_DENIED');assert.equal(query('SELECT count(*) AS n FROM ft_replay_records_v1').row.n,0);});
 await test('restart preserves exhausted allocation',async()=>{reset(1);assert.equal((await createPersistentCollector(db,options).capture(input())).status,'STORED');assert.equal((await createPersistentCollector(db,options).capture(input('next'))).status,'BUDGET_DENIED');assert.equal(query('SELECT used_records FROM ft_replay_budget_v1').row.used_records,1);});
 let costs;
 await test('exact retry measured with persistent budget',async()=>{reset();const c=createPersistentCollector(db,options),start=sqlCalls;assert.equal((await c.capture(input())).status,'STORED');const afterFirst=sqlCalls;assert.equal((await c.capture(input())).status,'DUPLICATE');costs={new_record:afterFirst-start,exact_retry:sqlCalls-afterFirst};assert.deepEqual(costs,{new_record:4,exact_retry:2});assert.equal(query('SELECT count(*) AS n FROM ft_replay_records_v1').row.n,1);});
 await test('byte exhaustion denies before ledger',async()=>{reset(2,1);assert.equal((await createPersistentCollector(db,options).capture(input())).status,'BUDGET_DENIED');assert.equal(query('SELECT used_records FROM ft_replay_budget_v1').row.used_records,0);});
 await test('invalid or future input costs no SQL',async()=>{const n=sqlCalls;const c=createPersistentCollector(db,options);assert.equal((await c.capture(null)).status,'INVALID_RECORD');assert.equal((await c.capture({...input(),decision_at:2001})).status,'INVALID_CLOCK');assert.equal(sqlCalls,n);});
 await test('expired window does not auto renew',async()=>{reset();assert.equal((await createPersistentCollector(db,{...options,clock:()=>3000}).capture(input())).status,'BUDGET_DENIED');});
 await test('clock rollback cannot reuse window',async()=>{reset();await createPersistentCollector(db,options).capture(input());assert.equal((await createPersistentCollector(db,{...options,clock:()=>1999}).capture(input('b'))).status,'BUDGET_DENIED');});
 await test('crash after reservation keeps budget spent',async()=>{reset(1);assert.ok(query(RESERVE_SQL,[100,2000]).row);assert.equal((await createPersistentCollector(db,options).capture(input())).status,'BUDGET_DENIED');});
 await test('database failure prevents ledger use',async()=>{let calls=0;const broken={prepare(){calls++;throw Error('offline');}};assert.equal((await createPersistentCollector(broken,options).capture(input())).status,'BUDGET_UNAVAILABLE');assert.equal(calls,1);});
 await test('ledger failure does not refund reservation',async()=>{reset(1);const broken={prepare(sql){if(sql!==RESERVE_SQL)throw Error('ledger offline');return db.prepare(sql);}};assert.equal((await createPersistentCollector(broken,options).capture(input())).status,'RECORD_FAILED');assert.equal((await createPersistentCollector(db,options).capture(input())).status,'BUDGET_DENIED');});
 await test('concurrent independent SQLite writers share cap',async()=>{
  reset(3,300);
  const script="import sqlite3,sys; d=sqlite3.connect(sys.argv[1],timeout=30); r=d.execute(sys.argv[2],(100,2000)).fetchone(); d.commit(); print(1 if r else 0); d.close()";
  const exec=promisify(execFile);
  const r=await Promise.all(Array.from({length:12},()=>exec('python3',['-c',script,path,RESERVE_SQL])));
  assert.equal(r.reduce((n,x)=>n+Number(x.stdout.trim()),0),3);
  const used=query('SELECT used_records,used_bytes FROM ft_replay_budget_v1').row;
  assert.deepEqual(used,{used_records:3,used_bytes:300});
 });
 mkdirSync('ft-audit-output',{recursive:true});
 writeFileSync('ft-audit-output/persistent-budget-tests.json',JSON.stringify({status:'PASS',checks,backend:'local SQLite via D1-shaped adapter',costs,production_writes:0,limitations:['not remote D1','no Worker hooks','rejected reservations still execute SQL','explicit window provisioning required']},null,2));
}finally{rmSync(dir,{recursive:true,force:true});}
