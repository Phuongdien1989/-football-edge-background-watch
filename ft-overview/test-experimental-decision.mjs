import assert from 'node:assert/strict';
import {reviewFTDecision, POLICY} from './experimental-decision.mjs';
const r=(p,odds=2.1)=>({blocked:false,marketFresh:true,fresh:true,modelOK:true,
 snapshot:{goals:{home:1,away:0},market:{line:1.5,over:odds},model:{version:'RESEARCH',validated:false,sample:{home:5,away:4}}},
 recommendation:{action:p*odds-1>0?'TRIAL_OVER':'WAIT_PRICE'},quote:{win:p,halfWin:0,push:0,halfLose:0,lose:1-p,winWeight:p,loseWeight:1-p,ev:p*odds-1,fairOdds:1/p},data:{label:'CHANCES ADDED'}});
const t=(x,a)=>assert.equal(reviewFTDecision(x).action,a);
t(r(.54),'TRIAL_OVER');
assert.equal(reviewFTDecision(r(.54)).needed,1);
assert.ok(reviewFTDecision(r(.54)).estimatedEV>.13);
assert.ok(reviewFTDecision(r(.49)).sensitivity.lowEV<0);
t(r(.38),'WAIT_PRICE');
t({...r(.54),blocked:true},'DATA_WAIT');
t({...r(.54),marketFresh:false},'WAIT_PRICE');
t({...r(.54),modelOK:false,quote:null},'MODEL_WAIT');
t({...r(.54),snapshot:{...r(.54).snapshot,goals:{home:1,away:1}}},'CONTRACT_MISMATCH');
t({...r(.54),snapshot:{...r(.54).snapshot,market:{line:2.5,over:2.1}}},'TRIAL_OVER');
assert.equal(reviewFTDecision(r(.54)).policy,POLICY);
console.log('FT_V2_DECISION_REVIEW_PASS 10+ checks; NO production changes');

// Hand-computed settlement cases: PMF .4/.4/.2 at current total 1.
import {assess,priceOver,createStore} from './core.mjs';
const now=1800000000000;
for(const [line,W,L,fair,ev] of [[1.5,.6,.4,5/3,.26],[2,.2,.4,3,-.18],[1.75,.4,.4,2,.04],[2.25,.2,.6,4,-.38]]){
 const q=priceOver([.4,.4,.2],1,line,2.1);
 for(const [actual,expected] of [[q.winWeight,W],[q.loseWeight,L],[q.fairOdds,fair],[q.ev,ev]])assert.ok(Math.abs(actual-expected)<1e-12);
 const snapshot={id:1,revision:1,at:now,minute:65,status:'2H',goals:{home:1,away:0},metrics:{sot:2},market:{line,over:2.1,at:now,score:{home:1,away:0},period:'FT',basis:'FULL_MATCH'},model:{at:now,version:'test',independent:true,kind:'RESEARCH',validated:false,pmf:[.4,.4,.2]}};
 const store=createStore({trialRecommendations:true});store.ingest(snapshot);
 const row=store.read(now)[0],v=reviewFTDecision(row);
 assert.equal(v.action,row.recommendation.action);
 assert.ok(Math.abs(v.weightedWinShare-W/(W+L))<1e-12);
 assert.ok(Math.abs(v.sensitivity.lowEV-((W+L)*(Math.max(0,W/(W+L)-.05)*2.1-1)))<1e-12);
 assert.equal(v.winProbability,q.win);
 assert.notEqual(reviewFTDecision(assess(snapshot,now)).action,'TRIAL_OVER');
 assert.equal(reviewFTDecision(assess(snapshot,now+61000,{trialRecommendations:true})).action,'DATA_WAIT');
}
// Positive EV of less than 1% remains eligible; no arbitrary price ceiling.
t(r(.346,2.9),'TRIAL_OVER');
console.log('FT_V2_SETTLEMENT_PARITY_PASS binary/integer/quarter, shadow, stale, small edge');
