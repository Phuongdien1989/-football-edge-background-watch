import assert from 'node:assert/strict';
import {calibrationMetrics,stratifiedCalibration,opportunityMetrics,settlementReturn,marketValidation,validationDashboard} from './validation-metrics.js';
import {compareOldNew,buildPairedObservation} from './old-vs-new-comparator.js';
import {createPaperMarketRecord,settlePaperMarketRecord} from './paper-market-evidence.js';
import {runShadowUniverse} from './shadow-universe-runner.js';

const rows=[
 {p_goal_5m:20,p_goal_10m:40,p_goal_15m:60,confidence_band:'HIGH',minute:61,outcome:{goal_5m:false,goal_10m:true,goal_15m:true},league:'A'},
 {p_goal_5m:10,p_goal_10m:30,p_goal_15m:50,confidence_band:'MEDIUM',minute:66,outcome:{goal_5m:false,goal_10m:false,goal_15m:true},league:'A'},
 {p_goal_5m:70,p_goal_10m:80,p_goal_15m:90,confidence_band:'HIGH',minute:76,outcome:{goal_5m:true,goal_10m:true,goal_15m:true},league:'B'},
 {p_goal_5m:null,p_goal_10m:null,p_goal_15m:null,confidence_band:'LOW',minute:20,outcome:{goal_5m:null,goal_10m:null,goal_15m:null},league:'B'}
];
const m=calibrationMetrics(rows,{probPath:'p_goal_10m',outcomePath:'outcome.goal_10m',buckets:5});
assert.equal(m.n,3);assert.ok(m.brier>=0&&m.brier<=1);assert.ok(m.log_loss>=0);assert.ok(m.ece>=0);
assert.ok(stratifiedCalibration(rows,{groupBy:'minute_bucket'}).some(x=>x.group==='60-74'));
const dash=validationDashboard(rows);assert.equal(dash.goal_15m.n,3);

const opp=opportunityMetrics([{eligible:true,hit:true},{eligible:true,hit:false},{eligible:false,hit:true}]);
assert.equal(opp.opportunities,2);assert.equal(opp.hit_rate_pct,50);

assert.equal(settlementReturn('WIN',2),1);
assert.equal(settlementReturn('HALF_WIN',2),.5);
assert.equal(settlementReturn('HALF_LOSS',2),-.5);
assert.equal(settlementReturn('LOSS',2),-1);
const mv=marketValidation([
 {expected_return:.10,settlement_result:'WIN',odds:2},
 {expected_return:.05,settlement_result:'LOSS',odds:2}
]);
assert.equal(mv.n,2);assert.equal(mv.total_realized_units,0);assert.equal(mv.positive_edge_n,2);

const paired=[
 buildPairedObservation({id:'1',fixtureId:1,capturedAt:1,oldRankMeta:{eligible:true,primary:{stateRank:3}},newOpportunity:{rank:1,best_market:{edge:{expected_return:.08}}},hit:true}),
 buildPairedObservation({id:'2',fixtureId:2,capturedAt:2,oldRankMeta:{eligible:false,primary:{stateRank:2}},newOpportunity:{rank:2,best_market:{edge:{expected_return:.06}}},hit:true}),
 buildPairedObservation({id:'3',fixtureId:3,capturedAt:3,oldRankMeta:{eligible:true,primary:{stateRank:4}},newOpportunity:{rank:4,best_market:{edge:{expected_return:-.02}}},hit:false})
];
const cmp=compareOldNew(paired);assert.equal(cmp.n,3);assert.equal(cmp.agreement.new_only,1);assert.equal(cmp.agreement.old_only,1);
assert.equal(cmp.new_ranked.coverage_pct>cmp.old.coverage_pct,false); // both are 2/3 in this fixture set
assert.equal(cmp.new_positive_edge.selected,2);

const rec=createPaperMarketRecord({fixtureId:9,capturedAt:10,state:{minute:70,score_home:0,score_away:0},
 bestMarket:{market:'TOTAL',selection:'OVER',line:1.25,odds:2.0,bookmaker:'X',edge:{valid:true,fair_odds:1.8,expected_return:.1}},confidence:78});
assert.ok(rec&&!rec.settled);
const settled=settlePaperMarketRecord(rec,{finalHome:1,finalAway:1});
assert.equal(settled.settled,true);assert.equal(settled.settlement_result,'WIN');assert.equal(settled.realized_return,1);

const ah=createPaperMarketRecord({fixtureId:10,state:{minute:60,score_home:0,score_away:0},
 bestMarket:{market:'ASIAN_HANDICAP',selection:'HOME',line:-.25,odds:1.9,edge:{valid:true,fair_odds:1.8,expected_return:.05}},confidence:70});
const ahSet=settlePaperMarketRecord(ah,{finalHome:1,finalAway:1});
assert.equal(ahSet.settlement_result,'HALF_LOSS');assert.equal(ahSet.realized_return,-.5);

console.log('B5 tests PASS');


const liveItem={id:77,latest:{minute:62,status:'2H',goals:{home:0,away:0},fresh_at:Date.now()-5000,dq:82,stats_presence:{coverage:5},
 metrics:{home:{shots:11,sot:5,inbox:6,corners:5,xg:1.2},away:{shots:4,sot:1,inbox:2,corners:2,xg:.3}}},
 eval:{game:13,pressure:16,chance:15,momentum:11,context:6,quality:4,accel:.3,mature:true,baselineAge:7,scoreMode:'FULL'}};
const ctx={shadow_only:true,home:{personnel:{confidence:.8},strength:{goals_for_avg:1.7,goals_against_avg:1.0}},
 away:{personnel:{confidence:.8},strength:{goals_for_avg:1.0,goals_against_avg:1.5}},deltas:{recent_ppg:.4,season_ppg:.3}};
const predEv=[],pairEv=[],paperEv=[];
const rankedUniverse=runShadowUniverse({items:[liveItem],contexts:new Map([[77,ctx]]),
 marketRowsByFixture:new Map([[77,[{category:'over_under',market:'Goals Over/Under',integrity:{valid:true},values:[
  {value:'Over 0.5',handicap:.5,odd:2.05,main:true},{value:'Under 0.5',handicap:.5,odd:1.75,main:true}
 ]}]]]),oldRankMetaByFixture:new Map([[77,{eligible:false,primary:{stateRank:2}}]]),
 predictionEvidence:predEv,pairedEvidence:pairEv,paperEvidence:paperEv});
assert.equal(rankedUniverse.length,1);assert.equal(liveItem.predictionV2RankShadow.rank,1);
assert.equal(predEv.length,1);assert.equal(pairEv.length,1);assert.equal(paperEv.length,1);
assert.equal(liveItem.eval.game,13); // old engine untouched
console.log('B5 shadow universe PASS');
