/* FOOTBALL EDGE — Prediction V2 / B4 + Batch 02 market-period safety
 * Probability -> actual market -> expected return -> ranking.
 * TOP means best current real opportunity; it never means automatic entry.
 * Batch 02 does not change the ranking-score formula; it only prevents invalid market pricing.
 */
import {totalEdge,handicapEdge,modelRemainingLambdas,removeVigTwoWay} from './market-edge.js';
import {extractActualOffersDetailed,pairTwoWayOffers} from './market-adapter.js';
import {marketPeriodForEngine,normalizeMarketPeriod} from './observation-contract.js';
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const round=(v,d=3)=>{const n=finite(v);if(n==null)return null;const p=10**d;return Math.round(n*p)/p};
export const EXPERIMENTAL_MARKET_FRESHNESS_POLICY=Object.freeze({id:'PV2_BATCH02_MARKET_120S_EXPERIMENTAL',maxAgeMs:120000,validated:false,note:'Shadow-only experimental freshness policy; not a validated production threshold.'});

export function marketTargetCompatibility({prediction,targetPeriod}={}){
  const target=normalizeMarketPeriod(targetPeriod),enginePeriod=marketPeriodForEngine(prediction?.engine),eff=finite(prediction?.live_update?.effective_lambda_90??prediction?.base?.lambda_match);
  if(!target)return {supported:false,reason:'UNKNOWN_TARGET_PERIOD',target_period:null,engine_period:enginePeriod};
  if(!enginePeriod)return {supported:false,reason:'UNKNOWN_MODEL_PERIOD',target_period:target,engine_period:null};
  if(enginePeriod!==target)return {supported:false,reason:'MODEL_PERIOD_MISMATCH',target_period:target,engine_period:enginePeriod};
  if(target==='H2')return {supported:false,reason:'H2_PERIOD_DISTRIBUTION_NOT_IMPLEMENTED',target_period:target,engine_period:enginePeriod};
  if(eff==null)return {supported:false,reason:'MODEL_PERIOD_DISTRIBUTION_UNAVAILABLE',target_period:target,engine_period:enginePeriod};
  return {supported:true,reason:'PERIOD_DISTRIBUTION_SUPPORTED',target_period:target,engine_period:enginePeriod};
}
function assessOffer(offer,prediction,state){
  const l=modelRemainingLambdas(prediction,state),common={line:offer.line,odds:offer.odds};let edge;
  if(offer.market==='TOTAL')edge=totalEdge({...common,currentGoals:(Number(state?.score_home)||0)+(Number(state?.score_away)||0),lambdaRemaining:l.total,side:offer.selection});
  else if(offer.market==='ASIAN_HANDICAP')edge=handicapEdge({...common,homeGoals:Number(state?.score_home)||0,awayGoals:Number(state?.score_away)||0,
    lambdaHomeRemaining:l.home,lambdaAwayRemaining:l.away,selection:offer.selection});
  else return null;
  if(!edge?.valid)return null;return {...offer,edge,remaining:l,pricing_status:'PRICED'};
}
export function evaluateActualMarkets({prediction,state,marketRows=[],targetPeriod=null,evaluationCutoff=null,strictMarket=false,
  freshnessPolicy=EXPERIMENTAL_MARKET_FRESHNESS_POLICY}={}){
  const compat=marketTargetCompatibility({prediction,targetPeriod:targetPeriod||marketPeriodForEngine(prediction?.engine)}),
    policy=freshnessPolicy||EXPERIMENTAL_MARKET_FRESHNESS_POLICY,
    extracted=extractActualOffersDetailed(marketRows,{strict:strictMarket,targetPeriod:targetPeriod||compat.target_period,evaluationCutoff,
      maxAgeMs:strictMarket?finite(policy?.maxAgeMs):null}),offers=compat.supported?extracted.offers:[],
    assessed=compat.supported?offers.map(o=>assessOffer(o,prediction,state)).filter(Boolean):[],pairs=pairTwoWayOffers(offers),noVig=[];
  for(const p of pairs){
    if(p.a&&p.b){
      const nv=removeVigTwoWay(p.a.odds,p.b.odds);
      if(nv)noVig.push({key:p.key,market:p.market,market_period:p.market_period,line:p.line,bookmaker:p.bookmaker,a_selection:p.a.selection,a_probability:round(nv.a*100,2),
        b_selection:p.b.selection,b_probability:round(nv.b*100,2),overround:round(nv.overround*100,2)});
    }
  }
  assessed.sort((a,b)=>(Number(b.edge.expected_return)||-99)-(Number(a.edge.expected_return)||-99));
  const rejectionReasons=[...new Set([...(compat.supported?[]:[compat.reason]),...extracted.rejected.flatMap(x=>x.rejection_reasons||[])])];
  return {offers,assessed,no_vig:noVig,best:assessed[0]||null,pricing_compatibility:compat,rejected_offers:extracted.rejected,
    rejection_reasons:rejectionReasons,freshness_policy:{...policy,validated:false}};
}
export function rankOpportunities(rows=[],options={}){
  const out=[];
  for(const row of rows){
    const pred=row?.prediction,conf=(finite(pred?.confidence?.value)??0),period=row?.marketPeriod||row?.market_period||row?.observation?.market_period||marketPeriodForEngine(pred?.engine),
      cutoff=row?.evaluationCutoff||row?.evaluation_cutoff||row?.observation?.evaluation_cutoff||null,
      m=evaluateActualMarkets({prediction:pred,state:row?.state||{},marketRows:row?.marketRows||[],targetPeriod:period,evaluationCutoff:cutoff,
        strictMarket:options?.strictMarket===true,freshnessPolicy:options?.freshnessPolicy||EXPERIMENTAL_MARKET_FRESHNESS_POLICY}),best=m.best,
      ev=finite(best?.edge?.expected_return),score=ev==null?null:ev*(.55+.45*conf)-(1-conf)*.015;
    out.push({...row,market_period:period,market_evaluation:m,best_market:best,rank_score:round(score,5),
      edge_status:ev==null?'NO_SUPPORTED_MARKET':ev>0?'POSITIVE_EDGE':ev===0?'FAIR':'NO_EDGE'});
  }
  out.sort((a,b)=>{
    const as=finite(a.rank_score),bs=finite(b.rank_score);
    if(as==null&&bs==null)return (finite(b?.prediction?.confidence?.value)||0)-(finite(a?.prediction?.confidence?.value)||0);
    if(as==null)return 1;if(bs==null)return -1;return bs-as;
  });
  out.forEach((x,i)=>{x.rank=i+1;x.top=i<3?i+1:null;x.entry_decision=null});
  return out;
}