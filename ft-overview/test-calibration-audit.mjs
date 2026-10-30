import assert from 'node:assert/strict';
import {auditFTCalibration} from './calibration-audit.mjs';
const a=Date.UTC(2026,9,24,10),r=(id,p=.6,win=true)=>({
 fixture_id:id,decision_at:a,model_generated_at:a,source_received_at:a-1000,outcome_received_at:a+3600000,
 score:{home:1,away:0},final_score:{home:win?2:1,away:0},line:1.5,market_odds:2.1,
 remaining_goals_pmf:[1-p,p],settlement_basis:'FULL_MATCH_REGULATION',
 observed_stats:[{received_at:a-5000}]});
const z=auditFTCalibration([],{});assert.equal(z.status,'INSUFFICIENT_OBSERVED_OUTCOMES');assert.equal(z.brier,null);
const x=auditFTCalibration([r(1),r(2,.4,false)],{minSamples:2});
assert.equal(x.status,'MEASURED_UNCALIBRATED');assert.equal(x.sample,2);assert.ok(Math.abs(x.brier-.16)<1e-10);
assert.equal(x.model_calibrated,false);
assert.equal(auditFTCalibration([r(1),r(1)],{minSamples:2}).excluded[0].reason,'DUPLICATE_FIXTURE');
assert.equal(auditFTCalibration([{...r(1),outcome_received_at:a-1}]).excluded[0].reason,'OUTCOME_NOT_AFTER_DECISION');
assert.equal(auditFTCalibration([{...r(1),model_generated_at:a+1}]).excluded[0].reason,'MODEL_ASOF_MISMATCH');
assert.equal(auditFTCalibration([{...r(1),source_received_at:a+1}]).excluded[0].reason,'FUTURE_OR_UNKNOWN_SOURCE');
assert.equal(auditFTCalibration([{...r(1),observed_stats:[{received_at:a+1}]}]).excluded[0].reason,'FUTURE_OR_UNKNOWN_STATS');
assert.equal(auditFTCalibration([{...r(1),line:1.75}]).excluded[0].reason,'NON_BINARY_LINE');
assert.equal(auditFTCalibration([{...r(1),final_score:null}]).excluded[0].reason,'MISSING_REGULATION_FINAL');
assert.equal(auditFTCalibration([{...r(1),market_odds:null}]).excluded[0].reason,'UNVERIFIED_MARKET_ODDS');
console.log('FT_V2_CALIBRATION_AUDIT_PASS — zero fabricated outcomes');
