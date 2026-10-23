import assert from 'node:assert/strict';
import {BG_INDEX_SQL,BG_ODDS_SHAPE_SQL,BG_REASONS,safeBgProbeSQL,summaryBackgroundShape} from './legacy-ft-background-shape.mjs';
let tests=0;function test(name,fn){fn();tests++;console.log('PASS '+name)}
test('requires precise table index existence query',()=>assert.equal(safeBgProbeSQL(BG_INDEX_SQL,[]),true));
test('requires reason-backed index and 24 maximum source rows',()=>{
 assert.equal(safeBgProbeSQL(BG_ODDS_SHAPE_SQL,['MARKET_MOVE']),true);
 assert(BG_ODDS_SHAPE_SQL.includes('INDEXED BY idx_live_snapshots_reason_time'));
 assert(BG_ODDS_SHAPE_SQL.includes('LIMIT 24'));
});
test('reject all unindexed or destructive SQL',()=>{
 assert.throws(()=>safeBgProbeSQL('SELECT * FROM live_snapshots',[]),/CLOSED/);
 assert.throws(()=>safeBgProbeSQL('DELETE FROM live_snapshots',[]),/CLOSED/);
});
test('reject unsupported/attacker-controlled bind values',()=>{
 assert.throws(()=>safeBgProbeSQL(BG_ODDS_SHAPE_SQL,['MARKET_MOVE;DELETE']),/CLOSED/);
 assert.throws(()=>safeBgProbeSQL(BG_ODDS_SHAPE_SQL,[]),/CLOSED/);
});
test('supports only three whitelisted reasons',()=>assert.deepEqual(BG_REASONS,['MARKET_MOVE','BACKGROUND_BASELINE','PERIODIC_5M']));
test('aggregated presence does not certify original bookmaker quote',()=>{
 const a=summaryBackgroundShape('MARKET_MOVE',[
  {captured_at:100,source:'BACKGROUND',snapshot_kind:'SOURCE_DETAIL',odds_group_count:2,stats_team_count:2,event_count:3,has_feed_update:1,fixture_id:55},
  {captured_at:90,source:'OTHER',snapshot_kind:'SOURCE_HEARTBEAT',odds_group_count:0,stats_team_count:0,event_count:0,has_feed_update:0,fixture_id:56}
 ]);
 assert.equal(a.raw_odds_present,1);assert.equal(a.stats_present,1);
 assert.equal(a.market_updates_present,1);assert.equal(a.source_BACKGROUND,1);
 assert.equal(a.verified_bookmaker_odds,0);assert.equal(a.calibrated_model_pairs,0);
 assert(!JSON.stringify(a).includes('fixture_id'));
});
test('missing evidence remains empty, not trading eligible',()=>{
 const a=summaryBackgroundShape('PERIODIC_5M',[]);
 assert.equal(a.raw_odds_present,0);assert.equal(a.calibrated_model_pairs,0);
});
test('bounded sample cap blocks unexpected read volume',()=>assert.throws(()=>summaryBackgroundShape('BACKGROUND_BASELINE',Array(25).fill({})),/INVALID_BG_SAMPLE/));
test('unknown sample reason cannot be mixed with FT source',()=>assert.throws(()=>summaryBackgroundShape('FT',[]),/INVALID_BG_SAMPLE/));
console.log('FE_FT_BG_ODDS_PLAN_PASS '+JSON.stringify({tests,provider_calls:0,d1_queries:0,d1_writes:0,deploy:false}));
