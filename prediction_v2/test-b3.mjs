import assert from 'node:assert/strict';
import {buildLiveFeaturePacket} from './live-feature-adapter.js';
import {predictShadowProbability,buildBaseProbability} from './probability-engine.js';
import {compactShadowEvidence,shouldRecordShadow,settleShadowEvidence} from './shadow-evidence.js';
import {attachShadowPrediction} from './shadow-live-bridge.js';
import {parseRateLimitHeaders} from './api-budget-manager.js';

assert.deepEqual(parseRateLimitHeaders({get(){return null}}),{dailyLimit:null,dailyRemaining:null,minuteLimit:null,minuteRemaining:null});

const context={shadow_only:true,
  home:{personnel:{confidence:.9},strength:{goals_for_avg:1.8,goals_against_avg:1.0}},
  away:{personnel:{confidence:.8},strength:{goals_for_avg:1.1,goals_against_avg:1.6}},
  deltas:{lineup_strength:.08,star_availability:.05,injury_core:.03,recent_ppg:.6,season_ppg:.5,venue_ppg:.4,rest_days:1,live_rating:.25}};
const item={id:99,
  latest:{minute:62,status:'2H',goals:{home:0,away:0},fresh_at:Date.now()-8000,dq:84,stats_presence:{coverage:5},
    metrics:{home:{shots:12,sot:5,inbox:7,corners:6,xg:1.25},away:{shots:4,sot:1,inbox:2,corners:1,xg:.25}}},
  eval:{game:14,pressure:16,chance:15,momentum:11,context:7,quality:4,accel:.45,mature:true,baselineAge:8,scoreMode:'FULL',
    recent5:{delta:{shots:4,sot:2,inbox:3,corners:2,xg:.35}}}};
const packet=buildLiveFeaturePacket({fixtureId:99,engine:'FT',item,context});
assert.equal(packet.shadow_only,true);
assert.equal(packet.market_holdout.note.includes('circularity'),true);
assert.ok(packet.live.dominance>0);
assert.ok(packet.context.directional_index>0);

const base=buildBaseProbability(packet);
assert.ok(base.lambda_match>2);
assert.equal(base.fallback,false);

const pred=predictShadowProbability(packet);
assert.equal(pred.market_used,false);
assert.ok(pred.probabilities.goal_5m<=pred.probabilities.goal_10m);
assert.ok(pred.probabilities.goal_10m<=pred.probabilities.goal_15m);
assert.ok(pred.probabilities.home_next_goal_given_goal>50);
assert.ok(pred.confidence.score_100>50);
assert.equal(pred.decision,null);

const weakItem=structuredClone(item);
weakItem.eval.pressure=5;weakItem.eval.chance=4;weakItem.eval.momentum=3;weakItem.eval.accel=-.5;
const weakPacket=buildLiveFeaturePacket({fixtureId:99,engine:'FT',item:weakItem,context});
const weakPred=predictShadowProbability(weakPacket);
assert.ok(pred.probabilities.goal_10m>weakPred.probabilities.goal_10m);

const rows=[];
attachShadowPrediction({item,engine:'FT',context,evidenceRows:rows});
assert.ok(item.predictionV2Shadow?.prediction);
assert.equal(rows.length,1);

const ev=compactShadowEvidence({item,packet,prediction:pred,context});
assert.equal(shouldRecordShadow(ev,{...ev,captured_at:ev.captured_at+10000,p_goal_10m:ev.p_goal_10m+1}),false);
assert.equal(shouldRecordShadow(ev,{...ev,captured_at:ev.captured_at+10000,p_goal_10m:ev.p_goal_10m+4}),true);

const settled=settleShadowEvidence(ev,{minute:69,goals:{home:1,away:0}});
assert.equal(settled.outcome.goal_10m,true);
assert.equal(settled.outcome.goal_5m,false);

const noCtxPacket=buildLiveFeaturePacket({fixtureId:100,engine:'FT',item:{...item,id:100},context:null});
const noCtxPred=predictShadowProbability(noCtxPacket);
assert.equal(noCtxPred.base.fallback,true);
assert.ok(noCtxPred.confidence.score_100<pred.confidence.score_100);

const terminal={...packet,state:{...packet.state,minute:90}};
assert.equal(predictShadowProbability(terminal).probabilities.goal_5m,0);

console.log('B3 tests PASS');
