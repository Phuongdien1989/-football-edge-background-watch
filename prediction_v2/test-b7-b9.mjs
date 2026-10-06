import assert from 'node:assert/strict';
import {buildValidationEvents,changedEvents,syncValidationEvents,parseValidationRows,evidenceSignature} from './validation-sync.js';
import {buildValidationReport,promotionStage} from './validation-report.js';
import {createPaperMarketRecord} from './paper-market-evidence.js';

const pred={id:'pv2:pred:1:FT:1000',fixture_id:1,engine:'FT',captured_at:1000,p_goal_5m:20,p_goal_10m:40,p_goal_15m:60,confidence_band:'HIGH',minute:60,outcome:{goal_5m:false,goal_10m:true,goal_15m:true,settled:true}};
const pair={observation_id:'pv2:pair:1:1000',fixture_id:1,captured_at:1000,old_selected:false,new_ranked:true,new_positive_edge:true,hit:1};
const paper=createPaperMarketRecord({fixtureId:1,capturedAt:1000,state:{minute:60,score_home:0,score_away:0},bestMarket:{market:'TOTAL',selection:'OVER',line:.5,odds:1.9,edge:{valid:true,fair_odds:1.7,expected_return:.12}},confidence:80});
paper.settled=true;paper.realized_return=0.9;paper.settlement_result='WIN';

const events=buildValidationEvents({prediction:[pred],paired:[pair],paper:[paper]});
assert.equal(events.length,3);
assert.equal(events[0].type,'VALIDATION_RESULT');
assert.equal(events[0].payload.source,'PV2_PREDICTION');
assert.equal(events[0].payload.outcome,'HIT');
assert.equal(events[2].payload.source,'PV2_PAPER_MARKET');
assert.ok(evidenceSignature(pred)===evidenceSignature({...pred}));

const changed=changedEvents(events,{},10);assert.equal(changed.length,3);
const hashes=Object.fromEntries(changed.map(x=>[x.payload.id,x.__sig]));
assert.equal(changedEvents(events,hashes,10).length,0);

let sent=null;
const sync=await syncValidationEvents({events,hashes:{},request:async(path,opts)=>{sent={path,opts};return {ok:true,accepted:3}},maxBatch:10});
assert.equal(sync.ok,true);assert.equal(sync.synced,3);assert.equal(sent.path,'/api/db/sync');

const rows=events.map((e,i)=>({id:String(i),payload_json:JSON.stringify(e.payload)}));
const parsed=parseValidationRows(rows);
assert.equal(parsed.prediction.length,1);assert.equal(parsed.paired.length,1);assert.equal(parsed.paper.length,1);

const report=buildValidationReport(parsed);
assert.equal(report.calibration.goal_10m.n,1);
assert.equal(report.old_vs_new.agreement.new_only,1);
assert.equal(report.market.n,1);
assert.equal(report.promotion.production_ready,false);
assert.equal(report.promotion.manual_review_required,true);

assert.equal(promotionStage({prediction:Array.from({length:499},(_,i)=>({...pred,id:'p'+i}))}).stage,'COLLECT');
assert.equal(promotionStage({prediction:Array.from({length:500},(_,i)=>({...pred,id:'p'+i}))}).stage,'DIAGNOSTIC_REVIEW');
assert.equal(promotionStage({prediction:Array.from({length:1000},(_,i)=>({...pred,id:'p'+i}))}).stage,'MEANINGFUL_COMPARISON');
assert.equal(promotionStage({prediction:Array.from({length:3000},(_,i)=>({...pred,id:'p'+i}))}).stage,'STRATIFIED_REVIEW');

console.log('B7-B9 tests PASS');
