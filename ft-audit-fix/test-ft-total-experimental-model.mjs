// Synthetic fixtures test only the software contract. They are NOT real data,
// bookmaker prices, model accuracy, ROI or production certification.
import assert from 'node:assert/strict';
import {buildFTObservation} from './observation.mjs';
import {buildFTDecision} from './decision-trace.mjs';
import {prepareFTPair} from './ft-pair-collector.mjs';
import {createFTTotalCohort} from './ft-total-cohort.mjs';
import {trainFTTotalExperimental,predictFTTotalExperimental} from './ft-total-experimental-model.mjs';
let tests=0;
const test=async(name,fn)=>{await fn();tests++;console.log('PASS '+name)};
const day=86400000,base=Date.UTC(2025,0,1,12);
async function make(i,{minutes=60,extraGoals=null,liveGoals=null,leak=false,finalStatus='FT',sot=true}={}){
 const id=10000+i,t=base+i*day,minute=minutes;
 const home=liveGoals?.home??i%3,away=liveGoals?.away??i%2;
 const raw={fixture:{id,status:{short:'2H',elapsed:minute}},goals:{home,away},score:{fulltime:null}};
 const fixtureSource=leak?{...raw,score:{fulltime:{home:home+1,away}}}:raw;
 const stats=sot?[{team:{id:1},statistics:[{type:'Shots on Goal',value:3+i%4}]},
  {team:{id:2},statistics:[{type:'Shots on Goal',value:2+i%3}]}]:null;
 const sources={fixture:{status:'OK',received_at:t-2000,data:fixtureSource}};
 if(stats)sources.statistics={status:'OK',received_at:t-1000,data:stats};
 const o=buildFTObservation({id:id+':'+t,fixture_id:id,decision_at:t,fixture:raw,sources});
 const d=buildFTDecision({observation:o,decision_at:t+1000,state:'EVALUATED',evaluation:{score:52+i%40,scoreMode:'FULL'},source_hash:'a'.repeat(64)});
 const p=await prepareFTPair(o,d,20000);
 const remaining=extraGoals??i%4;
 const out={schema:'FT_OUTCOME_V2_DRAFT',observation_id:o.id,fixture_id:id,
  state:'RESOLVED',observed_at:t+7000000,resolved_at:t+8000000,
  settlement_basis:'FULL_MATCH_REGULATION',status:finalStatus,
  score:{home:home+remaining,away}};
 return {o,d,p,out};
}
const cohortRows=[];
for(let i=0;i<40;i++)cohortRows.push(await make(i));
const cohort=await createFTTotalCohort(cohortRows.map(x=>x.p),cohortRows.map(x=>x.out));
await test('40 synthetic fixtures form 40 independent rows',()=>{
 assert.equal(cohort.fixture_count,40);assert.equal(cohort.rows.length,40);
 assert.equal(cohort.status,'COHORT_ASSEMBLED_NOT_VALIDATED');
 assert.equal(cohort.market_prices_used,false);
});
await test('SOT is from predecision stats, never price',()=>{
 assert.equal(cohort.rows[0].shots_on_target_total,5);
 assert.equal(cohort.rows[1].shots_on_target_total,7);
 assert(!Object.keys(cohort.rows[0]).includes('odds'));
});
const report=await trainFTTotalExperimental(cohort);
await test('chronological train/test split has no future results',()=>{
 assert.equal(report.status,'OFFLINE_DIAGNOSTIC_ONLY');
 assert.equal(report.counts.train,30);assert.equal(report.counts.holdout,10);
 assert.equal(report.counts.purged,0);
 assert(report.counts.training_last_label_available_at<report.counts.split_decision_at);
 assert.equal(report.model.training_fixtures,30);
});
await test('candidate has real version and explicit blocked release',()=>{
 assert.match(report.model.model_version,/^FT_TOTAL_POISSON_3L_[a-f0-9]{16}$/);
 assert.equal(report.releaseGate,'BLOCKED_NO_REAL_OUT_OF_TIME_CALIBRATION');
 assert.equal(report.calibration_verified,false);
 assert.equal(report.real_world_predictive_edge_verified,false);
});
await test('holdout diagnostics are finite and compare to train-only null model',()=>{
 for(const k of ['mean_poisson_neg_log_likelihood','mean_brier_over_2_5']){
  assert(Number.isFinite(report.holdout_metrics[k]));
  assert(Number.isFinite(report.null_poisson_metrics[k]));
 }
 assert(Number.isFinite(report.improvement_in_logloss));
});
await test('candidate prediction is a finite PMF for final match total',()=>{
 const row=cohort.rows[32],p=predictFTTotalExperimental(report.model,row);
 assert.equal(p.status,'OFFLINE_UNCALIBRATED_PMF');
 assert.equal(p.pricing_eligible,false);assert.equal(p.distribution[0].finalTotalGoals,row.live_goals);
 const probSum=p.distribution.reduce((a,v)=>a+v.probability,0);
 assert(Math.abs(probSum-1)<1e-9);
 assert(p.distribution.every(x=>Number.isFinite(x.probability)&&x.probability>=0));
});
await test('model cannot predict retrospectively with later trained outcomes',()=>{
 assert.equal(predictFTTotalExperimental(report.model,cohort.rows[0]).status,'NOT_ELIGIBLE');
 assert.equal(predictFTTotalExperimental(report.model,{...cohort.rows[32],decision_at:report.model.trained_until}).status,'NOT_ELIGIBLE');
});
await test('fixture repeated snapshots are deduplicated for independent cohort',async()=>{
 const duplicate=await make(3);
 const x=await createFTTotalCohort([...cohortRows.map(z=>z.p),duplicate.p],
  [...cohortRows.map(z=>z.out),duplicate.out]);
 assert.equal(x.fixture_count,40);
 assert(x.issues.some(y=>y.reason==='DUPLICATE_PAIR_ID'));
});
await test('different observation IDs same fixture avoid same-fixture train/test leakage',async()=>{
 const src=cohortRows[2],o={...structuredClone(src.o),id:'2:later-snapshot',decision_at:src.o.decision_at+500};
 const d=buildFTDecision({observation:o,decision_at:o.decision_at+1000,state:'NOT_EVALUATED',reason:'NO_EVALUATION',source_hash:'c'.repeat(64)});
 const p=await prepareFTPair(o,d,20000);
 const result={...src.out,observation_id:o.id,observed_at:src.out.observed_at+10,resolved_at:src.out.resolved_at+10};
 const x=await createFTTotalCohort([...cohortRows.map(z=>z.p),p],[...cohortRows.map(z=>z.out),result]);
 assert.equal(x.fixture_count,40);
 assert(x.issues.some(y=>y.reason==='LATER_SNAPSHOT_SAME_FIXTURE_EXCLUDED_FROM_INDEPENDENT_COHORT'));
});
await test('hidden future score in source fixture is quarantined',async()=>{
 const x=await make(97,{leak:true});
 const y=await createFTTotalCohort([x.p],[x.out]);
 assert.equal(y.rows.length,0);assert.equal(y.fixture_count,0);
 assert(y.issues.some(z=>/SOURCE_FIXTURE_FUTURE_LABEL/.test(z.reason)));
});
await test('canceled match is not a label or losing prediction',async()=>{
 const x=await make(98,{finalStatus:'CANC'});
 const y=await createFTTotalCohort([x.p],[x.out]);
 assert.equal(y.rows.length,0);
 assert(y.issues.some(z=>z.reason==='AMBIGUOUS_OR_INVALID_FINAL_OUTCOME'));
});
await test('missing outcome is not silently a losing sample',async()=>{
 const x=await make(99);
 const y=await createFTTotalCohort([x.p],[]);
 assert.equal(y.rows.length,0);
 assert(y.issues.some(z=>z.reason==='OUTCOME_PENDING_NOT_NEGATIVE_LABEL'));
});
await test('final score correction below live score excluded',async()=>{
 const x=await make(100,{liveGoals:{home:2,away:1}});
 x.out.score={home:1,away:1};
 const y=await createFTTotalCohort([x.p],[x.out]);
 assert.equal(y.rows.length,0);
 assert(y.issues.some(z=>z.reason==='INVALID_LIVE_OR_CORRECTED_SCORE'));
});
await test('two contradictory final revisions at same time are excluded',async()=>{
 const x=await make(101),other={...x.out,score:{...x.out.score,home:x.out.score.home+1}};
 const y=await createFTTotalCohort([x.p],[x.out,other]);
 assert.equal(y.rows.length,0);
 assert(y.issues.some(z=>z.reason==='AMBIGUOUS_OR_INVALID_FINAL_OUTCOME'));
});
await test('training purges outcomes unavailable by first future decision',async()=>{
 const x=structuredClone(cohort);
 x.rows[22].label_available_at=x.rows[34].decision_at+10000;
 const rr=await trainFTTotalExperimental(x);
 assert.equal(rr.status,'OFFLINE_DIAGNOSTIC_ONLY');
 assert.equal(rr.counts.purged,1);
 assert.equal(rr.counts.train,29);
});
await test('market price manipulation does not change trained model version',async()=>{
 const x=structuredClone(cohort);
 for(const r of x.rows)r.market_quote={over:1.01,under:10000};
 const rr=await trainFTTotalExperimental(x);
 assert.equal(rr.model.model_version,report.model.model_version);
 assert.deepEqual(rr.model.coeffs,report.model.coeffs);
});
await test('same fixture in training twice rejected, never split across folds',async()=>{
 const x=structuredClone(cohort);x.rows[9].fixture_id=x.rows[8].fixture_id;
 await assert.rejects(()=>trainFTTotalExperimental(x),/INVALID_OR_REPEATED_FIXTURE/);
});
await test('too-small cohort cannot become a model',async()=>{
 const x={...cohort,rows:cohort.rows.slice(0,8)};
 const rr=await trainFTTotalExperimental(x);
 assert.equal(rr.model,null);assert.equal(rr.releaseGate,'BLOCKED');
});
await test('training is deterministic on identical frozen verified rows',async()=>{
 const rr=await trainFTTotalExperimental(cohort);
 assert.equal(rr.model.model_version,report.model.model_version);
 assert.deepEqual(rr.model.coeffs,report.model.coeffs);
});
await test('model cannot price from future or invalid match state',()=>{
 const bad={...cohort.rows[35],shots_on_target_total:-1};
 assert.equal(predictFTTotalExperimental(report.model,bad).status,'NOT_ELIGIBLE');
});
console.log('FT_TOTAL_3L_EXPERIMENTAL_OFFLINE_PASS '+JSON.stringify({tests,
 synthetic_cases:40,actual_production_data:0,actual_forecast_accuracy_certified:false,
 model_release:'BLOCKED',ht_hc_changed:false,d1_writes:0,provider_calls:0}));
