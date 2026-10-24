import assert from 'node:assert/strict';
import {reviewFTDecision, POLICY} from './experimental-decision.mjs';
const r=(p,odds=2.1)=>({blocked:false,marketFresh:true,fresh:true,modelOK:true,
 snapshot:{goals:{home:1,away:0},market:{line:1.5,over:odds},model:{version:'RESEARCH',validated:false,sample:{home:5,away:4}}},
 quote:{win:p,ev:p*odds-1,fairOdds:1/p},data:{label:'CHANCES ADDED'}});
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
