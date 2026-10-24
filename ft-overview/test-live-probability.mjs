import assert from 'node:assert/strict';
import {liveEvidence,liveProbability} from './live-probability.mjs';
const at=Date.UTC(2026,9,24,11,0);
const frame=(older)=>({at,minute:65,goals:{home:1,away:0},metrics:{shots:14,sot:5,inbox:8,xg:1.45},
 history:[{at:at-5*60000,goals:{home:1,away:0},metrics:older||{shots:10,sot:3,inbox:5,xg:1.01}}],
 model:{independent:true,version:'RECENT_RATE_TIME_ONLY_V1',validated:false,at,pmf:[.5,.4,.1]}});
assert.equal(liveEvidence(frame()).status,'CHANCES_ADDED');
assert.equal(liveEvidence(frame()).delta.sot,2);
assert.equal(liveEvidence({...frame(),history:[{...frame().history[0],at:at+1000}]}).status,'NO_WINDOW');
assert.equal(liveEvidence({...frame(),history:[{...frame().history[0],goals:{home:0,away:0}}]}).status,'NO_WINDOW');
assert.equal(liveEvidence({...frame(),history:[{...frame().history[0],at:at-11*60000}]}).status,'NO_WINDOW');
assert.equal(liveEvidence(frame({shots:30,sot:30,inbox:30,xg:30})).status,'MISSING_STATS');
const v=liveProbability(frame());
assert.equal(v.status,'BASELINE_WITH_LIVE_EVIDENCE');
assert.equal(v.liveAdjusted,false);
assert.equal(v.evidence.additionalProbability,null);
assert.deepEqual(v.pmf,[.5,.4,.1]);
assert.equal(liveProbability({...frame(),model:{...frame().model,at:at+1000}}).status,'MODEL_WAIT');
assert.equal(liveProbability({...frame(),model:null}).status,'MODEL_WAIT');
console.log('FT_V2_LIVE_PROBABILITY_PROVENANCE_PASS 11 checks; fail closed and no future leakage');
