/* FOOTBALL EDGE — Prediction V2 / B5
 * Records the exact real market offer used by B4 at observation time and settles it later.
 */
import {asianTotalResult,asianHandicapResult} from './market-edge.js';
import {settlementReturn} from './validation-metrics.js';
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
export function createPaperMarketRecord({fixtureId,capturedAt,state,bestMarket,confidence,league=null}={}){
  if(!bestMarket?.edge?.valid)return null;
  return {schema:'FE_PREDICTION_V2_PAPER_MARKET_B5',fixture_id:Number(fixtureId)||null,captured_at:capturedAt||Date.now(),league,
    minute:finite(state?.minute),score_home:finite(state?.score_home)||0,score_away:finite(state?.score_away)||0,
    market:bestMarket.market,selection:bestMarket.selection,line:finite(bestMarket.line),odds:finite(bestMarket.odds),bookmaker:bestMarket.bookmaker||null,
    fair_odds:finite(bestMarket.edge.fair_odds),expected_return:finite(bestMarket.edge.expected_return),confidence:finite(confidence),
    settlement_result:null,realized_return:null,settled:false};
}
export function settlePaperMarketRecord(row,{finalHome,finalAway}={}){
  if(!row||row.settled)return row;const h=finite(finalHome),a=finite(finalAway);if(h==null||a==null)return row;
  let result=null;if(row.market==='TOTAL')result=asianTotalResult(h+a,row.line,row.selection);
  else if(row.market==='ASIAN_HANDICAP')result=asianHandicapResult(h,a,row.line,row.selection);
  if(!result)return row;return {...row,settlement_result:result,realized_return:settlementReturn(result,row.odds),settled:true,final_home:h,final_away:a};
}
