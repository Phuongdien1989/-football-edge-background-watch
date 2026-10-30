// Pure candidate-only regulation FT total goals settlement and conditional pricing.
// No bookmaker/provider APIs, predictions, ranking, D1 writes, or production wiring.
// LIVE FT OU lines settle against the entire regulation final score, not future goals only.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const positiveTime=t=>Number.isSafeInteger(t)&&t>0;
const count=n=>Number.isSafeInteger(n)&&n>=0;
const sides=new Set(['OVER','UNDER']);
function checkMarket(line,side){
 if(!finite(line)||line<0||!Number.isSafeInteger(Math.round(line*4))||Math.abs(line*4-Math.round(line*4))>1e-8||!sides.has(side))throw Error('INVALID_FT_TOTAL_MARKET');
}
export function splitFTTotalLine(line){
 if(!finite(line)||line<0||Math.abs(line*4-Math.round(line*4))>1e-8)throw Error('INVALID_FT_TOTAL_LINE');
 const q=Math.round(line*4);
 return q%2===0?[q/4]:[(q-1)/4,(q+1)/4];
}
function weights({line,side,finalGoals}){
 checkMarket(line,side);
 if(!count(finalGoals))throw Error('INVALID_REGULATION_TOTAL');
 const legs=splitFTTotalLine(line);
 const x={win:0,push:0,loss:0};
 for(const leg of legs){
  const cmp=finalGoals===leg?0:finalGoals>leg?1:-1;
  const outcome=cmp===0?'push':(side==='OVER'?cmp>0:cmp<0)?'win':'loss';
  x[outcome]+=1/legs.length;
 }
 return x;
}
export function settleFTTotal({line,side,decimalOdds,finalRegulationScore,finalStatus}={}){
 checkMarket(line,side);
 if(!finite(decimalOdds)||decimalOdds<=1)throw Error('INVALID_DECIMAL_ODDS');
 if(!['FT','AET','PEN'].includes(finalStatus))return {status:'UNSETTLED',reason:'FINAL_REGULATION_RESULT_NOT_CONFIRMED',net_units:null};
 if(!count(finalRegulationScore?.home)||!count(finalRegulationScore?.away))return {status:'UNSETTLED',reason:'REGULATION_SCORE_MISSING',net_units:null};
 const total=finalRegulationScore.home+finalRegulationScore.away;
 const w=weights({line,side,finalGoals:total});
 const net=w.win*(decimalOdds-1)-w.loss;
 const outcome=w.win===1?'FULL_WIN':w.loss===1?'FULL_LOSS':w.push===1?'PUSH':w.win>0?'HALF_WIN':w.loss>0?'HALF_LOSS':'UNCLASSIFIED';
 return {status:'SETTLED',scope:'FULL_MATCH_REGULATION',side,line,decimal_odds:decimalOdds,
  final_total_goals:total,winning_stake:w.win,pushed_stake:w.push,losing_stake:w.loss,
  result:outcome,net_units:net};
}
// Pricing requires an explicit FULL distribution from a model snapshot observed no
// later than the decision/market clocks. It NEVER constructs or guesses a forecast.
export function reviewFTTotalPrice({line,side,decimalOdds,distribution,modelVersion,modelReceivedAt,marketReceivedAt,decisionAt}={}){
 checkMarket(line,side);
 if(!finite(decimalOdds)||decimalOdds<=1)throw Error('INVALID_DECIMAL_ODDS');
 const no=(reason)=>({status:'UNPRICED',reason,fair_decimal_odds:null,expected_net_units:null,edge_rank:null,final_recommendation:null});
 if(!positiveTime(decisionAt)||!positiveTime(modelReceivedAt)||!positiveTime(marketReceivedAt)||modelReceivedAt>decisionAt||marketReceivedAt>decisionAt)return no('UNKNOWN_OR_FUTURE_RECEIPT');
 if(typeof modelVersion!=='string'||!modelVersion.trim())return no('MODEL_VERSION_UNKNOWN');
 if(!Array.isArray(distribution)||!distribution.length)return no('MODEL_DISTRIBUTION_MISSING');
 const seen=new Set();let sum=0,wins=0,losses=0,pushes=0;
 for(const row of distribution){
  if(!count(row?.finalTotalGoals)||!finite(row.probability)||row.probability<0||row.probability>1||seen.has(row.finalTotalGoals))return no('INVALID_MODEL_DISTRIBUTION');
  seen.add(row.finalTotalGoals);sum+=row.probability;
  const w=weights({line,side,finalGoals:row.finalTotalGoals});
  wins+=row.probability*w.win;losses+=row.probability*w.loss;pushes+=row.probability*w.push;
 }
 if(Math.abs(sum-1)>1e-6)return no('INCOMPLETE_MODEL_DISTRIBUTION');
 if(wins<=1e-12)return no('NO_WINNING_PROBABILITY');
 const fair=1+losses/wins,ev=wins*(decimalOdds-1)-losses;
 return {status:'MATHEMATICAL_PRICE_ONLY',model_version:modelVersion,side,line,market_decimal_odds:decimalOdds,
  fair_decimal_odds:fair,expected_net_units:ev,expected_win_stake:wins,expected_push_stake:pushes,
  expected_loss_stake:losses,model_received_at:modelReceivedAt,market_received_at:marketReceivedAt,
  decision_at:decisionAt,edge_rank:null,final_recommendation:null,
  caveat:'Conditional on supplied probability distribution; not calibrated, validated, or proof of betting edge. No recommendation.'};
}
