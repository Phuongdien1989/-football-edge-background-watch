import assert from 'node:assert/strict';
import {asianTotalResult,asianHandicapResult,totalEdge,handicapEdge,removeVigTwoWay,modelRemainingLambdas} from './market-edge.js';
import {extractActualOffers} from './market-adapter.js';
import {rankOpportunities} from './opportunity-ranking.js';

assert.equal(asianTotalResult(2,2.25,'OVER'),'HALF_LOSS');
assert.equal(asianTotalResult(2,2.25,'UNDER'),'HALF_WIN');
assert.equal(asianHandicapResult(1,1,-.25,'HOME'),'HALF_LOSS');
assert.equal(asianHandicapResult(1,1,.25,'HOME'),'HALF_WIN');
assert.equal(asianHandicapResult(2,1,-1.25,'HOME'),'HALF_LOSS');

const nv=removeVigTwoWay(1.9,1.9);
assert.ok(Math.abs(nv.a-.5)<.001);
assert.ok(nv.overround>0);

const te=totalEdge({currentGoals:0,lambdaRemaining:1,line:.5,side:'OVER',odds:1.9});
assert.ok(te.expected_return>0);
assert.ok(te.fair_odds<1.9);

const he=handicapEdge({homeGoals:0,awayGoals:0,lambdaHomeRemaining:1.4,lambdaAwayRemaining:.5,line:-.25,selection:'HOME',odds:1.95});
assert.ok(he.valid);
assert.ok(Number.isFinite(he.expected_return));

const prediction={engine:'FT',live_update:{effective_lambda_90:4},direction:{home_given_goal:.7},confidence:{value:.8}};
const l=modelRemainingLambdas(prediction,{minute:60});
assert.ok(l.total>1);
assert.ok(l.home>l.away);

const marketRows=[{category:'over_under',market:'Goals Over/Under',bookmaker:'X',integrity:{valid:true},values:[
  {value:'Over 0.5',handicap:.5,odd:2.0,main:true},{value:'Under 0.5',handicap:.5,odd:1.8,main:true}
]}];
const offers=extractActualOffers(marketRows);
assert.equal(offers.length,2);
assert.equal(offers[0].line,.5);

const ahRows=[{category:'asian_handicap',market:'Asian Handicap',integrity:{valid:true},feed_status:{blocked:false},values:[
  {value:'Alpha',selection_side:'home',handicap:-.5,odd:1.95,main:true},{value:'Beta',selection_side:'away',handicap:.5,odd:1.9,main:true}
]}];
assert.equal(extractActualOffers(ahRows).length,2);

const ranked=rankOpportunities([
  {id:1,prediction,state:{minute:80,score_home:0,score_away:0},marketRows},
  {id:2,prediction:{...prediction,confidence:{value:.4},live_update:{effective_lambda_90:1.1}},state:{minute:80,score_home:0,score_away:0},marketRows}
]);
assert.equal(ranked[0].rank,1);
assert.equal(ranked[0].top,1);
assert.ok(ranked[0].best_market);
assert.equal(ranked[0].entry_decision,null);

const noMarket=rankOpportunities([{id:3,prediction,state:{minute:70,score_home:0,score_away:0},marketRows:[]}]);
assert.equal(noMarket[0].edge_status,'NO_SUPPORTED_MARKET');
assert.equal(noMarket[0].rank,1);

console.log('B4 tests PASS');
