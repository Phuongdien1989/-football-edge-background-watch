import vm from 'node:vm';import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';import {createRequire} from 'node:module';import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
let schemaPath=new URL('../../schema_v1231.sql',import.meta.url).pathname;try{await fs.access(schemaPath)}catch{schemaPath=new URL('../../fe-sync-production/schema_v1231.sql',import.meta.url).pathname}
const root=new URL('../worker/',import.meta.url),ctx=vm.createContext({console,Request,Response,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,AbortController,AbortSignal,crypto:webcrypto,setTimeout,clearTimeout,btoa,atob,Buffer,fetch:()=>{throw Error('NETWORK_FORBIDDEN')},process:{env:{}}}),cache=new Map();
const cf=new vm.SyntheticModule(['DurableObject'],function(){this.setExport('DurableObject',class{constructor(ctx,env){this.ctx=ctx;this.env=env}})},{context:ctx}),nm=new vm.SyntheticModule(['createRequire'],function(){this.setExport('createRequire',createRequire)},{context:ctx});
async function mod(file){if(!cache.has(file))cache.set(file,fs.readFile(file,'utf8').then(s=>new vm.SourceTextModule(s,{context:ctx,identifier:file})));return cache.get(file)}
const m=await mod(new URL('worker_notify_v139_accuracy.js',root).pathname);await m.link((s,p)=>s==='cloudflare:workers'?cf:s==='node:module'?nm:mod(path.resolve(path.dirname(p.identifier),s)));await m.evaluate();const W=m.namespace.BackgroundWatcher,core=(await mod(new URL('accuracy-core.js',root).pathname)).namespace;
let n=0;function eq(a,b){assert.deepEqual(JSON.parse(JSON.stringify(a)),b);n++}
for(const x of [null,undefined,'',NaN,true,false])eq(core.number(x),null);eq(core.number(0),0);
const now=Date.now(),v={gap_signed:73,threshold:70};
for(const last of [{gap:null,at:now},{gap:0,at:now,reason:'STATS_UNAVAILABLE'},{gap:0,at:now,sourceHealth:{stats:'EMPTY'}},{gap:73,at:now-150001},{gap:73,at:now+1}])eq(core.gapCheck(v,last,now).pending,true);
for(const [gap,result]of [[0,'NEUTRALIZED'],[-73,'FLIPPED'],[73,'SAME_ABOVE_THRESHOLD'],[41,'SAME_BELOW_THRESHOLD']])eq(core.gapCheck(v,{gap,at:now,sourceHealth:{stats:'OK'}},now).result,result);
const f={fixture:{id:1,status:{short:'FT',elapsed:90}},goals:{home:1,away:0},score:{halftime:{home:0,away:0},fulltime:{home:1,away:0}}},events=[{type:'Goal',detail:'Normal Goal',time:{elapsed:90,extra:5}}];
eq(core.goalPeriod({engine:'FT',minute:70,score_home:0,score_away:0},f,events).result,'HIT');
eq(core.goalPeriod({engine:'H1',minute:30,score_home:0,score_away:0},f,events).result,'MISS');
const addedHT={...f,score:{...f.score,halftime:{home:1,away:0}}};
eq(core.goalPeriod({engine:'H1',minute:45,score_home:0,score_away:0},addedHT,[{...events[0],time:{elapsed:45,extra:5}}]).result,'HIT');
eq(core.goalPeriod({engine:'FT',minute:70,score_home:null,score_away:0},f,events).pending,true);
eq(core.goalPeriod({engine:'FT',minute:70,score_home:0,score_away:0},f,[]).reason,'FINAL_LEDGER_MISMATCH');
eq(core.goalPeriod({engine:'FT',minute:70,score_home:0,score_away:0},{...f,fixture:{status:{short:'CANC'}}},[]).result,'VOID');
eq(core.goalPeriod({engine:'FT',minute:70,score_home:0,score_away:0},{...f,fixture:{status:{short:'2H'}}},events).pending,true);
eq(core.goalPeriod({engine:'FT',minute:70,score_home:0,score_away:0},f,[{...events[0],time:{elapsed:60}}]).reason,'BASELINE_LEDGER_AMBIGUITY');
const entry={engine:'FT',market_type:'OU_FT',auto_settle_supported:1,selection:'OVER',line:1,price:2,odds_format:'DEC'};
for(const [line,result,pl]of [[.5,'WIN',1],[.75,'HALF_WIN',.5],[1,'PUSH',0],[1.25,'HALF_LOSE',-.5],[1.5,'LOSE',-1]]){const o=core.settlePaper({...entry,line},f);eq(o.result,result);eq(o.unit_pl,pl)}
eq(core.settlePaper({...entry,line:1.25,selection:'UNDER'},f).result,'HALF_WIN');
eq(core.settlePaper({...entry,line:0,engine:'H1',market_type:'OU_H1'},f).result,'PUSH');
for(const patch of [{price:null},{line:null},{line:.3},{odds_format:'HK'},{selection:'HOME'},{engine:'HC'},{market_type:'OU_H2'}])eq(core.settlePaper({...entry,...patch},f).unsupported,true);
const map=new Map(),storage={get:async k=>map.get(k),put:async(k,v)=>map.set(k,structuredClone(v)),list:async({prefix})=>new Map([...map].filter(([k])=>k.startsWith(prefix))),delete:async k=>map.delete(k)};
const inserted=new Map(),db={prepare(sql){return {bind(...args){return {async run(){if(sql.startsWith('INSERT')&&!inserted.has(args[0]))inserted.set(args[0],JSON.parse(args[5]));return {}}}},async all(){return {results:[]}}}}};
const w=new W({storage},{FOOTBALL_DB:db,BACKGROUND_TOKEN:'test'});
await w.captureMeasurement({fixture_id:1,created_at:now,body:"H-A | 70' | 0-0",signals:{goal:{value:73,threshold:70},gap:{value:73,actual:'+73 HOME'}}});
await w.captureMeasurement({fixture_id:1,created_at:now,body:"H-A | 70' | 0-0",signals:{goal:{value:73,threshold:75}}});
eq(inserted.size,2);eq(inserted.get(`AC-1-${now}-goal-73-na`).signal_value,73);eq(inserted.get(`AC-1-${now}-gap-73-na`).result_key,'OBSERVATION_ONLY');
await w.captureMeasurement({fixture_id:1,created_at:now,signals:{goal:{value:80,threshold:75}}});eq(inserted.size,3);
map.set('notify:match:1',{last:{gap:null,at:now,reason:'STATS_UNAVAILABLE'}});w.deferValidation=async(k,v,reason)=>({pending:true,reason});w.finishValidation=async(k,v,result)=>({result});
eq((await w.resolveGapValidation('k',{...v,fixture_id:1})).pending,true);
eq((await w.fetch(new Request('https://test/api/notify/accuracy'))).status,401);
eq((await w.fetch(new Request('https://test/api/notify/accuracy',{method:'POST',headers:{authorization:'Bearer test'}}))).status,405);
// Execute actual entry SQL against SQLite, including duplicate/reopened/mutated cases.
const src=await fs.readFile(new URL('worker.js',root),'utf8'),sandbox={};vm.createContext(sandbox);
vm.runInContext("function n(v,d=null){return Number.isFinite(Number(v))?Number(v):d};function cleanStr(v,max=120){return v==null?null:String(v).slice(0,max)};function dbJson(v){return JSON.stringify(v)};"+src.slice(src.indexOf('function dbEntryStmt('),src.indexOf('function dbLiveStmt('))+';globalThis.entry=dbEntryStmt;globalThis.outcome=dbEntryOutcomeStmt;',sandbox);
const sqlEnv={FOOTBALL_DB:{prepare(sql){return {bind(...args){return {sql,args}}}}}};
const p={...entry,id:'e1',fixture_id:1,policy_status:'CAUTION',captured_at:now,entry_score:{home:0,away:0},resolution:'OPEN',model_prob:null};
const resolved={...p,resolution:'RESOLVED',outcome:'WIN',unit_pl:1,resolved_at:now,final_score:{home:2,away:0}};
const ops=[sandbox.entry(sqlEnv,p,now),sandbox.entry(sqlEnv,{...p,line:9,price:9,policy_status:'SUITABLE'},now),sandbox.entry(sqlEnv,resolved,now),sandbox.outcome(sqlEnv,resolved,now),sandbox.entry(sqlEnv,p,now),sandbox.outcome(sqlEnv,{...resolved,unit_pl:-1,outcome:'LOSE',line:9},now)];
const py=spawnSync('python3',['-c',`import sqlite3,json,sys
c=sqlite3.connect(':memory:')
c.executescript(open(sys.argv[1]).read())
c.execute('insert into fixtures(fixture_id,first_seen_at,last_seen_at) values(1,1,1)')
ops=json.load(sys.stdin)
for o in ops:c.execute(o['sql'],o['args'])
c.row_factory=sqlite3.Row
r=dict(c.execute('select * from entry_decisions').fetchone())
assert r['line']==1 and r['price']==2 and r['policy_status']=='CAUTION' and r['resolution']=='RESOLVED' and r['model_prob'] is None,r
o=dict(c.execute('select * from entry_outcomes').fetchone())
assert o['outcome']=='WIN' and o['unit_pl']==1,o
assert json.loads(r['payload_json'])['resolution']=='OPEN'
print('PASS real SQLite immutable entry, genuine NULL, stale OPEN replay and outcome protection')
`,schemaPath],{input:JSON.stringify(ops),encoding:'utf8'});assert.equal(py.status,0,py.stderr);console.log(py.stdout.trim());
// Run actual follow-up, migration, scheduler, transactions and report against SQLite.
const sqlite=new DatabaseSync(':memory:');sqlite.exec(await fs.readFile(schemaPath,'utf8'));sqlite.exec('INSERT INTO fixtures(fixture_id,first_seen_at,last_seen_at) VALUES(1,1,1)');
const d1={prepare(sql){const stmt=sqlite.prepare(sql);return {async all(){return {results:stmt.all()}},bind(...args){return {sql,args,async all(){return {results:stmt.all(...args)}},async run(){return stmt.run(...args)}}}}},async batch(stmts){sqlite.exec('BEGIN');try{for(const s of stmts)sqlite.prepare(s.sql).run(...s.args);sqlite.exec('COMMIT')}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const liveWatcher=new W({storage},{FOOTBALL_DB:d1,BACKGROUND_TOKEN:'test'}),calls=[];
liveWatcher.validationApi=async(endpoint,params)=>{calls.push({endpoint,params});return endpoint==='/fixtures'?[f]:events};
const initial=sandbox.entry({FOOTBALL_DB:d1},p,now);await initial.run();
await liveWatcher.captureMeasurement({fixture_id:1,created_at:now-3600000,body:"H-A | 70' | 0-0",signals:{goal:{value:73}}});
await liveWatcher.accuracyTick();
eq(sqlite.prepare("SELECT result_key FROM validation_results WHERE validation_type='ACCURACY_FT_PERIOD'").get().result_key,'HIT');
eq(sqlite.prepare("SELECT resolution FROM entry_decisions WHERE id='e1'").get().resolution,'RESOLVED');
eq(sqlite.prepare('SELECT COUNT(*) n FROM entry_outcomes').get().n,1);eq(calls.length,2);
await liveWatcher.accuracyTick();eq(calls.length,2);
const summary=await liveWatcher.accuracySummary();eq(summary.engine_changed,false);eq(summary.paper[0].policy_status,'CAUTION');
const stale=sandbox.entry({FOOTBALL_DB:d1},p,now);await stale.run();eq(sqlite.prepare("SELECT resolution FROM entry_decisions WHERE id='e1'").get().resolution,'RESOLVED');
// Real provider parser must throw on HTTP-200 rate-limit errors, not return [].
const strictWatcher=new W({storage},{APISPORTS_KEY:'fake-test-key',VALIDATION_DAILY_BUDGET:100,API_TOTAL_DAILY_BUDGET:10000});
ctx.fetch=async()=>new Response(JSON.stringify({errors:{requests:'RATE_LIMIT'},response:[]}),{status:200});
await assert.rejects(()=>strictWatcher.validationApi('/fixtures',{id:1}),/EVIDENCE_PROVIDER_ERROR/);n++;
ctx.fetch=async()=>new Response(JSON.stringify({errors:[],response:[]}),{status:200});eq(await strictWatcher.validationApi('/fixtures',{id:1}),[]);
const limited=new W({storage},{APISPORTS_KEY:'fake-test-key',VALIDATION_DAILY_BUDGET:1});await assert.rejects(()=>limited.validationApi('/fixtures',{id:1}),/VALIDATION_DAILY_BUDGET_REACHED/);n++;
ctx.fetch=()=>{throw Error('NETWORK_FORBIDDEN')};
// Live period queues cannot monopolize all fixture slots when paper settlement is due.
for(const id of [2,3,4])sqlite.prepare('INSERT INTO fixtures(fixture_id,first_seen_at,last_seen_at) VALUES(?,?,?)').run(id,1,1);
const e4={...p,id:'e4',fixture_id:4};await sandbox.entry({FOOTBALL_DB:d1},e4,now).run();
for(const id of [1,2,3])await liveWatcher.captureMeasurement({fixture_id:id,created_at:now,body:"H-A | 70' | 0-0",signals:{goal:{value:73}}});
map.delete('accuracy:last-tick');map.delete('accuracy:entries-at');calls.length=0;
await liveWatcher.accuracyTick();eq(calls.some(x=>x.params.id===4),true);eq(sqlite.prepare("SELECT resolution FROM entry_decisions WHERE id='e4'").get().resolution,'RESOLVED');
// Transient provider failure preserves PENDING and advances retry instead of losing history.
await liveWatcher.captureMeasurement({fixture_id:2,created_at:now-3*86400000,body:"H-A | 70' | 0-0",signals:{goal:{value:74}}});
map.delete('accuracy:last-tick');liveWatcher.validationApi=async()=>{throw Error('EVIDENCE_PROVIDER_ERROR')};await liveWatcher.accuracyTick();
const retry=sqlite.prepare("SELECT result_key,payload_json FROM validation_results WHERE id=?").get(`AC-2-${now-3*86400000}-goal-74-na`);
eq(retry.result_key,'PENDING');eq(JSON.parse(retry.payload_json).last_provider_error,'EVIDENCE_PROVIDER_ERROR');eq(JSON.parse(retry.payload_json).due_at>now,true);
await liveWatcher.measurementWrite({id:'old-unknown',fixture_id:1,validation_type:'ACCURACY_FT_PERIOD',engine:'FT',signal_at:now-3*86400000,minute:70,score_home:0,score_away:0,result_key:'UNKNOWN',reason:'FIXTURE_UNAVAILABLE'});
map.delete('accuracy:strict-recheck-done');map.delete('accuracy:last-tick');liveWatcher.validationApi=async(endpoint)=>endpoint==='/fixtures'?[f]:events;await liveWatcher.accuracyTick();
eq(sqlite.prepare("SELECT result_key FROM validation_results WHERE id='old-unknown'").get().result_key,'UNKNOWN');
eq(sqlite.prepare("SELECT result_key FROM validation_results WHERE id='old-unknown-RECHECK'").get().result_key,'HIT');
eq((await liveWatcher.accuracySummary()).periods.some(x=>x.result_key==='UNKNOWN'),false);
sqlite.close();
console.log('PASS accuracy '+n+' assertions; real worker chain and SQL; no external network');
