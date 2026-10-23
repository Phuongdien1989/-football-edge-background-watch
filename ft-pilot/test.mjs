import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createFTPilotRecorder,buildFTPilotInput} from './recorder.mjs';
let tests=0;
async function test(title,fn){await fn();tests++;console.log('PASS '+title)}
const epoch='PILOT-20261023-ONLY',logic='e'.repeat(64),now=Date.UTC(2026,9,23,9,0);
const dir=mkdtempSync(join(tmpdir(),'ft-pilot-')),dbPath=join(dir,'pilot.sqlite');
function runSQL(sql,params=[],method='all'){
 const x=spawnSync('python3',['ft-pilot/sqlite-local.py'],{
  input:JSON.stringify({db:dbPath,sql,params,method}),encoding:'utf8'});
 if(x.status!==0)throw Error('LOCAL_SQLITE_ERROR '+x.stdout+' '+x.stderr);
 return JSON.parse(x.stdout);
}
const py=spawnSync('python3',['-c',
 `import sqlite3,sys
db=sqlite3.connect(sys.argv[1])
db.executescript(open('ft-pilot/schema-candidate.sql').read())
db.execute("INSERT INTO ft_pilot_control_v1(epoch,enabled,capture_start_ms,capture_end_ms,outcome_end_ms,max_fixtures,max_pair_bytes,max_total_pair_bytes,max_revisions_per_fixture) VALUES (?,?,?,?,?,?,?,?,?)", (${JSON.stringify(epoch)},1,${now-3600000},${now+4*3600000},${now+72*3600000},5,20000,100000,2))
db.commit()
`,dbPath],{encoding:'utf8'});
if(py.status!==0)throw Error(py.stderr);
const makeDB=()=>({prepare(sql){
 return {bind(...params){return {
  all:async()=>runSQL(sql,params,'all'),
  run:async()=>runSQL(sql,params,'run')
 };}};
}});
const env={FT_PILOT_ENABLED:'true',FT_PILOT_EPOCH:epoch,FT_PILOT_LOGIC_VERSION:logic};
let ms=now;
const rec=(e=env,opts={})=>createFTPilotRecorder({env:e,db:opts.db||makeDB(),
 clock:()=>ms,nowHighRes:()=>1,audit:opts.audit||(()=>{}),durablePause:opts.durablePause||null});
function scan(id,crossingRequested=false,overrides={}){
 const capture=now-30000;
 const fixture={fixture:{id,status:{short:'2H',elapsed:67}},league:{name:'Pilot Local QA'},
  teams:{home:{name:'Home '+id},away:{name:'Away '+id}},
  goals:{home:1,away:0},score:{fulltime:null}};
 return {capturedAt:capture,fixtureReceivedAt:capture-1000,fixture,
  health:{stats:'OK',events:'EMPTY',odds:'OK',half:'EMPTY'},
  receipts:{stats:capture-850,events:capture-840,odds:capture-830,half:capture-820},
  payloads:{stats:[{team:{id:1},statistics:[{type:'Shots on Goal',value:4}]},
   {team:{id:2},statistics:[{type:'Shots on Goal',value:1}]}],
   events:[],odds:[{fixture:{id},odds:[{id:5,name:'Over/Under',values:[
    {value:'Over',handicap:2.75,odd:1.92},{value:'Under',handicap:2.75,odd:1.94}]}]}],half:[]},
  crossingRequested,
  decision:{state:'EVALUATED',decision_at:capture+500,evaluation:{score:51,scoreMode:'FULL'},
   market_rows:[],devices:[{crossing_requested:crossingRequested}]},
  ...overrides};
}
function ftResult(id,h=2,a=1,status='FT'){
 return {fixture:{id,status:{short:status,elapsed:90}},score:{fulltime:{home:h,away:a}},
 goals:{home:h,away:a}};
}
const count=table=>runSQL('SELECT COUNT(*) as n FROM '+table).results[0].n;
await test('default OFF never reads D1 or initiates API',async()=>{
 let touched=0;
 const o=rec({...env,FT_PILOT_ENABLED:'false'},{db:{prepare(){touched++;throw Error('must not query')}}});
 assert.equal((await o.capture(scan(1))).status,'DISABLED');assert.equal(touched,0);
 assert.equal((await o.outcome(ftResult(1),now-1000)).status,'DISABLED');
});
await test('pair input includes existing receipts, source null/missing reason, score, pinned logic',()=>{
 const v=buildFTPilotInput(scan(111,false,{health:{stats:'ERROR',events:'EMPTY',odds:'EMPTY',half:'INVALID'}}),
  {epoch,logicVersion:logic});
 assert.equal(v.status,'READY');
 assert.equal(v.observation.sources.statistics.data,null);
 assert.equal(v.observation.sources.odds.status,'EMPTY');
 assert.equal(v.observation.missing_reasons.statistics,'PROVIDER_READ_ERROR');
 assert.equal(v.observation.model_version,logic);
 assert.equal(v.decision.source_hash,logic);
});
await test('one truly atomic PAIR row saved, with raw bookmaker odds and immutable hashes',async()=>{
 const o=rec();
 const r=await o.capture(scan(1,true));
 assert.equal(r.status,'PAIR_STORED');assert.equal(count('ft_pilot_pairs_v1'),1);
 const row=runSQL('SELECT observation_json,decision_json,class,pair_bytes FROM ft_pilot_pairs_v1').results[0];
 const a=JSON.parse(row.observation_json),b=JSON.parse(row.decision_json);
 assert.equal(a.sources.odds.data[0].odds[0].values[0].odd,1.92);
 assert.equal(b.observation_id,a.id);
 assert.equal(row.class,'RECOMMENDATION_CANDIDATE');
 assert(row.pair_bytes>0&&row.pair_bytes<=20000);
});
await test('stratum cap reserves room for both recommendation and nonrecommended fixture classes',async()=>{
 const secondEpoch='PILOT-CLASS-BALANCE-CHECK';
 runSQL('INSERT INTO ft_pilot_control_v1(epoch,enabled,capture_start_ms,capture_end_ms,outcome_end_ms,max_fixtures,max_pair_bytes,max_total_pair_bytes,max_revisions_per_fixture) VALUES (?,?,?,?,?,?,?,?,?)',
  [secondEpoch,1,now-3600000,now+3600000,now+72*3600000,5,20000,100000,2],'run');
 const e={...env,FT_PILOT_EPOCH:secondEpoch};
 for(const id of [801,802,803])assert.equal((await rec(e).capture(scan(id,false))).status,'PAIR_STORED');
 assert.equal((await rec(e).capture(scan(804,false))).status,'SKIPPED_BALANCED_CLASS_CAP');
 for(const id of [805,806])assert.equal((await rec(e).capture(scan(id,true))).status,'PAIR_STORED');
 assert.equal(runSQL('SELECT COUNT(*) n FROM ft_pilot_pairs_v1 WHERE epoch=?',[secondEpoch]).results[0].n,5);
});
await test('same fixture after restart never overwrites original pair or consumes slot',async()=>{
 const before=runSQL('SELECT observation_json,content_hash FROM ft_pilot_pairs_v1 WHERE fixture_id=1').results[0];
 assert.equal((await rec().capture(scan(1,false,{capturedAt:now-10000}))).status,'SKIPPED_EXISTING_FIXTURE');
 const after=runSQL('SELECT observation_json,content_hash FROM ft_pilot_pairs_v1 WHERE fixture_id=1').results[0];
 assert.deepEqual(after,before);assert.equal(count('ft_pilot_pairs_v1'),1);
});
await test('diverse recommendation and not-recommended classes admitted',async()=>{
 for(const [id,c] of [[2,false],[3,true],[4,false],[5,false]]){
  const r=await rec().capture(scan(id,c));assert.equal(r.status,'PAIR_STORED');
 }
 assert.equal(count('ft_pilot_pairs_v1'),5);
 const c=runSQL('SELECT class,COUNT(*) as n FROM ft_pilot_pairs_v1 GROUP BY class').results;
 assert.deepEqual(Object.fromEntries(c.map(x=>[x.class,x.n])),
  {NOT_RECOMMENDED:3,RECOMMENDATION_CANDIDATE:2});
});
await test('6th distinct fixture denied across restarted SQLite connections',async()=>{
 const r=await rec().capture(scan(6,true));
 assert.equal(r.status,'SKIPPED_FIVE_FIXTURE_CAP');
 assert.equal(count('ft_pilot_pairs_v1'),5);
});
await test('missing result remains pending and does not write Outcome',async()=>{
 const r=await rec().outcome({...ftResult(1),fixture:{id:1,status:{short:'2H'}}},now-1000);
 assert.equal(r.status,'PENDING');assert.equal(count('ft_pilot_outcomes_v1'),0);
});
await test('outcome for an unselected fixture cannot create a row',async()=>{
 assert.equal((await rec().outcome(ftResult(6),now-1000)).status,'OUTCOME_NO_SELECTED_PAIR');
 assert.equal(count('ft_pilot_outcomes_v1'),0);
});
await test('mismatched fixture payload and status never create result',async()=>{
 assert.equal((await rec().outcome(ftResult(6),now-1000)).status,'OUTCOME_NO_SELECTED_PAIR');
 const r=await rec().outcome({...ftResult(1),score:{fulltime:{home:null,away:1}}},now-1000);
 assert.equal(r.status,'PENDING');
});
await test('FT terminal from already supplied fixture saves regulation score',async()=>{
 const r=await rec().outcome(ftResult(1),now-1000);
 assert.equal(r.status,'OUTCOME_STORED');assert.equal(count('ft_pilot_outcomes_v1'),1);
 const result=runSQL('SELECT outcome_json FROM ft_pilot_outcomes_v1').results[0];
 assert.equal(JSON.parse(result.outcome_json).settlement_basis,'FULL_MATCH_REGULATION');
});
await test('same final score on next existing API callback is a zero-write duplicate',async()=>{
 const r=await rec().outcome(ftResult(1),now-500);
 assert.equal(r.status,'OUTCOME_ALREADY_RECORDED');
 assert.equal(count('ft_pilot_outcomes_v1'),1);
});
await test('corrected score appends a new version, retaining old immutable history',async()=>{
 const r=await rec().outcome(ftResult(1,3,1),now-400);
 assert.equal(r.status,'OUTCOME_CORRECTION_APPENDED');
 const q=runSQL('SELECT score_home FROM ft_pilot_outcomes_v1 WHERE fixture_id=1 ORDER BY observed_at').results;
 assert.deepEqual(q.map(x=>x.score_home),[2,3]);
});
await test('third conflicting correction does not overwrite or append',async()=>{
 const r=await rec().outcome(ftResult(1,4,1),now-300);
 assert.equal(r.status,'OUTCOME_REVISION_LIMIT');assert.equal(count('ft_pilot_outcomes_v1'),2);
});
await test('nonregulation game canceled has no scored outcome',async()=>{
 const r=await rec().outcome(ftResult(2,2,1,'CANC'),now-1000);
 assert.equal(r.status,'UNSETTLED');assert.equal(count('ft_pilot_outcomes_v1'),2);
});
await test('AET with fulltime regulation score can store confirmed 90 minute result',async()=>{
 const r=await rec().outcome({...ftResult(2,1,0,'AET'),goals:{home:3,away:1}},now-1000);
 assert.equal(r.status,'OUTCOME_STORED');assert.equal(count('ft_pilot_outcomes_v1'),3);
});
await test('stale outside capture window denies new fixture without resetting stored rows',async()=>{
 ms=now+5*3600000;
 const r=await rec().capture(scan(7));assert.equal(r.status,'SKIPPED_CAPTURE_WINDOW_CLOSED');
 ms=now;assert.equal(count('ft_pilot_pairs_v1'),5);
});
await test('manual OFF in D1 control blocks new outcome while preserving all evidence',async()=>{
 runSQL('UPDATE ft_pilot_control_v1 SET enabled=0 WHERE epoch=?',[epoch],'run');
 const r=await rec().outcome(ftResult(3),now-1000);
 assert.equal(r.status,'OUTCOME_WRITE_DENIED');
 assert.equal(count('ft_pilot_pairs_v1'),5);
 runSQL('UPDATE ft_pilot_control_v1 SET enabled=1 WHERE epoch=?',[epoch],'run');
});
await test('immutable pair UPDATE and DELETE triggers reject rewriting history',()=>{
 assert.throws(()=>runSQL("UPDATE ft_pilot_pairs_v1 SET content_hash=? WHERE fixture_id=1",['f'.repeat(64)],'run'),/LOCAL_SQLITE_ERROR/);
 assert.throws(()=>runSQL('DELETE FROM ft_pilot_pairs_v1 WHERE fixture_id=1',[],'run'),/LOCAL_SQLITE_ERROR/);
});
await test('immutable outcome UPDATE and DELETE triggers reject rewriting final labels',()=>{
 assert.throws(()=>runSQL('UPDATE ft_pilot_outcomes_v1 SET score_home=99',[],'run'),/LOCAL_SQLITE_ERROR/);
 assert.throws(()=>runSQL('DELETE FROM ft_pilot_outcomes_v1',[],'run'),/LOCAL_SQLITE_ERROR/);
});
await test('forced D1 error stops ONLY FT and durable pause is requested',async()=>{
 const events=[];
 const o=rec(env,{db:{prepare(){throw Error('D1 quota exceeded')}},durablePause:async x=>events.push(x)});
 assert.equal((await o.capture(scan(1001))).status,'D1_ERROR_PAUSED');
 assert.equal(o.paused(),true);
 assert.equal((await o.capture(scan(1002))).status,'FT_PILOT_PAUSED');
 assert.equal(events.length,1);
});
await test('invalid source cannot touch database and does not promote eligibility',async()=>{
 const o=rec();const before=o.sqlUsed();
 const r=await o.capture(scan(3001,false,{fixtureReceivedAt:now+40000}));
 assert.equal(r.status,'INVALID_SOURCE_CLOCK');assert.equal(o.sqlUsed(),before);
});
await test('SQL query cap stops FT and does not modify other mechanisms',async()=>{
 const frozen=Object.freeze({HT:{score:74,history:[1,2],cooldown:123,pricing:2.1,TOP:1,push:true},
  HC:{score:68,history:[2,3],cooldown:456,pricing:1.88,TOP:2,push:false}});
 const before=JSON.stringify(frozen);const o=rec(env);await o.capture(scan(1));
 assert.equal(JSON.stringify(frozen),before);
});
await test('closed 4h capture, 72h outcome, 5 fixture cap and zero provider calls',()=>{
 const o=rec();assert.equal(o.contract.max_distinct_fixtures,5);
 assert.equal(o.contract.max_per_class,3);
 assert.equal(o.contract.provider_calls,0);assert.equal(o.contract.scheduled_polls,0);
});
console.log('FE_FT_PILOT_LOCAL_SQLITE_PASS '+JSON.stringify({tests,unique_fixtures:count('ft_pilot_pairs_v1'),
 outcome_revisions:count('ft_pilot_outcomes_v1'),offline_sqlite:true,cloudflare_billed_writes_verified:false,
 provider_calls:0,deploy:false,scanner_actions:0,ht_hc_production_tested:false}));
