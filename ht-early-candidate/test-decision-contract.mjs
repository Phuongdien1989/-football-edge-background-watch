import assert from 'node:assert/strict';
import {htDecision} from './decision-contract.mjs';
const now=1792542600000,item={id:1,latest:{goals:{home:0,away:0}}};
const row={id:1,at:now,dataOK:true,modelOK:true,marketOK:true,action:'TRIAL_OVER',quote:{ev:.539,fairOdds:1/.57,win:.57},recommendation:{line:.5,odds:2.7},model:{version:'TEST_INDEPENDENT',validated:false,sample:{home:8,away:8}}};
let tests=0;function test(fn){fn();tests++;}
test(()=>{const d=htDecision(item,row,{now});assert.equal(d.recommendation.state,'TRIAL_OVER');assert.equal(d.forecast.winProbability,.57);assert.equal(d.delivery.state,'DEVICE_SETTINGS_REQUIRED');assert.equal(d.delivery.recommendationPushEnabled,false);});
test(()=>{const old=JSON.stringify({item,row});htDecision(item,row,{now});assert.equal(JSON.stringify({item,row}),old);});
test(()=>assert.equal(htDecision(item,row,{now:now+56000}).recommendation.state,'WAIT_DATA'));
test(()=>{const d=htDecision(item,{...row,marketOK:false},{now});assert.equal(d.recommendation.state,'WAIT_MARKET');assert.equal(d.recommendation.odds,null);assert.equal(d.recommendation.estimatedEV,null);});
test(()=>assert.equal(htDecision(item,{...row,modelOK:false},{now}).recommendation.state,'WAIT_MODEL'));
test(()=>assert.equal(htDecision(item,{...row,action:'WAIT',quote:{...row.quote,ev:-.1}},{now}).recommendation.state,'WAIT_PRICE'));
test(()=>{const d=htDecision(item,{...row,recommendation:{line:1.25,odds:2.7}},{now});assert.equal(d.market.binary,false);assert.equal(d.market.breakEvenProbability,null);assert.equal(d.forecast.winProbability,null);});
test(()=>{const d=htDecision(item,row,{now,legacyRank:3,legacyScore:65,deliveryEligible:false,deliveryThreshold:72});assert.equal(d.ranking.rank,3);assert.equal(d.delivery.state,'LEGACY_SIGNAL_WAIT');assert.equal(d.recommendation.state,'TRIAL_OVER');});
test(()=>{const d=htDecision(item,row,{now,deliveryEligible:true,deliveryThreshold:60});assert.equal(d.delivery.state,'LEGACY_SIGNAL_ELIGIBLE');assert.equal(d.delivery.recommendationPushEnabled,false);});
test(()=>assert.equal(htDecision(item,{...row,id:2},{now}),null));
console.log(JSON.stringify({status:'PASS',tests,provider_requests:0,d1_writes:0,production_enabled:false}));
