// Explicitly synthetic UI content. This module must never be imported by a
// production API reader, leaderboard, scanner, odds feed or FT decision engine.
import {reviewFTTotalPrice} from '../ft-audit-fix/ft-total-settlement.mjs';
const now=Date.parse('2026-10-23T10:00:00+07:00');
const fixtures=[
 {id:910001,league:'K League 1',country:'Hàn Quốc',home:'FC Seoul',away:'Gimcheon',score:[1,1],minute:72,line:2.75,over:1.93,under:1.92,
  pmf:[[2,.39],[3,.28],[4,.18],[5,.10],[6,.05]],signals:[47,53,52,61,67,70,72]},
 {id:910002,league:'Liga MX',country:'Mexico',home:'Chivas',away:'Necaxa',score:[1,0],minute:62,line:2.25,over:1.93,under:1.96,
  pmf:[[1,.24],[2,.30],[3,.28],[4,.12],[5,.06]],signals:[48,50,55,59,64,67,70]},
 {id:910003,league:'Eredivisie',country:'Hà Lan',home:'Ajax',away:'PSV',score:[2,1],minute:80,line:3.25,over:1.55,under:2.50,
  pmf:[[3,.50],[4,.32],[5,.13],[6,.05]],signals:[53,50,56,62,66,68,75]},
 {id:910004,league:'Serie A',country:'Ý',home:'Inter',away:'Atalanta',score:[0,0],minute:52,line:1.75,over:2.58,under:1.50,
  pmf:[[0,.17],[1,.34],[2,.26],[3,.16],[4,.07]],signals:[38,44,51,57,56,64,66]},
 {id:910005,league:'Ligue 1',country:'Pháp',home:'Lyon',away:'Lille',score:[1,1],minute:68,line:2.75,over:1.85,under:2.20,
  pmf:[[2,.47],[3,.32],[4,.15],[5,.06]],signals:[42,39,47,52,60,58,63]}
];
const scored=fixtures.map((f,k)=>{
 const distribution=f.pmf.map(([finalTotalGoals,probability])=>({finalTotalGoals,probability}));
 const basis={line:f.line,distribution,modelVersion:'DEMO_ONLY_NEVER_TRADE',
   modelReceivedAt:now-180000,marketReceivedAt:now-120000,decisionAt:now-60000};
 const priceO=reviewFTTotalPrice({...basis,side:'OVER',decimalOdds:f.over});
 const priceU=reviewFTTotalPrice({...basis,side:'UNDER',decimalOdds:f.under});
 const side=priceO.expected_net_units>=priceU.expected_net_units?'OVER':'UNDER';
 const best=side==='OVER'?priceO:priceU;
 const label=(v)=>Number.isFinite(v)?v:null;
 return {
  id:f.id,league:f.league,country:f.country,home:f.home,away:f.away,
  home_goals:f.score[0],away_goals:f.score[1],minute:f.minute,state:'2H',
  decision_at:now-60000-k*1000,
  quote:{line:f.line,over_odds:f.over,under_odds:f.under,received_at:now-120000,
   bookmaker_id:null,executable:false,raw_confirmed:false},
  model:{status:'SYNTHETIC_CALCULATION',fair_over:label(priceO.fair_decimal_odds),
   fair_under:label(priceU.fair_decimal_odds),
   ev_over:label(priceO.expected_net_units),ev_under:label(priceU.expected_net_units),
   pmf:distribution,calibrated:false},
  recommendation:{state:best.expected_net_units>=.03?'DEMO_CONSIDER':'DEMO_WATCH',
   side,line:f.line,odds:side==='OVER'?f.over:f.under,ev:best.expected_net_units,rank:k+1},
  integrity:{status:'SYNTHETIC_DEMO',reason:'Không phản ánh bất kỳ trận đấu thật nào'},
  history:f.signals.map((score,j)=>({minute:Math.max(1,f.minute-(6-j)*7),at:now-(7-j)*60000,
   score,received_at:null,status:'SYNTHETIC_DEMO'}))
 };
});
export const demoFTPacket=Object.freeze({
 schema:'FT_V2_MOBILE_READ_ONLY',mode:'DEMO',generated_at:now,
 banner:'DỮ LIỆU GIẢ LẬP — CHỈ DUYỆT GIAO DIỆN — KHÔNG SỬ DỤNG ĐỂ CƯỢC',
 rows:scored,top_verified:false,prices_verified:false
});
