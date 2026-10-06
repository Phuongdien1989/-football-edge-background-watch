/* FOOTBALL EDGE — Prediction V2 / B4
 * Probability -> actual market -> expected return -> ranking.
 * TOP means best current real opportunity; it never means automatic entry.
 */
import {totalEdge,handicapEdge,modelRemainingLambdas,removeVigTwoWay} from './market-edge.js';
import {extractActualOffers,pairTwoWayOffers} from './market-adapter.js';
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const round=(v,d=3)=>{const n=finite(v);if(n==null)return null;const p=10**d;return Math.round(n*p)/p};
function assessOffer(offer,prediction,state){
  const l=modelRemainingLambdas(prediction,state),common={line:offer.line,odds:offer.odds};let edge;
  if(offer.market==='TOTAL')edge=totalEdge({...common,currentGoals:(Number(state?.score_home)||0)+(Number(state?.score_away)||0),lambdaRemaining:l.total,side:offer.selection});
  else if(offer.market==='ASIAN_HANDICAP')edge=handicapEdge({...common,homeGoals:Number(state?.score_home)||0,awayGoals:Number(state?.score_away)||0,
    lambdaHomeRemaining:l.home,lambdaAwayRemaining:l.away,selection:offer.selection});
  else return null;
  if(!edge?.valid)return null;return {...offer,edge,remaining:l};
}
export function evaluateActualMarkets({prediction,state,marketRows=[]}={}){
  const offers=extractActualOffers(marketRows),assessed=offers.map(o=>assessOffer(o,prediction,state)).filter(Boolean),
    pairs=pairTwoWayOffers(offers),noVig=[];
  for(const p of pairs){
    if(p.a&&p.b){
      const nv=removeVigTwoWay(p.a.odds,p.b.odds);
      if(nv)noVig.push({key:p.key,market:p.market,line:p.line,bookmaker:p.bookmaker,a_selection:p.a.selection,a_probability:round(nv.a*100,2),
        b_selection:p.b.selection,b_probability:round(nv.b*100,2),overround:round(nv.overround*100,2)});
    }
  }
  assessed.sort((a,b)=>(Number(b.edge.expected_return)||-99)-(Number(a.edge.expected_return)||-99));
  return {offers,assessed,no_vig:noVig,best:assessed[0]||null};
}
export function rankOpportunities(rows=[]){
  const out=[];
  for(const row of rows){
    const pred=row?.prediction,conf=(finite(pred?.confidence?.value)??0),
      m=evaluateActualMarkets({prediction:pred,state:row?.state||{},marketRows:row?.marketRows||[]}),best=m.best,
      ev=finite(best?.edge?.expected_return),score=ev==null?null:ev*(.55+.45*conf)-(1-conf)*.015;
    out.push({...row,market_evaluation:m,best_market:best,rank_score:round(score,5),
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
