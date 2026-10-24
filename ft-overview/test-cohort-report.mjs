import assert from 'node:assert/strict';
import {makeFTV2CohortReport} from './cohort-report.mjs';
const report=makeFTV2CohortReport({pairs:[],outcomes:[],forecasts:[]});
assert.equal(report.status,'INSUFFICIENT_OBSERVED_OUTCOMES');
assert.equal(report.sample,0);
assert.equal(report.performance_claim_permitted,false);
assert.equal(report.groups.length,13);
assert.ok(report.groups.every(x=>x.n===0&&x.validated===false));
console.log('FT_V2_COHORT_EMPTY_PASS: no observed sample or performance claim');