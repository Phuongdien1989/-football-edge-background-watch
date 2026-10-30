// Offline replay entrypoint for explicitly exported D1 rows.
// Usage: node ft-audit-fix/ft-total-offline-replay.mjs INPUT.json OUTPUT.json
// INPUT: {pair_rows:[hash-verified pair-table rows],
//         outcome_ledger_rows:[immutable ft_replay_records_v1 OUTCOME rows]}
// NO Cloudflare API token; NO D1 queries, deployments, scanner or provider calls.
import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {dirname} from 'node:path';
import {createFTTotalCohort} from './ft-total-cohort.mjs';
import {verifyFTOutcomeExport} from './ft-total-outcome-export.mjs';
import {trainFTTotalExperimental} from './ft-total-experimental-model.mjs';
const [inputPath,outputPath]=process.argv.slice(2);
if(!inputPath||!outputPath||inputPath===outputPath)throw Error('EXPLICIT_DIFFERENT_INPUT_AND_OUTPUT_REQUIRED');
if(statSync(inputPath).size>30_000_000)throw Error('EXPORT_TOO_LARGE_FOR_BOUNDED_OFFLINE_RUN');
const src=JSON.parse(readFileSync(inputPath,'utf8'));
if(!Array.isArray(src?.pair_rows)||!Array.isArray(src?.outcome_ledger_rows))throw Error('PAIR_AND_OUTCOME_EXPORT_REQUIRED');
if(src.pair_rows.length>8000||src.outcome_ledger_rows.length>16000)throw Error('OFFLINE_EXPORT_ROW_LIMIT');
const verified=await verifyFTOutcomeExport(src.outcome_ledger_rows);
const report={
 schema:'FT_TOTAL_3L_REPLAY_RUN',at:new Date().toISOString(),
 scope:'LOCAL_JSON_EXPORT_ONLY',provider_requests:0,d1_queries:0,d1_writes:0,
 production_changes:0,ht_hc_changes:0,releaseGate:'BLOCKED',
 source_attestation:'UNVERIFIED_EXTERNAL_EXPORT_ORIGIN',
 input:{pair_rows:src.pair_rows.length,verified_outcome_rows:verified.verified_rows,
  excluded_outcome_rows:verified.issues.length},
};
if(verified.issues.length){
 report.status='EXPORT_INTEGRITY_BLOCKED';
 report.outcome_errors=verified.issues;
}else{
 const cohort=await createFTTotalCohort(src.pair_rows,verified.verified_outcomes);
 const evaluation=await trainFTTotalExperimental(cohort);
 report.status=evaluation.status;
 report.cohort={fixture_count:cohort.fixture_count,issue_count:cohort.issues.length,
  issues_by_reason:cohort.issues.reduce((a,x)=>(a[x.reason]=(a[x.reason]||0)+1,a),{}),
  source:'IMMUTABLE_HASH_VERIFIED_PAIRS_AND_OUTCOMES'};
 report.model=evaluation.model;
 report.counts=evaluation.counts??null;
 report.holdout_metrics=evaluation.holdout_metrics??null;
 report.null_poisson_metrics=evaluation.null_poisson_metrics??null;
 report.improvement_in_logloss=evaluation.improvement_in_logloss??null;
 report.calibration_verified=false;
 report.real_world_predictive_edge_verified=false;
 report.reason='Model prototype not calibrated on independently verified real chronological fixtures; NEVER promote solely based on CI.';
}
mkdirSync(dirname(outputPath),{recursive:true});
writeFileSync(outputPath,JSON.stringify(report,null,2));
console.log('FT_TOTAL_3L_OFFLINE_REPLAY '+JSON.stringify({status:report.status,pairs:report.input.pair_rows,
 verified_outcomes:report.input.verified_outcome_rows,excluded_outcomes:report.input.excluded_outcome_rows,
 train:report.counts?.train??0,holdout:report.counts?.holdout??0,releaseGate:report.releaseGate}));
if(report.status==='EXPORT_INTEGRITY_BLOCKED')process.exitCode=2;
