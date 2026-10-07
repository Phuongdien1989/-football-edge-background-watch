import assert from 'node:assert/strict';
import {buildObservationEnvelope,filterSourcesAtCutoff,STRICT_VALID,UNKNOWN_PROVENANCE,AFTER_CUTOFF} from './observation-contract.js';
import {resolveStrictGoalWindows} from './strict-outcome-resolver.js';
import {evaluateActualMarkets,EXPERIMENTAL_MARKET_FRESHNESS_POLICY} from './opportunity-ranking.js';
import {createPaperMarketRecord,settlePaperMarketRecord} from './paper-market-evidence.js';
import {buildValidationReport} from './validation-report.js';

const cutoff='2026-10-07T10:01:00.000Z';
const goodSources=[
  {kind:'LIVE_STATISTICS',sourceId:'stats-1',receivedAt:'2026-10-07T10:00:45.000Z',payloadHash:'s1'},
  {kind:'CONTEXT',sourceId:'ctx-1',receivedAt:'2026-10-07T09:59:00.000Z',payloadHash:'c1'}
];
const strictObs=buildObservationEnvelope({fixtureId:1,engine:'H1',marketPeriod:'H1',target:{kind:'PERIOD_SCORE_DISTRIBUTION',period:'H1'},
  state:{minute:30,score_home:0,score_away:0,status:'1H'},evaluationCutoff:cutoff,sourceRefs:goodSources,
  predictionCreatedAt:'2026-10-07T10:01:00.100Z',persistedAt:'2026-10-07T10:01:00.500Z',persistenceAckId:'ack-1',modelVersion:'TEST',configVersion:'TEST'});
assert.equal(strictObs.strict_replay_status,STRICT_VALID);
assert.equal(strictObs.strict_metrics_eligible,true);

const after=buildObservationEnvelope({fixtureId:2,engine:'FT',marketPeriod:'FT',state:{minute:60,score_home:0,score_away:0},evaluationCutoff:cutoff,
  sourceRefs:[{kind:'LIVE_STATISTICS',receivedAt:'2026-10-07T10:01:01.000Z'}],predictionCreatedAt:'2026-10-07T10:01:00.100Z'});
assert.equal(after.strict_replay_status,AFTER_CUTOFF);assert.equal(after.strict_replay_eligible,false);
const missing=buildObservationEnvelope({fixtureId:3,engine:'FT',marketPeriod:'FT',state:{minute:60,score_home:0,score_away:0},evaluationCutoff:cutoff,
  sourceRefs:[{kind:'LIVE_STATISTICS',receivedAt:null}],predictionCreatedAt:'2026-10-07T10:01:00.100Z'});
assert.equal(missing.strict_replay_status,UNKNOWN_PROVENANCE);assert.equal(missing.strict_replay_eligible,false);
assert.equal(missing.persisted_at,null);assert.equal(missing.persistence_status,'UNVERIFIED');
const filt=filterSourcesAtCutoff([{kind:'A',received_at:'2026-10-07T10:00:59Z'},{kind:'B',received_at:'2026-10-07T10:01:01Z'}],cutoff);
assert.equal(filt.accepted.length,1);assert.equal(filt.rejected[0].replay_status,AFTER_CUTOFF);

const obsA=buildObservationEnvelope({fixtureId:4,engine:'FT',marketPeriod:'FT',state:{minute:60,score_home:0,score_away:0},evaluationCutoff:cutoff,sourceRefs:goodSources,predictionCreatedAt:cutoff});
const obsB=buildObservationEnvelope({fixtureId:4,engine:'FT',marketPeriod:'FT',state:{minute:60,score_home:0,score_away:0},evaluationCutoff:cutoff,sourceRefs:[...goodSources].reverse(),predictionCreatedAt:cutoff});
assert.equal(obsA.input_fingerprint,obsB.input_fingerprint);

const baseRow={fixture_id:9,engine:'FT',market_period:'FT',minute:60,score_home:0,score_away:0,p_goal_5m:40,p_goal_10m:60,p_goal_15m:70,
  observation:{...strictObs,market_period:'FT',strict_metrics_eligible:true},strict_replay_status:STRICT_VALID,persistence_status:'ACKNOWLEDGED',strict_metrics_eligible:true,
  outcome:{revision:0,goal_5m:null,goal_10m:null,goal_15m:null,first_goal_min:null,first_goal_interval:null,settled:false,status:'OPEN',history:[]}};

const lateExact=resolveStrictGoalWindows(baseRow,{events:[{type:'Goal',time:{elapsed:63},received_at:'2026-10-07T10:10:00Z'}],
  currentSnapshot:{minute:69,goals:{home:1,away:0},received_at:'2026-10-07T10:10:00Z'}});
assert.equal(lateExact.outcome.goal_5m,true);assert.equal(lateExact.outcome.first_goal_min,63);

const intervalOnly=resolveStrictGoalWindows(baseRow,{snapshots:[{minute:69,goals:{home:1,away:0},received_at:'2026-10-07T10:10:00Z'}]});
assert.equal(intervalOnly.outcome.goal_5m,null);assert.equal(intervalOnly.outcome.window_status.goal_5m,'UNRESOLVED');
assert.equal(intervalOnly.outcome.goal_10m,true);assert.equal(intervalOnly.outcome.goal_15m,true);assert.equal(intervalOnly.outcome.first_goal_min,null);
assert.deepEqual(intervalOnly.outcome.first_goal_interval,{after_min:60,before_or_at_min:69});

const snaps=[{minute:64,goals:{home:0,away:0},received_at:'2026-10-07T10:05:00Z'},{minute:69,goals:{home:1,away:0},received_at:'2026-10-07T10:10:00Z'}];
const evs=[{type:'Goal',time:{elapsed:67},received_at:'2026-10-07T10:11:00Z'}];
const rr1=resolveStrictGoalWindows(baseRow,{snapshots:snaps,events:evs});
const rr2=resolveStrictGoalWindows(baseRow,{snapshots:[...snaps].reverse(),events:[...evs].reverse()});
assert.deepEqual({g5:rr1.outcome.goal_5m,g10:rr1.outcome.goal_10m,g15:rr1.outcome.goal_15m,min:rr1.outcome.first_goal_min},
  {g5:rr2.outcome.goal_5m,g10:rr2.outcome.goal_10m,g15:rr2.outcome.goal_15m,min:rr2.outcome.first_goal_min});

const predictionH1={engine:'H1',live_update:{effective_lambda_90:3},base:{lambda_match:2.4},direction:{home_given_goal:.55},confidence:{value:.8}};
const marketRows=[
 {category:'over_under',market:'Goals Over/Under',market_period:'FT',received_at:'2026-10-07T10:00:40Z',update:'2026-10-07T10:00:35Z',values:[{value:'Over 2.5',handicap:2.5,odd:2.0,main:true},{value:'Under 2.5',handicap:2.5,odd:1.8,main:true}]},
 {category:'over_under',market:'Goals Over/Under - First Half',market_period:'H1',received_at:'2026-10-07T10:00:40Z',update:'2026-10-07T10:00:35Z',values:[{value:'Over 0.5',handicap:.5,odd:1.95,main:true},{value:'Under 0.5',handicap:.5,odd:1.85,main:true}]},
 {category:'over_under',market:'Goals Over/Under - Second Half',market_period:'H2',received_at:'2026-10-07T10:00:40Z',update:'2026-10-07T10:00:35Z',values:[{value:'Over 0.5',handicap:.5,odd:1.9,main:true},{value:'Under 0.5',handicap:.5,odd:1.9,main:true}]}
];
const h1Pricing=evaluateActualMarkets({prediction:predictionH1,state:{minute:30,score_home:0,score_away:0},marketRows,targetPeriod:'H1',evaluationCutoff:cutoff,strictMarket:true});
assert.ok(h1Pricing.offers.length===2&&h1Pricing.offers.every(x=>x.market_period==='H1'));
assert.ok(h1Pricing.best);assert.ok(h1Pricing.rejection_reasons.includes('PERIOD_MISMATCH'));
const h2Pricing=evaluateActualMarkets({prediction:predictionH1,state:{minute:55,score_home:0,score_away:0},marketRows,targetPeriod:'H2',evaluationCutoff:cutoff,strictMarket:true});
assert.equal(h2Pricing.best,null);assert.equal(h2Pricing.pricing_compatibility.supported,false);

const unknownRows=[{category:'over_under',market:'Special Goal Total',received_at:'2026-10-07T10:00:40Z',update:'2026-10-07T10:00:35Z',values:[{value:'Over 0.5',handicap:.5,odd:2.0}]}];
const unknown=evaluateActualMarkets({prediction:{...predictionH1,engine:'FT'},state:{minute:60,score_home:0,score_away:0},marketRows:unknownRows,targetPeriod:'FT',evaluationCutoff:cutoff,strictMarket:true});
assert.equal(unknown.best,null);assert.ok(unknown.rejection_reasons.includes('UNKNOWN_PERIOD'));
const staleRows=[{category:'over_under',market:'Goals Over/Under',market_period:'FT',received_at:'2026-10-07T10:00:40Z',update:'2026-10-07T09:55:00Z',values:[{value:'Over 0.5',handicap:.5,odd:2.0}]}];
const stale=evaluateActualMarkets({prediction:{...predictionH1,engine:'FT'},state:{minute:60,score_home:0,score_away:0},marketRows:staleRows,targetPeriod:'FT',evaluationCutoff:cutoff,strictMarket:true,freshnessPolicy:EXPERIMENTAL_MARKET_FRESHNESS_POLICY});
assert.equal(stale.best,null);assert.ok(stale.rejection_reasons.includes('STALE_MARKET'));
assert.equal(createPaperMarketRecord({fixtureId:1,state:{minute:60},bestMarket:{market:'TOTAL',selection:'OVER',line:.5,odds:2,edge:{valid:true}},strict:true}),null);

const h1Paper=createPaperMarketRecord({fixtureId:1,capturedAt:Date.parse(cutoff),state:{minute:30,score_home:0,score_away:0},bestMarket:h1Pricing.best,
  marketPeriod:'H1',targetPeriod:'H1',evaluationCutoff:cutoff,observation:strictObs,strict:true,confidence:80});
assert.ok(h1Paper&&!h1Paper.settled);
const wrongPeriod=settlePaperMarketRecord(h1Paper,{periodResult:{period:'FT',home:2,away:1,confirmed:true,status:'FT'},status:'FT'});
assert.equal(wrongPeriod.settled,false);
const rightPeriod=settlePaperMarketRecord(h1Paper,{periodResult:{period:'H1',home:1,away:0,confirmed:true,status:'HT',provenance_status:'STRICT_VALID',received_at:'2026-10-07T10:50:00Z'},status:'HT'});
assert.equal(rightPeriod.settled,true);assert.equal(rightPeriod.final_home,1);assert.equal(rightPeriod.final_away,0);
const unprovenPeriod=settlePaperMarketRecord({...h1Paper,id:'h1-unproven'},{periodResult:{period:'H1',home:1,away:0,confirmed:true,status:'HT'}});
assert.equal(unprovenPeriod.settled,true);assert.equal(unprovenPeriod.strict_metrics_eligible,false);assert.equal(unprovenPeriod.settlement_provenance_status,'UNKNOWN_PROVENANCE');

const h2Legacy={...h1Paper,id:'h2-test',market_period:'H2',settled:false,settlement_state:'OPEN',settlement_revision:0,settlement_history:[]};
assert.equal(settlePaperMarketRecord(h2Legacy,{periodResult:{period:'FT',home:3,away:1,confirmed:true,status:'FT'}}).settled,false);
const h2Settled=settlePaperMarketRecord(h2Legacy,{periodResult:{period:'H2',home:2,away:1,confirmed:true,status:'FT',provenance_status:'STRICT_VALID',received_at:'2026-10-07T12:00:00Z'}});
assert.equal(h2Settled.settled,true);assert.equal(h2Settled.final_home,2);assert.equal(h2Settled.final_away,1);
for(const terminalStatus of ['CANC','PST','ABD']){
  const voided=settlePaperMarketRecord({...h1Paper,id:'void-'+terminalStatus},{status:terminalStatus});
  assert.equal(voided.settled,true);assert.equal(voided.settlement_state,'VOID');assert.equal(voided.realized_return,null);
}

const beforePrediction=JSON.stringify({p5:baseRow.p_goal_5m,p10:baseRow.p_goal_10m,p15:baseRow.p_goal_15m,obs:baseRow.observation.input_fingerprint});
const initiallyFalse=resolveStrictGoalWindows(baseRow,{snapshots:[{minute:66,goals:{home:0,away:0},received_at:'2026-10-07T10:07:00Z'}]});
assert.equal(initiallyFalse.outcome.goal_5m,false);
const corrected=resolveStrictGoalWindows(initiallyFalse,{events:[{type:'Goal',time:{elapsed:63},received_at:'2026-10-07T10:12:00Z'}],snapshots:[{minute:69,goals:{home:1,away:0},received_at:'2026-10-07T10:10:00Z'}]});
assert.equal(corrected.outcome.goal_5m,true);assert.ok(corrected.outcome.revision>initiallyFalse.outcome.revision);assert.ok(corrected.outcome.history.length>=2);
assert.equal(JSON.stringify({p5:corrected.p_goal_5m,p10:corrected.p_goal_10m,p15:corrected.p_goal_15m,obs:corrected.observation.input_fingerprint}),beforePrediction);

const strictMetricRow={...baseRow,id:'strict-1',observation_id:'strict-1',strict_metrics_eligible:true,outcome:{...lateExact.outcome,goal_5m:true,goal_10m:true,goal_15m:true,settled:true,strict_outcome_eligible:true}};
const legacyRow={...baseRow,id:'legacy-1',observation:null,observation_id:null,strict_metrics_eligible:false,outcome:{goal_5m:true,goal_10m:true,goal_15m:true,settled:true}};
const strictReport=buildValidationReport({prediction:[strictMetricRow,legacyRow],paired:[],paper:[]},{strictMode:true});
assert.equal(strictReport.calibration.goal_10m.n,1);assert.equal(strictReport.quarantine.prediction.excluded,1);

console.log('Batch02 strict observation/market/outcome tests PASS');