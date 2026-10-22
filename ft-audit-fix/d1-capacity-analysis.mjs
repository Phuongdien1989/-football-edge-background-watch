// FT replay capacity model from an ISOLATED remote REST measurement.
// Scenario planning only: not a Worker/DO invocation measurement or production certification.
export const CF_FREE_D1={maxQueriesPerInvocation:50,rowsReadPerDay:5_000_000,rowsWrittenPerDay:100_000};
export const FT_REMOTE_MEASURED_20261022=Object.freeze({
 source_run:'https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39699252168',
 database_scope:'ISOLATED_REMOTE_REST',
 rows_include_current_remote_indexes_only:true,
 observation:{queries:4,rowsRead:4,rowsWritten:4},
 decision:{queries:4,rowsRead:4,rowsWritten:4},
 outcome:{queries:4,rowsRead:4,rowsWritten:4},
 exactOutcomeRetry:{queries:2,rowsRead:3,rowsWritten:1},
 discovery:{queries:1,rowsRead:6,rowsWritten:0},
 validated_model:false
});
export const FT_REPLAY_CAP=24;
const finiteNonnegative=(n,name)=>{if(!Number.isFinite(n)||n<0)throw Error('INVALID_'+name);return n;};
// The proposed cap is sidecar-only, not a total D1 meter. All output is a scenario,
// not a claim that the real Worker performs exactly these writes or reads.
export function projectFTReplayCapacity({
 intervalSeconds, activeHours, candidatePairsPerCycle=12,
 replaySqlCap=FT_REPLAY_CAP, outcomesPerDay=0, retriesPerDay=0, discoveryPagesPerDay=0,
 otherRowsWrittenPerDay=null, otherRowsReadPerDay=null,
 otherQueriesPerInvocation=null, indexesVerified=false
}={}){
 for(const [n,v] of Object.entries({intervalSeconds,activeHours,candidatePairsPerCycle,replaySqlCap,outcomesPerDay,retriesPerDay,discoveryPagesPerDay})){
  finiteNonnegative(v,n);
 }
 if(intervalSeconds<1||activeHours>24||!Number.isSafeInteger(candidatePairsPerCycle)||!Number.isSafeInteger(replaySqlCap)||replaySqlCap>FT_REPLAY_CAP)throw Error('INVALID_SCENARIO');
 const cycles=Math.ceil(activeHours*3600/intervalSeconds);
 const pair=FT_REMOTE_MEASURED_20261022.observation, decision=FT_REMOTE_MEASURED_20261022.decision;
 const pairQueries=pair.queries+decision.queries;
 const pairReads=pair.rowsRead+decision.rowsRead;
 const pairWrites=pair.rowsWritten+decision.rowsWritten;
 const pairsPerCycle=Math.min(candidatePairsPerCycle,Math.floor(replaySqlCap/pairQueries));
 const deferredPerCycle=Math.max(0,candidatePairsPerCycle-pairsPerCycle);
 const replayPairs=cycles*pairsPerCycle;
 const outcomes=FT_REMOTE_MEASURED_20261022.outcome,retries=FT_REMOTE_MEASURED_20261022.exactOutcomeRetry,discovery=FT_REMOTE_MEASURED_20261022.discovery;
 const modeledReplayWrites=replayPairs*pairWrites+outcomesPerDay*outcomes.rowsWritten+retriesPerDay*retries.rowsWritten+discoveryPagesPerDay*discovery.rowsWritten;
 const modeledReplayReads=replayPairs*pairReads+outcomesPerDay*outcomes.rowsRead+retriesPerDay*retries.rowsRead+discoveryPagesPerDay*discovery.rowsRead;
 const modeledExtraSql=outcomesPerDay*outcomes.queries+retriesPerDay*retries.queries+discoveryPagesPerDay*discovery.queries;
 const modeledRowWriteOverLimit=modeledReplayWrites>CF_FREE_D1.rowsWrittenPerDay;
 const reasons=[];
 if(otherQueriesPerInvocation===null)reasons.push('UNMEASURED_TOTAL_WORKER_D1_QUERIES');
 else if(finiteNonnegative(otherQueriesPerInvocation,'otherQueriesPerInvocation')+replaySqlCap>CF_FREE_D1.maxQueriesPerInvocation)reasons.push('TOTAL_INVOCATION_QUERY_LIMIT_EXCEEDED');
 if(otherRowsWrittenPerDay===null)reasons.push('UNMEASURED_OTHER_D1_ROW_WRITES');
 else if(finiteNonnegative(otherRowsWrittenPerDay,'otherRowsWrittenPerDay')+modeledReplayWrites>CF_FREE_D1.rowsWrittenPerDay)reasons.push('DAILY_D1_ROW_WRITES_EXCEEDED');
 if(otherRowsReadPerDay===null)reasons.push('UNMEASURED_OTHER_D1_ROW_READS');
 else if(finiteNonnegative(otherRowsReadPerDay,'otherRowsReadPerDay')+modeledReplayReads>CF_FREE_D1.rowsReadPerDay)reasons.push('DAILY_D1_ROW_READS_EXCEEDED');
 if(!indexesVerified)reasons.push('REMOTE_INDEX_AND_LIVE_WORKLOAD_UNVERIFIED');
 if(modeledRowWriteOverLimit&&!reasons.includes('DAILY_D1_ROW_WRITES_EXCEEDED'))reasons.push('REPLAY_ALONE_EXCEEDS_D1_WRITES');
 reasons.push('REMOTE_REST_MEASUREMENT_NOT_WORKER_RUNTIME_VALIDATION');
 return {
  status:'NOT_CERTIFIED',scenarios_not_live:true,
  limits:CF_FREE_D1,cycles,pairsPerCycle,deferredPerCycle,replayPairs,
  pairCost:{queries:pairQueries,rowsRead:pairReads,rowsWritten:pairWrites},
  modeledReplayWrites,modeledReplayReads,modeledExtraSql,
  modeledRowWriteOverLimit,releaseGate:'BLOCKED',reasons:[...new Set(reasons)]
 };
}
