import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {CF_FREE_D1,FT_REMOTE_MEASURED_20261022,projectFTReplayCapacity} from './d1-capacity-analysis.mjs';
let checks=0;
function test(label,fn){fn();checks++;console.log('PASS '+label);}
test('actual remote REST evidence obs+decision is eight SQL eight written rows',()=>{
 assert.equal(FT_REMOTE_MEASURED_20261022.observation.queries+FT_REMOTE_MEASURED_20261022.decision.queries,8);
 assert.equal(FT_REMOTE_MEASURED_20261022.observation.rowsWritten+FT_REMOTE_MEASURED_20261022.decision.rowsWritten,8);
});
test('Cloudflare Free per invocation constraint cannot be certified from replay-only cap',()=>{
 const x=projectFTReplayCapacity({intervalSeconds:30,activeHours:8});
 assert.equal(x.releaseGate,'BLOCKED');assert(x.reasons.includes('UNMEASURED_TOTAL_WORKER_D1_QUERIES'));
 assert.equal(x.pairsPerCycle,3);assert.equal(x.deferredPerCycle,9);
});
test('eight hours at 30s interval 3 pairs per cycle means 23040 modeled replay writes',()=>{
 const x=projectFTReplayCapacity({intervalSeconds:30,activeHours:8});
 assert.equal(x.cycles,960);assert.equal(x.modeledReplayWrites,23040);assert.equal(x.modeledRowWriteOverLimit,false);
});
test('24 hour 20s cycles exceed free daily write allowance even without other paths',()=>{
 const x=projectFTReplayCapacity({intervalSeconds:20,activeHours:24});
 assert.equal(x.cycles,4320);assert.equal(x.modeledReplayWrites,103680);
 assert.equal(x.modeledRowWriteOverLimit,true);assert(x.reasons.includes('REPLAY_ALONE_EXCEEDS_D1_WRITES'));
});
test('explicit inherited 27 queries plus replay 24 exceeds D1 50 per invocation',()=>{
 const x=projectFTReplayCapacity({intervalSeconds:60,activeHours:1,otherQueriesPerInvocation:27,otherRowsWrittenPerDay:0,otherRowsReadPerDay:0,indexesVerified:true});
 assert(x.reasons.includes('TOTAL_INVOCATION_QUERY_LIMIT_EXCEEDED'));
});
test('outcome corrections and discovery included without pretending remote index writes are known',()=>{
 const x=projectFTReplayCapacity({intervalSeconds:60,activeHours:1,candidatePairsPerCycle:2,outcomesPerDay:5,retriesPerDay:2,discoveryPagesPerDay:4});
 assert.equal(x.modeledReplayWrites,60*16+5*4+2);
 assert.equal(x.modeledReplayReads,60*16+5*4+2*3+4*6);
 assert.equal(x.modeledExtraSql,5*4+2*2+4);
});
test('even fully populated mock budgets are never certified as production',()=>{
 const x=projectFTReplayCapacity({intervalSeconds:60,activeHours:1,otherQueriesPerInvocation:2,otherRowsWrittenPerDay:100,otherRowsReadPerDay:200,indexesVerified:true});
 assert.equal(x.status,'NOT_CERTIFIED');assert.equal(x.releaseGate,'BLOCKED');
});
test('invalid scenarios are rejected instead of becoming zeros',()=>{
 assert.throws(()=>projectFTReplayCapacity({intervalSeconds:0,activeHours:1}),/INVALID_SCENARIO/);
 assert.throws(()=>projectFTReplayCapacity({intervalSeconds:30,activeHours:30}),/INVALID_SCENARIO/);
 assert.throws(()=>projectFTReplayCapacity({intervalSeconds:30,activeHours:4,replaySqlCap:28}),/INVALID_SCENARIO/);
});
const cases=[
 {name:'20s for 24h',intervalSeconds:20,activeHours:24},
 {name:'30s for 8h',intervalSeconds:30,activeHours:8},
 {name:'60s for 8h',intervalSeconds:60,activeHours:8},
 {name:'20s for 4h',intervalSeconds:20,activeHours:4}
].map(x=>({name:x.name,...projectFTReplayCapacity(x)}));
mkdirSync('ft-audit-output',{recursive:true});
writeFileSync('ft-audit-output/d1-capacity-analysis.json',JSON.stringify({status:'SCENARIOS_ONLY',checks,source:FT_REMOTE_MEASURED_20261022.source_run,limits:CF_FREE_D1,cases},null,2));
console.log('D1_CAPACITY_SCENARIOS '+JSON.stringify(cases.map(x=>({name:x.name,modeledReplayWrites:x.modeledReplayWrites,modeledRowWriteOverLimit:x.modeledRowWriteOverLimit,pairsPerCycle:x.pairsPerCycle,deferredPerCycle:x.deferredPerCycle}))));
