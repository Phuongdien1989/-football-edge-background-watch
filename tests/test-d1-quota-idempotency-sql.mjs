// Independent SQLite execution checks. SQLite changed rows != D1 meta.rows_written:
// Cloudflare counts secondary-index writes; production metrics still required.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const db=new DatabaseSync(':memory:');
db.exec(read('schema_v1231.sql'));db.exec(read('schema_v1233_history.sql'));
let changes=0;
const D1={prepare(sql){let args=[];return {bind(...v){args=v;return this},async run(){const r=db.prepare(sql).run(...args);changes+=Number(r.changes||0);return {meta:{rows_written:Number(r.changes||0)}}},async all(){return {results:db.prepare(sql).all(...args)}},async first(){return db.prepare(sql).get(...args)||null}}},async batch(stmts){for(const s of stmts)await s.run();return []}};
const env={FOOTBALL_DB:D1};const diff=()=>{const n=changes;changes=0;return n};
const ctx={Number,String,Math,Date,JSON,Set,Error,Response,URL,Request,Map,console,
 n:(v,d=null)=>Number.isFinite(Number(v))?Number(v):d,
 cleanStr:(v,max=120)=>v==null?null:String(v).slice(0,max)};
function extract(file,start,end,fn){const s=read(file),a=s.indexOf(start),b=s.indexOf(end,a);assert.ok(a>=0&&b>a);return vm.runInNewContext(s.slice(a,b)+'\n'+fn,{...ctx})}
const history=extract('worker_v123.js','const WORKER_VERSION','async function callBase','writeHistory');
const evidence=extract('worker_v122.js','const WORKER_VERSION','async function rows','writeEvidence');
const sync=extract('worker.js','function dbConfigured','async function dbRows','dbWriteEvents');
const ev=(type,payload)=>({type,payload});
const catalog=(status='1H',minute=24)=>({fixture_id:1234567,home_team_id:15,away_team_id:16,home:'Home',away:'Away',league_id:9,league:'League',season:2026,status,minute,score_home:0,score_away:0});
await history(env,[ev('FIXTURE_CATALOG',catalog())]);assert.equal(diff(),5,'first catalog has 5 rows');
await history(env,[ev('FIXTURE_CATALOG',catalog())]);assert.equal(diff(),0,'identical catalog retry');
await history(env,[ev('FIXTURE_CATALOG',catalog('2H',66))]);assert.ok(diff()>0,'new history update');
assert.equal(db.prepare('SELECT status FROM fixture_history WHERE fixture_id=1234567').get().status,'2H');
const q={id:'Q-1',fixture_id:1234567,engine:'FT',outcome:'PENDING',captured_at:1000};
await evidence(env,[ev('QSIG_RESULT',q)]);assert.ok(diff()>0);
await evidence(env,[ev('QSIG_RESULT',q)]);assert.equal(diff(),0,'QSIG replay');
await evidence(env,[ev('QSIG_RESULT',{...q,outcome:'HIT'})]);assert.ok(diff()>0,'QSIG settlement');
const v={id:'V-1',fixture_id:1234567,source:'AUTO',captured_at:1200,outcome:'PENDING'};
await evidence(env,[ev('VALIDATION_RESULT',v)]);assert.ok(diff()>0);
await evidence(env,[ev('VALIDATION_RESULT',v)]);assert.equal(diff(),0,'validation replay');
await evidence(env,[ev('VALIDATION_RESULT',{...v,outcome:'MISS'})]);assert.ok(diff()>0,'validation settlement');
const entry={id:'E-1',fixture_id:1234567,engine:'FT',captured_at:1250,policy_status:'WATCH',resolution:'PENDING'};
await sync(env,[ev('ENTRY_DECISION',entry)]);assert.ok(diff()>0);
await sync(env,[ev('ENTRY_DECISION',entry)]);assert.equal(diff(),0,'entry replay');
await sync(env,[ev('ENTRY_DECISION',{...entry,policy_status:'ENTER',resolution:'RESOLVED',resolved_at:1400,outcome:'HIT'})]);assert.ok(diff()>0);
assert.equal(db.prepare("SELECT outcome FROM entry_outcomes WHERE decision_id='E-1'").get().outcome,'HIT');
const snap={id:'L-1',fixture_id:1234567,source:'APP',captured_at:1400,minute:25,status:'1H'};
await sync(env,[ev('LIVE_SNAPSHOT',snap)]);assert.ok(diff()>0);
await sync(env,[ev('LIVE_SNAPSHOT',snap)]);assert.equal(diff(),0,'snapshot replay');
await sync(env,[ev('LIVE_SNAPSHOT',{...snap,minute:26})]);assert.ok(diff()>0,'fresh snapshot');
await sync(env,[ev('IGNORED',{fixture_id:1234567})]);assert.equal(diff(),0,'ignored event cannot write fixture');
db.exec('CREATE TABLE fe_notify_live_state(fixture_id INTEGER PRIMARY KEY,payload TEXT NOT NULL,updated_at INTEGER NOT NULL)');
const source=read('worker_notify_v137_quota50000.js'),a=source.indexOf('  d1LiveEnabled(){'),b=source.indexOf('  async reserveApiCall(){',a);
assert.ok(a>0&&b>a);
const methods=source.slice(a,b).replace(/\}\n  async /g,'},\n  async ');
const fallback=new Map(),store={async list(){return new Map([...fallback].filter(([k])=>k.startsWith('notify:match:')))},async get(k){return fallback.get(k)},async put(k,v){fallback.set(k,v)},async delete(k){fallback.delete(k)}};
const watcher=enabled=>{const o=vm.runInNewContext('({'+methods+'})',{...ctx});o.env={LIVE_STATE_D1_ENABLED:String(enabled),FOOTBALL_DB:D1};o.ctx={storage:store};return o};
let w=watcher(true);const item={id:1234567,history:[{minute:24}],alerts:{'d:h1':{armed:false,lastSent:111}}};
await w.putNotifyMatch(1234567,item);assert.ok(diff()>=1);
await w.putNotifyMatch(1234567,item);assert.equal(diff(),0,'LIVE retry');
w=watcher(true);assert.deepEqual(JSON.parse(JSON.stringify(await w.getNotifyMatch(1234567))),item,'restart preserves signal dedup');
await w.putNotifyMatch(1234567,{...item,history:[...item.history,{minute:25}]});assert.equal(diff(),1,'LIVE update');
await w.deleteNotifyMatch(1234567);assert.equal(diff(),1);
await w.deleteNotifyMatch(1234567);assert.equal(diff(),0,'tombstone replay');
assert.equal(await watcher(true).getNotifyMatch(1234567),null,'no resurrection');
await watcher(false).putNotifyMatch(777,{id:777});assert.equal(diff(),0,'D1 OFF fallback');
console.log('PASS: SQL history/evidence/validation/entry/live/ignored-event replay+change, ON/OFF, restart, tombstone');
