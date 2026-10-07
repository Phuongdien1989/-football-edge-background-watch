/* FOOTBALL EDGE — Prediction V2 / B5 + Batch 02.1 market identity / settlement
 * Paper position content is frozen before outcome. Settlement is appended separately.
 */
import {asianTotalResult,asianHandicapResult} from './market-edge.js';
import {settlementReturn} from './validation-metrics.js';
import {normalizeMarketPeriod,timestampIso,STRICT_VALID,UNKNOWN_PROVENANCE,contentFingerprint,PERSISTENCE_UNVERIFIED} from './observation-contract.js';
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const VOID_STATUSES=new Set(['CANC','CANCELLED','PST','POSTPONED','ABD','ABANDONED']);

export function createPaperMarketRecord({fixtureId,capturedAt,state,bestMarket,confidence,league=null,marketPeriod=null,targetPeriod=null,evaluationCutoff=null,observation=null,strict=false}={}){
  if(!bestMarket?.edge?.valid)return null;
  const ts=capturedAt||Date.now(),fid=Number(fixtureId)||null,market=bestMarket.market,selection=bestMarket.selection,line=finite(bestMarket.line),odds=finite(bestMarket.odds),period=normalizeMarketPeriod(marketPeriod??bestMarket.market_period),target=normalizeMarketPeriod(targetPeriod??observation?.market_period??period);
  if(strict){if(!period||!target||period!==target)return null;if(bestMarket.pricing_status!=='PRICED')return null;if(bestMarket.eligible===false||bestMarket.market_status!=='OPEN')return null;if(bestMarket.provenance_status!==STRICT_VALID)return null}
  const base={schema:'FE_PREDICTION_V2_PAPER_MARKET_B11',observation_id:observation?.observation_id||null,observation,fixture_id:fid,captured_at:ts,evaluation_cutoff:timestampIso(evaluationCutoff??observation?.evaluation_cutoff??ts),league,
    minute:finite(state?.minute),score_home:finite(state?.score_home)||0,score_away:finite(state?.score_away)||0,status:state?.status??null,market_period:period,market_period_source:bestMarket.market_period_source||null,
    market,selection,line,odds,bookmaker:bestMarket.bookmaker||null,source:bestMarket.source||null,market_name:bestMarket.market_name||null,provider_updated_at:bestMarket.provider_updated_at||null,received_at:bestMarket.received_at||null,
    market_freshness_age_ms:finite(bestMarket.freshness_age_ms),market_provenance_status:bestMarket.provenance_status||null,fair_odds:finite(bestMarket.edge.fair_odds),expected_return:finite(bestMarket.edge.expected_return),confidence:finite(confidence),strict_record:strict===true};
  const fp=contentFingerprint(base),id=`pv2:paper:${fid}:${ts}:${period||'UNKNOWN'}:${market}:${selection}:${line}:${fp}`;
  return {...base,id,content_fingerprint:fp,persisted_at:null,persistence_status:PERSISTENCE_UNVERIFIED,persistence_ack:null,strict_metrics_eligible:null,
    settlement_result:null,realized_return:null,settled:false,settlement_state:'OPEN',settlement_provenance_status:UNKNOWN_PROVENANCE,settlement_received_at:null,settlement_revision:0,settlement_history:[]};
}
function voidSettlement(row,status,changedAt,receivedAt=null){const rev=(row.settlement_revision||0)+1,prior={result:row.settlement_result,realized_return:row.realized_return,state:row.settlement_state,revision:row.settlement_revision||0};return {...row,settled:true,settlement_state:'VOID',settlement_result:'VOID',realized_return:null,terminal_status:status,settlement_received_at:timestampIso(receivedAt),settlement_provenance_status:receivedAt?STRICT_VALID:UNKNOWN_PROVENANCE,strict_metrics_eligible:null,settlement_revision:rev,settlement_history:[...(row.settlement_history||[]),{revision:rev,changed_at:timestampIso(changedAt||Date.now()),reason:`VOID_${status}`,prior,next:{result:'VOID',state:'VOID'}}]}}
export function settlePaperMarketRecord(row,{periodResult=null,finalHome=null,finalAway=null,status=null,changedAt=Date.now(),allowCorrection=false,receivedAt=null}={}){
  if(!row)return row;const period=normalizeMarketPeriod(row.market_period),st=String(status??periodResult?.status??'').toUpperCase();if(VOID_STATUSES.has(st))return row.settled&&!allowCorrection?row:voidSettlement(row,st,changedAt,periodResult?.received_at??receivedAt);
  if(!period){const h=finite(finalHome),a=finite(finalAway);if(row.settled||h==null||a==null)return row;let result=null;if(row.market==='TOTAL')result=asianTotalResult(h+a,row.line,row.selection);else if(row.market==='ASIAN_HANDICAP')result=asianHandicapResult(h,a,row.line,row.selection);if(!result)return row;return {...row,settlement_result:result,realized_return:settlementReturn(result,row.odds),settled:true,settlement_state:'SETTLED_LEGACY_UNKNOWN_PERIOD',settlement_provenance_status:UNKNOWN_PROVENANCE,settlement_received_at:timestampIso(receivedAt),strict_metrics_eligible:null,final_home:h,final_away:a}}
  const rp=normalizeMarketPeriod(periodResult?.period);if(rp!==period||periodResult?.confirmed!==true)return row;const h=finite(periodResult?.home),a=finite(periodResult?.away);if(h==null||a==null)return row;
  let result=null;if(row.market==='TOTAL')result=asianTotalResult(h+a,row.line,row.selection);else if(row.market==='ASIAN_HANDICAP')result=asianHandicapResult(h,a,row.line,row.selection);if(!result)return row;
  const settlementProvenance=periodResult?.provenance_status||UNKNOWN_PROVENANCE,settlementReceived=timestampIso(periodResult?.received_at??receivedAt),realized=settlementReturn(result,row.odds),same=row.settled&&row.settlement_result===result&&finite(row.final_home)===h&&finite(row.final_away)===a;
  if(same||row.settled&&!allowCorrection)return row;const rev=(row.settlement_revision||0)+1,prior={result:row.settlement_result,realized_return:row.realized_return,state:row.settlement_state,final_home:row.final_home,final_away:row.final_away,settlement_received_at:row.settlement_received_at};
  return {...row,settlement_result:result,realized_return:realized,settled:true,settlement_state:row.settled?'CORRECTED':'SETTLED',settlement_provenance_status:settlementProvenance,settlement_received_at:settlementReceived,strict_metrics_eligible:null,settlement_revision:rev,final_home:h,final_away:a,terminal_status:st||null,
    settlement_history:[...(row.settlement_history||[]),{revision:rev,changed_at:timestampIso(changedAt),reason:row.settled?'PERIOD_RESULT_CORRECTION':'PERIOD_RESULT_CONFIRMED',prior,next:{result,realized_return:realized,final_home:h,final_away:a,settlement_received_at:settlementReceived}}]};
}
