import assert from 'node:assert/strict';
import {LEGACY_META_SQL,assertSafeFTReadSQL,buildLegacyFTReadPlan,
 summarizeLegacyFTSamples,selectMarketFixtureCandidate,LEGACY_MARKET_SPEC} from './legacy-ft-source-plan.mjs';
let n=0;const test=(name,fn)=>{fn();n++;console.log('PASS '+name)};
const info=[
 ['live_snapshots','fixture_id captured_at minute status score_home score_away line price market_type signal_score snapshot_kind source','idx_live_snapshots_engine_time'],
 ['entry_decisions','fixture_id captured_at minute score_home score_away line price model_prob policy_status resolution outcome auto_settle_supported','idx_entry_engine_time'],
 ['entry_outcomes','fixture_id resolved_at outcome final_score_home final_score_away','idx_entry_outcomes_engine'],
 ['fixture_history','fixture_id last_seen_at kickoff status terminal fulltime_home fulltime_away','idx_fixture_history_status'],
 ['market_snapshots','fixture_id captured_at market_type selection line price source','idx_market_snapshots_fixture']
];
const meta=info.flatMap(([table,cols,index])=>[
 {name:table,type:'table',tbl_name:table,sql:'CREATE TABLE '+table+' ('+cols.split(' ').map(c=>c+' INTEGER').join(', ')+')'},
 {name:index,type:'index',tbl_name:table,sql:'CREATE INDEX '+index+' ON '+table+' (fixture_id,captured_at)'}
]);
test('complete indexed known schema selects four bounded FT sources and optional market',()=>{
 const p=buildLegacyFTReadPlan(meta);
 assert.equal(p.queries.length,4);assert(p.market_probe_available);
 assert.equal(p.market_spec.maxResultRows,12);
 assert.equal(p.missing_replay_tables.length,2);
});
test('schema-only plan never pretends FT model training is ready',()=>{
 const p=buildLegacyFTReadPlan(meta);
 assert.equal(p.status,'INDEXED_READ_PLAN_ONLY');
 assert(!('training_ready' in p));
});
test('missing all legacy tables gives no D1 select plan',()=>{
 const p=buildLegacyFTReadPlan([]);
 assert.equal(p.queries.length,0);
 assert.equal(p.market_probe_available,false);
});
test('a missing index prevents the corresponding table scan',()=>{
 const p=buildLegacyFTReadPlan(meta.filter(x=>x.name!=='idx_live_snapshots_engine_time'));
 assert(!p.queries.some(x=>x.key==='live_snapshots'));
});
test('index from a different table is not trusted',()=>{
 const data=structuredClone(meta);
 data.find(x=>x.name==='idx_entry_engine_time').tbl_name='market_snapshots';
 assert(!buildLegacyFTReadPlan(data).queries.some(x=>x.key==='entry_decisions'));
});
test('missing required field disables corresponding source scan',()=>{
 const data=structuredClone(meta);
 data.find(x=>x.name==='entry_outcomes').sql=data.find(x=>x.name==='entry_outcomes').sql.replace('final_score_away INTEGER, ','').replace(', final_score_away INTEGER','');
 assert(!buildLegacyFTReadPlan(data).queries.some(x=>x.key==='entry_outcomes'));
});
test('a missing market index never triggers an unbounded market query',()=>{
 const data=meta.filter(x=>x.name!=='idx_market_snapshots_fixture');
 assert(!buildLegacyFTReadPlan(data).market_probe_available);
});
test('all allowlisted SQL only selects, no mutations or unrestricted historical table scan',()=>{
 const p=buildLegacyFTReadPlan(meta);
 for(const x of [LEGACY_META_SQL,...p.queries.map(x=>x.sql),LEGACY_MARKET_SPEC.sql])
  assert.equal(assertSafeFTReadSQL(x),true);
 assert(p.queries.every(x=>/\bLIMIT 24\b/.test(x.sql)&&/INDEXED BY/.test(x.sql)));
});
test('malicious D1 DELETE rejected',()=>assert.throws(()=>assertSafeFTReadSQL('DELETE FROM entry_decisions'),/NOT_ALLOWED/));
test('unindexed SELECT rejected even though syntactically readonly',()=>
 assert.throws(()=>assertSafeFTReadSQL('SELECT * FROM entry_decisions'),/UNAPPROVED/));
test('chained SELECT plus update rejected',()=>
 assert.throws(()=>assertSafeFTReadSQL('SELECT * FROM fixtures; DELETE FROM fixtures'),/NOT_ALLOWED/));
test('an anonymous table uses no fixture identifier in output summary',()=>{
 const res=summarizeLegacyFTSamples('live_snapshots',[
  {fixture_id:123,captured_at:10000,line:2.75,price:1.9},
  {fixture_id:123,captured_at:10001,line:null,price:null},
  {fixture_id:456,captured_at:9999,line:3.25,price:2.01}
 ]);
 assert.deepEqual([res.sample_rows,res.distinct_fixtures,res.with_line_price],[3,2,2]);
 assert(!('fixture_id' in res));assert(!JSON.stringify(res).includes('456'));
});
test('FT outcome final goals counted separately from market odds',()=>{
 const res=summarizeLegacyFTSamples('entry_outcomes',[
  {fixture_id:20,resolved_at:1000,final_score_home:2,final_score_away:1},
  {fixture_id:21,resolved_at:2000,final_score_home:null,final_score_away:null}
 ]);
 assert.equal(res.with_final_score,1);
 assert.equal(res.with_line_price,0);
 assert.equal(res.training_ready,false);
});
test('market probe chooses fixture from already bounded LIVE FT source only',()=>{
 const x=selectMarketFixtureCandidate({live_snapshots:[{fixture_id:23}],entry_decisions:[{fixture_id:45}]});
 assert.equal(x,23);
});
test('no indexed sampled FT fixture means no market probe',()=>{
 assert.equal(selectMarketFixtureCandidate({entry_outcomes:[{fixture_id:19}]}),null);
});
test('unbounded schema metadata must be rejected',()=>assert.throws(()=>buildLegacyFTReadPlan(Array(81).fill({name:'x'})),/INVALID_SCHEMA/));
test('sample larger than bounded allowance is rejected',()=>assert.throws(()=>summarizeLegacyFTSamples('live_snapshots',Array(25).fill({})),/INVALID_FT_SAMPLE/));
console.log('FE_FT_LEGACY_SOURCE_PLAN_OFFLINE_PASS '+JSON.stringify({tests:n,sql_calls:0,d1_writes:0,scanner_enabled:false,production_mutations:0}));
