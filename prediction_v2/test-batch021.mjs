import assert from 'node:assert/strict';
import {
  buildSourceReference,buildObservationEnvelope,buildGoalWindowTarget,buildPersistenceAcknowledgement,withPersistenceAcknowledgement,
  validatePersistenceAcknowledgement,STRICT_VALID,UNKNOWN_PROVENANCE,CONFLICTING_PROVENANCE,PERSISTENCE_ACKNOWLEDGED
} from './observation-contract.js';
import {resolveStrictGoalWindows} from './strict-outcome-resolver.js';
import {buildValidationReport} from './validation-report.js';
import {createPaperMarketRecord,settlePaperMarketRecord} from './paper-market-evidence.js';
import {buildPairedObservation} from './old-vs-new-comparator.js';

const cutoff='2026-10-07T10:01:00.000Z';
const srcRaw={sourceId:'raw-1',requestId:'req-1',payloadHash:'hash-1',kind:'LIVE_STATISTICS',provider:'API_FOOTBALL',receivedAt:'2026-10-07T10:00:59Z',providerUpdatedAt:'2026-10-07T10:00:58Z'};
const ref=buildSourceReference(srcRaw);
assert.equal(ref.received_at,'2026-10-07T10:00:59.000Z');
const ref2=buildSourceReference(ref);assert.deepEqual(ref2,ref);
const ref3=buildSourceReference(JSON.parse(JSON.stringify(ref)));assert.deepEqual(ref3,ref);
const roundtripObs=buildObservationEnvelope({fixtureId:1,engine:'FT',marketPeriod:'FT',state:{minute:60,score_home:0,score_away:0,status:'2H'},evaluationCutoff:cutoff,sourceRefs:[ref],predictionCreatedAt:cutoff,featurePacket:{x:1},predictionPayload:{p:50}});
assert.equal(roundtripObs.source_references[0].received_at,'2026-10-07T10:00:59.000Z');assert.equal(roundtripObs.strict_replay_status,STRICT_VALID);
const conflict=buildSourceReference({...srcRaw,received_at:'2026-10-07T10:01:01Z'});assert.equal(conflict.received_at,null);assert.equal(conflict.provenance_status,CONFLICTING_PROVENANCE);assert.equal(conflict.received_at_candidates.length,2);
const conflictObs=buildObservationEnvelope({fixtureId:2,engine:'FT',marketPeriod:'FT',state:{minute:60},evaluationCutoff:cutoff,sourceRefs:[conflict],predictionCreatedAt:cutoff,featurePacket:{x:1},predictionPayload:{p:50}});assert.equal(conflictObs.strict_replay_status,CONFLICTING_PROVENANCE);assert.equal(conflictObs.strict_replay_eligible,false);

function makeObserved({fixtureId=10,engine='FT',minute=60,scoreHome=0,scoreAway=0,feature={shots:10},prediction={p:55},created='2026-10-07T10:01:00.100Z'}={}){
  const raw=buildObservationEnvelope({fixtureId,engine,marketPeriod:engine,state:{minute,score_home:scoreHome,score_away:scoreAway,status:engine==='H1'?'1H':'2H'},evaluationCutoff:cutoff,
    sourceRefs:[srcRaw],predictionCreatedAt:created,modelVersion:'TEST',configVersion:'TEST',featurePacket:feature,predictionPayload:prediction,target:buildGoalWindowTarget({engine,minute})});
  const ack=buildPersistenceAcknowledgement({subject:raw,persistedAt:'2026-10-07T10:01:00.500Z',ackId:`ack-${fixtureId}`,source:'TEST_SERVER_ADAPTER',ackOrigin:'SERVER',serverVerified:true});
  const obs=withPersistenceAcknowledgement(raw,ack);assert.equal(obs.persistence_status,PERSISTENCE_ACKNOWLEDGED);return obs;
}
const fpA=makeObserved({fixtureId:20,feature:{shots:10},prediction:{p:55}}),fpFeature=makeObserved({fixtureId:20,feature:{shots:11},prediction:{p:55}}),fpPrediction=makeObserved({fixtureId:20,feature:{shots:10},prediction:{p:56}});
assert.equal(fpA.input_fingerprint,fpFeature.input_fingerprint);assert.notEqual(fpA.feature_fingerprint,fpFeature.feature_fingerprint);assert.notEqual(fpA.content_fingerprint,fpFeature.content_fingerprint);
assert.equal(fpA.input_fingerprint,fpPrediction.input_fingerprint);assert.equal(fpA.feature_fingerprint,fpPrediction.feature_fingerprint);assert.notEqual(fpA.prediction_fingerprint,fpPrediction.prediction_fingerprint);assert.notEqual(fpA.content_fingerprint,fpPrediction.content_fingerprint);
const oldAck=fpA.persistence_ack;const ackAgainstChanged=validatePersistenceAcknowledgement(fpFeature,oldAck);assert.equal(ackAgainstChanged.valid,false);assert.ok(ackAgainstChanged.reasons.includes('ACK_CONTENT_FINGERPRINT_MISMATCH'));
const noId=withPersistenceAcknowledgement(roundtripObs,buildPersistenceAcknowledgement({subject:roundtripObs,persistedAt:'2026-10-07T10:01:00.500Z',source:'SERVER',ackOrigin:'SERVER',serverVerified:true}));assert.notEqual(noId.persistence_status,PERSISTENCE_ACKNOWLEDGED);
const mock=withPersistenceAcknowledgement(roundtripObs,buildPersistenceAcknowledgement({subject:roundtripObs,persistedAt:'2026-10-07T10:01:00.500Z',ackId:'mock-1',source:'LOCAL_TEST',ackOrigin:'MOCK'}));assert.notEqual(mock.persistence_status,PERSISTENCE_ACKNOWLEDGED);

// Stoppage-time clock is factual, but B3 near-boundary model horizons remain incompatible with rolling +N metrics.
const h1Obs=makeObserved({fixtureId:30,engine:'H1',minute:43});
const h1Row={fixture_id:30,engine:'H1',market_period:'H1',minute:43,score_home:0,score_away:0,p_goal_5m:40,p_goal_10m:50,p_goal_15m:55,observation_id:h1Obs.observation_id,observation:h1Obs,input_fingerprint:h1Obs.input_fingerprint,content_fingerprint:h1Obs.content_fingerprint,strict_metrics_eligible:null,outcome:{revision:0,history:[]}};
const stoppage=resolveStrictGoalWindows(h1Row,{events:[{id:'g1',period:'H1',type:'Goal',time:{elapsed:45,extra:2},received_at:'2026-10-07T10:05:00Z'}]});
assert.equal(stoppage.outcome.first_goal_clock.period,'H1');assert.equal(stoppage.outcome.first_goal_clock.display,'45+2');assert.equal(stoppage.outcome.goal_5m,true);assert.equal(stoppage.outcome.window_evidence.goal_5m.model_target_compatible,false);assert.equal(stoppage.outcome.window_evidence.goal_5m.metric_eligible,false);
const h2At47=resolveStrictGoalWindows(h1Row,{events:[{id:'g-h2',period:'H2',type:'Goal',time:{elapsed:47},received_at:'2026-10-07T10:05:00Z'}]});assert.equal(h2At47.outcome.first_goal_clock??null,null);assert.equal(h2At47.outcome.goal_5m,null);
const censored=resolveStrictGoalWindows(h1Row,{currentSnapshot:{period:'H1',minute:45,extra:2,status:'HT',goals:{home:0,away:0},received_at:'2026-10-07T10:05:00Z'},ended:true});assert.equal(censored.outcome.window_status.goal_5m,'CENSORED');
const h1m40Obs=makeObserved({fixtureId:31,engine:'H1',minute:40});const h1m40={...h1Row,fixture_id:31,minute:40,observation_id:h1m40Obs.observation_id,observation:h1m40Obs,input_fingerprint:h1m40Obs.input_fingerprint,content_fingerprint:h1m40Obs.content_fingerprint};
const maturedAtHt=resolveStrictGoalWindows(h1m40,{currentSnapshot:{period:'H1',minute:45,extra:2,status:'HT',goals:{home:0,away:0},received_at:'2026-10-07T10:06:00Z'},ended:true});assert.equal(maturedAtHt.outcome.goal_5m,false);assert.equal(maturedAtHt.outcome.window_evidence.goal_5m.model_target_compatible,true);
const ft88Obs=makeObserved({fixtureId:32,engine:'FT',minute:88});const ft88={...h1Row,fixture_id:32,engine:'FT',market_period:'FT',minute:88,observation_id:ft88Obs.observation_id,observation:ft88Obs,input_fingerprint:ft88Obs.input_fingerprint,content_fingerprint:ft88Obs.content_fingerprint};
const ftStop=resolveStrictGoalWindows(ft88,{events:[{id:'g90',period:'H2',type:'Goal',time:{elapsed:90,extra:3},received_at:'2026-10-07T10:06:00Z'}]});assert.equal(ftStop.outcome.goal_5m,true);assert.equal(ftStop.outcome.first_goal_clock.display,'90+3');assert.equal(ftStop.outcome.window_evidence.goal_5m.metric_eligible,false);

// Incremental/partial evidence cannot erase an already known event. Explicit same-ID correction can revise it.
const ftObs=makeObserved({fixtureId:40,engine:'FT',minute:60});const ftRow={fixture_id:40,engine:'FT',market_period:'FT',minute:60,score_home:0,score_away:0,p_goal_5m:40,p_goal_10m:55,p_goal_15m:65,observation_id:ftObs.observation_id,observation:ftObs,input_fingerprint:ftObs.input_fingerprint,content_fingerprint:ftObs.content_fingerprint,strict_metrics_eligible:null,outcome:{revision:0,history:[]}};
const known=resolveStrictGoalWindows(ftRow,{events:[{id:77,period:'H2',type:'Goal',time:{elapsed:63},received_at:'2026-10-07T10:05:00Z'}]});assert.equal(known.outcome.goal_5m,true);
const partial=resolveStrictGoalWindows(known,{events:[],snapshots:[]});assert.equal(partial.outcome.goal_5m,true);assert.equal(partial.outcome.first_goal_min,63);assert.equal(partial.outcome.evidence_ledger.events.length,1);
const corrected=resolveStrictGoalWindows(partial,{events:[{id:77,period:'H2',type:'Goal',detail:'Cancelled Goal',time:{elapsed:63},received_at:'2026-10-07T10:08:00Z'}]});assert.equal(corrected.outcome.goal_5m,null);assert.ok(corrected.outcome.revision>partial.outcome.revision);assert.ok(corrected.outcome.history.length>partial.outcome.history.length);

// A valid prediction metric must pass observation+server ACK+outcome evidence and persistence-before-outcome.
const validPred=known;const validReport=buildValidationReport({prediction:[validPred],paired:[],paper:[]},{strictMode:true});assert.equal(validReport.calibration.goal_5m.n,1);
const contradiction={...validPred,strict_metrics_eligible:false,observation:{...validPred.observation,strict_metrics_eligible:true},outcome:{...validPred.outcome,strict_outcome_eligible:false}};
const contradictionReport=buildValidationReport({prediction:[contradiction],paired:[],paper:[]},{strictMode:true});assert.equal(contradictionReport.quarantine.prediction_by_metric.goal_5m.included,0);assert.ok(contradictionReport.quarantine.prediction_by_metric.goal_5m.reasons.RECORD_EXPLICITLY_INELIGIBLE>=1);assert.ok(contradictionReport.quarantine.prediction_by_metric.goal_5m.reasons.OUTCOME_EXPLICITLY_INELIGIBLE>=1);
const legacy={...validPred,observation:null,observation_id:null};const legacyReport=buildValidationReport({prediction:[legacy],paired:[],paper:[]},{strictMode:true});assert.equal(legacyReport.calibration.goal_5m.n,0);
const unresolved=resolveStrictGoalWindows(ftRow,{events:[],snapshots:[]});const unresolvedReport=buildValidationReport({prediction:[unresolved],paired:[],paper:[]},{strictMode:true});assert.equal(unresolvedReport.calibration.goal_5m.n,0);
const correctedAgain=resolveStrictGoalWindows(resolveStrictGoalWindows(ftRow,{snapshots:[{period:'H2',minute:66,goals:{home:0,away:0},received_at:'2026-10-07T10:07:00Z'}]}),{events:[{id:'late-correct',period:'H2',type:'Goal',time:{elapsed:63},received_at:'2026-10-07T10:12:00Z'}]});const correctedReport=buildValidationReport({prediction:[correctedAgain],paired:[],paper:[]},{strictMode:true});assert.equal(correctedReport.calibration.goal_5m.n,1);
const latePersistRaw=buildObservationEnvelope({fixtureId:41,engine:'FT',marketPeriod:'FT',state:{minute:60,score_home:0,score_away:0,status:'2H'},evaluationCutoff:cutoff,sourceRefs:[srcRaw],predictionCreatedAt:'2026-10-07T10:01:00.100Z',featurePacket:{x:1},predictionPayload:{p:1},target:buildGoalWindowTarget({engine:'FT',minute:60})});
const latePersistObs=withPersistenceAcknowledgement(latePersistRaw,buildPersistenceAcknowledgement({subject:latePersistRaw,persistedAt:'2026-10-07T10:06:00Z',ackId:'ack-late',source:'SERVER',ackOrigin:'SERVER',serverVerified:true}));const latePersistRow={...ftRow,fixture_id:41,observation_id:latePersistObs.observation_id,observation:latePersistObs,input_fingerprint:latePersistObs.input_fingerprint,content_fingerprint:latePersistObs.content_fingerprint};const latePersistOutcome=resolveStrictGoalWindows(latePersistRow,{events:[{id:'g-before-persist',period:'H2',type:'Goal',time:{elapsed:63},received_at:'2026-10-07T10:05:00Z'}]});const latePersistReport=buildValidationReport({prediction:[latePersistOutcome],paired:[],paper:[]},{strictMode:true});assert.equal(latePersistReport.calibration.goal_5m.n,0);assert.ok(latePersistReport.quarantine.prediction_by_metric.goal_5m.reasons.PERSISTED_AFTER_OUTCOME_RECEIVED>=1);

// Paper: prediction observation, market, paper persistence and settlement provenance are independently required.
const bestMarket={market:'TOTAL',market_period:'FT',market_period_source:'EXPLICIT_FIELD',selection:'OVER',line:1.5,odds:2,bookmaker:'TEST',source:'TEST_MARKET',market_name:'Goals Over/Under',received_at:'2026-10-07T10:00:50Z',provider_updated_at:'2026-10-07T10:00:49Z',market_status:'OPEN',provenance_status:STRICT_VALID,eligible:true,pricing_status:'PRICED',edge:{valid:true,fair_odds:1.8,expected_return:.11}};
const paper0=createPaperMarketRecord({fixtureId:40,capturedAt:Date.parse(cutoff),state:{minute:60,score_home:0,score_away:0},bestMarket,marketPeriod:'FT',targetPeriod:'FT',evaluationCutoff:cutoff,observation:ftObs,strict:true,confidence:80});assert.ok(paper0);
const paper=withPersistenceAcknowledgement(paper0,buildPersistenceAcknowledgement({subject:paper0,persistedAt:'2026-10-07T10:02:00Z',ackId:'paper-ack',source:'TEST_SERVER',ackOrigin:'SERVER',serverVerified:true}));
const paperUnknown=settlePaperMarketRecord(paper,{periodResult:{period:'FT',home:2,away:0,status:'FT',confirmed:true,provenance_status:UNKNOWN_PROVENANCE}});const paperUnknownReport=buildValidationReport({prediction:[],paired:[],paper:[paperUnknown]},{strictMode:true});assert.equal(paperUnknownReport.market.n,0);assert.ok(paperUnknownReport.quarantine.paper.reasons.SETTLEMENT_PROVENANCE_NOT_STRICT>=1);
const paperSettled=settlePaperMarketRecord(paper,{periodResult:{period:'FT',home:2,away:0,status:'FT',confirmed:true,provenance_status:STRICT_VALID,received_at:'2026-10-07T11:50:00Z'}});const paperReport=buildValidationReport({prediction:[],paired:[],paper:[paperSettled]},{strictMode:true});assert.equal(paperReport.market.n,1);

// Paired: OLD, NEW, persistence and corresponding outcome must all be strict.
const pair0=buildPairedObservation({fixtureId:40,capturedAt:Date.parse(cutoff),oldRankMeta:{eligible:true,primary:{stateRank:3}},newOpportunity:{rank:1,best_market:{edge:{expected_return:.1}},market_period:'FT'},observation:ftObs,oldEvaluationStatus:STRICT_VALID,newEvaluationStatus:STRICT_VALID});
const pair=withPersistenceAcknowledgement(pair0,buildPersistenceAcknowledgement({subject:pair0,persistedAt:'2026-10-07T10:02:00Z',ackId:'pair-ack',source:'TEST_SERVER',ackOrigin:'SERVER',serverVerified:true}));const pairDone={...pair,hit:1,outcome_provenance_status:STRICT_VALID,outcome_received_at:'2026-10-07T10:05:00Z'};
const pairReport=buildValidationReport({prediction:[],paired:[pairDone],paper:[]},{strictMode:true});assert.equal(pairReport.old_vs_new.n,1);
const pairBad={...pairDone,new_evaluation_status:UNKNOWN_PROVENANCE};const pairBadReport=buildValidationReport({prediction:[],paired:[pairBad],paper:[]},{strictMode:true});assert.equal(pairBadReport.old_vs_new.n,0);

console.log('Batch02.1 contract/outcome/strict-metrics regressions PASS');
