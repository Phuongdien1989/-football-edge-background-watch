import assert from 'node:assert/strict';
import {makeFTV2CohortReport} from './cohort-report.mjs';
const report=makeFTV2CohortReport({pairs:[],outcomes:[],forecasts:[]});
assert.equal(report.status,'INSUFFICIENT_OBSERVED_OUTCOMES');
assert.equal(report.sample,0);
assert.equal(report.performance_claim_permitted,false);
assert.equal(report.groups.length,13);
assert.ok(report.groups.every(x=>x.n===0&&x.validated===false));
console.log('FT_V2_COHORT_EMPTY_PASS: no observed sample or performance claim');
const at=Date.UTC(2026,9,24,10);
const obs={id:'obs-cohort',fixture_id:555,decision_at:at,fixture:{fixture:{id:555},goals:{home:1,away:0}},sources:{fixture:{received_at:at-1000}}};
const packet={pairs:[{fixture_id:555,observation_json:JSON.stringify(obs),decision_json:JSON.stringify({observation_id:obs.id,fixture_id:555,decision_at:at})}],
 outcomes:[{schema:'FT_OUTCOME_V2_DRAFT',state:'RESOLVED',observation_id:obs.id,fixture_id:555,observed_at:at+3600000,status:'FT',score:{home:2,away:0}}],
 forecasts:[{fixture_id:555,observation_id:obs.id,decision_at:at,model_generated_at:at,source_received_at:at-1000,remaining_goals_pmf:[.4,.6],observed_stats:[{received_at:at-2000}],line:1.5,market_odds:2.1,settlement_basis:'FULL_MATCH_REGULATION',minute:65,live_signal:'CHANCES_ADDED'}]};
const accepted=makeFTV2CohortReport(packet);
assert.equal(accepted.sample,1);
assert.equal(accepted.groups.filter(g=>g.dimension==='EV').reduce((n,g)=>n+g.n,0),1);
const bad=structuredClone(packet);bad.forecasts[0].market_odds=null;
const rejected=makeFTV2CohortReport(bad);
assert.equal(rejected.sample,0);
assert.equal(rejected.groups.reduce((n,g)=>n+g.n,0),0);
assert.equal(rejected.excluded[0].reason,'UNVERIFIED_MARKET_ODDS');
console.log('FT_V2_COHORT_ACCEPTED_SET_PARITY_PASS');
