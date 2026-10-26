// Exact Asian Handicap settlement and research valuation. Pure; no I/O or bets.
import {VERSION} from './core.mjs';
import {resolveHCBasis} from './rule-policy.mjs';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const scoreOK=g=>Number.isSafeInteger(g?.home)&&g.home>=0&&Number.isSafeInteger(g?.away)&&g.away>=0;
export function settleAH(difference,selection,line){
 if(!Number.isSafeInteger(difference)||!['HOME','AWAY'].includes(selection)||!finite(line)||Math.abs(line*4-Math.round(line*4))>1e-9)throw Error('INVALID_AH_CONTRACT');
 const d=selection==='HOME'?difference:-difference,legs=Number.isInteger(line*2)?[line]:[line-.25,line+.25];
 return legs.reduce((sum,l)=>sum+(d+l>0?1:d+l<0?-1:0),0)/legs.length;
}
export function priceAHDistribution(distribution,score,{selection,line,odds,basis}={}){
 if(!scoreOK(score)||!Array.isArray(distribution)||!distribution.length||distribution.some(x=>!Number.isSafeInteger(x.goals)||!finite(x.p)||x.p<0)||Math.abs(distribution.reduce((a,x)=>a+x.p,0)-1)>1e-8)throw Error('INVALID_DIFFERENCE_DISTRIBUTION');
 if(!['FULL_MATCH','REMAINING_MATCH'].includes(basis)||!finite(odds)||odds<=1)throw Error('INVALID_BASIS_OR_ODDS');
 // Difference is HOME-AWAY. The supplied line belongs to the selected team.
 const offset=basis==='FULL_MATCH'?score.home-score.away:0,out={win:0,halfWin:0,push:0,halfLose:0,lose:0};
 for(const x of distribution){const s=settleAH(offset+x.goals,selection,line);out[s===1?'win':s===.5?'halfWin':s===0?'push':s===-.5?'halfLose':'lose']+=x.p;}
 const winWeight=out.win+.5*out.halfWin,loseWeight=out.lose+.5*out.halfLose;
 return {...out,selection,line,odds,basis,winWeight,loseWeight,fairOdds:winWeight>0?1+loseWeight/winWeight:null,ev:winWeight*(odds-1)-loseWeight,coverLabel:'FULL_WIN_IS_NOT_HALF_WIN_OR_PUSH',binary:out.halfWin===0&&out.halfLose===0&&out.push===0};
}
export function reviewHCQuote({model,quote,now,verifiedRules=[],cooldownUntil=0}={}){
 const wait=(status,reason)=>({status,reason,experimental:true,tradeReady:false,recommendation:null,prices:null,scenarios:null});
 if(!model||model.version!==VERSION||!finite(model.at)||!scoreOK(model.condition?.score))return wait('MODEL_WAIT','Thiếu phân phối chênh lệch bàn độc lập');
 if(!finite(now)||model.at>now+5000||now-model.at>60000||cooldownUntil>now)return wait('DATA_WAIT','Quan sát cũ, sai thời điểm hoặc đang cooldown');
 if(!quote||quote.mode!==(model.condition.status==='NS'?'PRE':'LIVE')||typeof quote.sourceId!=='string'||!quote.sourceId.trim()||quote.awayLine!=null&&quote.awayLine!==-quote.line||quote.sourceQuote!==true||quote.fixtureId!==model.fixtureId||quote.period!=='FT'||!finite(quote.line)||!finite(quote.homeOdd)||quote.homeOdd<=1||!finite(quote.awayOdd)||quote.awayOdd<=1||!finite(quote.quoteAt)||quote.quoteAt>now+5000||now-quote.quoteAt>60000||Math.abs(quote.quoteAt-model.at)>60000||quote.suspended===true||quote.blocked===true)return wait('QUOTE_WAIT','Thiếu cặp báo giá gốc, đúng trận và đủ mới');
 if(!scoreOK(quote.observedScore)||quote.observedScore.home!==model.condition.score.home||quote.observedScore.away!==model.condition.score.away)return wait('QUOTE_WAIT','Tỷ số của quan sát báo giá không khớp mô hình');
 if(quote.providerScore&&(quote.providerScore.home!==quote.observedScore.home||quote.providerScore.away!==quote.observedScore.away))return wait('QUOTE_WAIT','Tỷ số do nguồn báo giá cung cấp không khớp');
 const price=basis=>({HOME:priceAHDistribution(model.remainingDifference,model.condition.score,{selection:'HOME',line:quote.line,odds:quote.homeOdd,basis}),AWAY:priceAHDistribution(model.remainingDifference,model.condition.score,{selection:'AWAY',line:-quote.line,odds:quote.awayOdd,basis})});
 let rule,scenarios;try{rule=resolveHCBasis(quote,{verifiedRules});scenarios={FULL_MATCH:price('FULL_MATCH'),REMAINING_MATCH:price('REMAINING_MATCH')};}catch{return wait('CONTRACT_WAIT','Line hoặc phân phối thanh toán không hợp lệ');}
 if(!rule.verified)return {...wait('RULE_WAIT','Chưa xác minh cách thanh toán đúng nguồn kèo; hai kết quả dưới đây chỉ là giả định'),scenarios,rule,indicativeOnly:true};
 const prices=scenarios[rule.basis];
 return {status:'RESEARCH_PRICED',reason:'Định giá thử nghiệm theo mô hình chưa hiệu chỉnh; không tự chọn bên hoặc phát Push',experimental:true,tradeReady:false,recommendation:null,rule,prices,scenarios:null,indicativeOnly:false,
  sideReview:Object.fromEntries(Object.entries(prices).map(([side,p])=>[side,p.winWeight===0?'NO_WIN_WEIGHT':p.ev>0?'POSITIVE_MODEL_EV':p.ev===0?'MODEL_BREAK_EVEN':'WAIT_PRICE'])),
  provenance:{modelVersion:model.version,modelAt:model.at,sourceId:quote.sourceId,marketId:quote.marketId,quoteAt:quote.quoteAt,observedScore:{...quote.observedScore},basis:rule.basis}};
}
