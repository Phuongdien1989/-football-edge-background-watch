import assert from 'node:assert/strict';
import {FT_RAW_ODDS_PRESENCE_SQL,assertFTPayloadReadOnlySQL,summarizeFTPayloadShape} from './legacy-ft-payload-shape.mjs';
let tests=0;const test=(name,fn)=>{fn();tests++;console.log('PASS '+name)};
test('fixed SQL is indexed and bounded',()=>{
 assert.equal(assertFTPayloadReadOnlySQL(FT_RAW_ODDS_PRESENCE_SQL),true);
 assert(FT_RAW_ODDS_PRESENCE_SQL.includes('INDEXED BY idx_live_snapshots_engine_time'));
 assert(FT_RAW_ODDS_PRESENCE_SQL.includes("engine='FT'"));
 assert(FT_RAW_ODDS_PRESENCE_SQL.includes('LIMIT 24'));
});
test('SQL never returns raw payload odds, fixture score or bookmaker rows',()=>{
 assert(!FT_RAW_ODDS_PRESENCE_SQL.includes('SELECT *'));
 assert(!/SELECT[^]*\bodds_raw\s*,/.test(FT_RAW_ODDS_PRESENCE_SQL));
 assert(!/,\s*payload_json\s*(?:,|FROM)\b/i.test(FT_RAW_ODDS_PRESENCE_SQL));
});
test('rejects unbounded SQL and mutation',()=>{
 assert.throws(()=>assertFTPayloadReadOnlySQL('SELECT * FROM live_snapshots'),/CLOSED/);
 assert.throws(()=>assertFTPayloadReadOnlySQL('DELETE FROM live_snapshots'),/CLOSED/);
});
const rows=[
 {fixture_id:77,captured_at:11100,source:'BACKGROUND',snapshot_kind:'SOURCE_DETAIL',odds_group_count:3,stats_team_count:2,event_count:8,has_feed_update:1},
 {fixture_id:77,captured_at:10100,source:'BACKGROUND',snapshot_kind:'SOURCE_HEARTBEAT',odds_group_count:0,stats_team_count:0,event_count:0,has_feed_update:0},
 {fixture_id:78,captured_at:9900,source:'BACKGROUND',snapshot_kind:'SOURCE_DETAIL',odds_group_count:2,stats_team_count:2,event_count:4,has_feed_update:0}
];
test('presence-only summary detects raw odds and known source types',()=>{
 const x=summarizeFTPayloadShape(rows);
 assert.equal(x.result,'RAW_ODDS_PAYLOAD_PRESENT_NOT_PRICE_CERTIFIED');
 assert.equal(x.with_raw_odds_groups,2);
 assert.equal(x.with_both_teams_stats,2);
 assert.equal(x.with_event_evidence,2);
 assert.equal(x.with_provider_market_update,1);
 assert.deepEqual(x.source_kind_counts,{SOURCE_DETAIL:2,SOURCE_HEARTBEAT:1});
});
test('no fixture IDs or data values leak into aggregate result',()=>{
 const x=summarizeFTPayloadShape(rows),s=JSON.stringify(x);
 assert(!s.includes('fixture_id'));assert(!s.includes('77'));assert(!s.includes('78'));
 assert.equal(x.raw_bet_price_verified,0);
 assert.equal(x.bookmaker_identity_verified,0);
 assert.equal(x.labels_are_independently_verified,false);
});
test('a zero-odds sample is not proof all historical snapshots lack odds',()=>{
 const x=summarizeFTPayloadShape([rows[1]]);
 assert.equal(x.result,'NO_RAW_ODDS_IN_RECENT_BOUNDED_SAMPLE');
 assert.equal(x.with_raw_odds_groups,0);
});
test('invalid JSON classification is not zero-priced odds',()=>{
 const x=summarizeFTPayloadShape([{odds_group_count:-1,stats_team_count:-1,event_count:-1,has_feed_update:0}]);
 assert.equal(x.missing_or_invalid_json,1);assert.equal(x.with_raw_odds_groups,0);
});
test('empty sample stays undecided, never training-ready',()=>{
 const x=summarizeFTPayloadShape([]);
 assert.equal(x.rows_sampled,0);assert.equal(x.can_replay_without_new_writes,false);
});
test('reject oversized sampled response before interpretation',()=>assert.throws(()=>summarizeFTPayloadShape(Array(25).fill(rows[0])),/BOUNDED/));
test('do not treat stale historical market update as present odds',()=>{
 const x=summarizeFTPayloadShape(rows);
 assert.equal(x.can_replay_without_new_writes,false);
 assert.equal(x.bookmaker_identity_verified,0);
});
console.log('FE_FT_RAW_ODDS_SHAPE_OFFLINE_PASS '+JSON.stringify({tests,d1_queries:0,d1_writes:0,deploy:false}));
