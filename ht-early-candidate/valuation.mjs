// HT pricing candidate. Pure calculations; no API, storage, scan or Push changes.
import {priceOver,validatePMF,settlement} from '../ft-overview/core.mjs';
export const VERSION='HT_CONTRACT_PRICING_RESEARCH_V1';
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const scoreOK=g=>Number.isInteger(g?.home)&&g.home>=0&&Number.isInteger(g?.away)&&g.away>=0;
const sameScore=(a,b)=>scoreOK(a)&&scoreOK(b)&&a.home===b.home&&a.away===b.away;
const fresh=(at,now)=>num(at)!==null&&at>0&&at<=now&&now-at<=55000;
export function htNoVig(m) {
  if(m?.period!=='H1'||m.basis!=='FIRST_HALF_TOTAL'||!m.bookmaker||num(m.line)===null||Math.abs(m.line%1-.5)>1e-8||num(m.over)===null||num(m.under)===null||m.over<=1||m.under<=1)return null;
  const a=1/m.over,b=1/m.under;
  return {over:a/(a+b),under:b/(a+b),overround:a+b-1,method:'PROPORTIONAL_BINARY_HT'};
}
function modelMatches(model,snapshot) {
  const c=model?.condition;
  return model?.independent===true&&typeof model.version==='string'&&model.version.length>0&&model.period==='H1_REMAINING'
    &&model.at===snapshot.at&&model.fixtureId===snapshot.id&&c?.at===snapshot.at&&c?.minute===snapshot.minute
    &&sameScore(c.goals,snapshot.goals)&&validatePMF(model.pmf);
}
export function assessHT(s,now,{trialRecommendations=false}={}) {
  const warnings=[],reasons=[],g=s?.goals;
  const idOK=Number.isSafeInteger(s?.id)&&s.id>0;
  const phase=s?.status==='1H'||(s?.status==='LIVE'&&s?.periodConfirmed==='H1');
  const dataOK=idOK&&scoreOK(g)&&num(s?.minute)!==null&&s.minute>=0&&s.minute<=45&&fresh(s?.at,now)
    &&phase&&!s.statsError&&!(s.cooldownUntil>now);
  const modelOK=dataOK&&modelMatches(s.model,s);
  const m=s?.market;
  let validLine=false;
  try {if(num(m?.line)!==null&&m.line>g.home+g.away){settlement(g.home+g.away,m.line);validLine=true;}}catch{}
  const marketOK=dataOK&&m?.period==='H1'&&m.basis==='FIRST_HALF_TOTAL'&&!!m.bookmaker
    &&m.suspended!==true&&m.blocked!==true&&validLine&&num(m.over)!==null&&m.over>1
    &&fresh(m.at,now)&&m.at>=(num(s.resetAt)??0)&&sameScore(m.score,g);
  const quote=modelOK&&marketOK?priceOver(s.model.pmf,g.home+g.away,m.line,m.over):null;
  const binary=marketOK?htNoVig(m):null;
  const delta=quote&&binary?quote.win-binary.over:null;
  const scenarioPrices=[];
  if(quote)for(const scenario of s.model.scenarios||[]) {
    if(!validatePMF(scenario?.pmf)){warnings.push('INVALID_SENSITIVITY_SCENARIO');continue;}
    const q=priceOver(scenario.pmf,g.home+g.away,m.line,m.over);
    if(q)scenarioPrices.push({name:String(scenario.name||'SCENARIO'),ev:q.ev,fairOdds:q.fairOdds});
  }
  const range=scenarioPrices.length?{min:Math.min(quote.ev,...scenarioPrices.map(x=>x.ev)),max:Math.max(quote.ev,...scenarioPrices.map(x=>x.ev)),kind:'SUPPLIED_SCENARIO_RANGE_NOT_CONFIDENCE_INTERVAL'}:null;
  if(modelOK&&s.model.validated!==true)warnings.push('MODEL_NOT_VALIDATED');
  if(modelOK&&!range)warnings.push('UNCERTAINTY_NOT_SUPPLIED');
  if(range&&range.min<0&&range.max>0)warnings.push('VALUE_CHANGES_SIGN_ACROSS_SCENARIOS');
  if(m?.timestampBasis==='MARKET_RECEIPT')warnings.push('PROVIDER_QUOTE_TIME_UNKNOWN');
  if(marketOK&&!binary)warnings.push('NO_BINARY_PROBABILITY_FOR_THIS_LINE');
  let state='MODEL_WAIT',action='WAIT';
  if(!dataOK){state=fresh(s?.at,now)?'DATA_WAIT':'STALE';reasons.push(!phase?'FIRST_HALF_NOT_CONFIRMED':s?.cooldownUntil>now?'COOLDOWN':'SNAPSHOT_UNUSABLE');}
  else if(!marketOK){state='WAIT_PRICE';reasons.push('NEED_MATCHING_HT_LINE_PRICE_SCORE_AND_TIME');}
  else if(!modelOK){reasons.push('NEED_INDEPENDENT_HT_REMAINING_GOALS_PMF');}
  else if(!quote){state='MODEL_WAIT';reasons.push('CONTRACT_PRICING_FAILED');}
  else if(quote.ev<=0){state='WAIT_PRICE';reasons.push('PRICE_HAS_NO_POSITIVE_VALUE_UNDER_MODEL');}
  else {state=trialRecommendations?'TRIAL_OVER':'RESEARCH';action=trialRecommendations?'TRIAL_OVER':'RESEARCH_ONLY';reasons.push('POSITIVE_ESTIMATED_VALUE_AT_THIS_HT_CONTRACT');}
  return {version:VERSION,id:s?.id,at:s?.at,minute:s?.minute,state,action,dataOK,marketOK,modelOK,quote,binary,delta,
    reconciliation:delta===null?'NOT_COMPARABLE':Math.abs(delta)<1e-10?'ALIGNED':delta>0?'MODEL_ABOVE_MARKET':'MODEL_BELOW_MARKET',
    scenarioPrices,scenarioEVRange:range,warnings,reasons,
    recommendation:{period:'H1',basis:'FIRST_HALF_TOTAL',selection:'OVER',line:marketOK?m.line:null,odds:marketOK?m.over:null,action,experimental:true},
    assumptions:['PMF_COUNTS_ADDITIONAL_GOALS_AFTER_CURRENT_SCORE','HT_SETTLEMENT_INCLUDES_FIRST_HALF_STOPPAGE_TIME','NO_AUTOMATIC_ADDED_TIME_ESTIMATE']};
}
// Read-only attention ladder. One fixture per row; never fills five forced bets.
export function rankHT(rows,{limit=5}={}) {
  const byId=new Map();
  for(const r of rows||[]) {
    if(!Number.isSafeInteger(r?.id)||r.id<=0)continue;
    const old=byId.get(r.id);
    if(!old||r.at>old.at||(r.at===old.at&&(r.quote?.ev??-Infinity)>(old.quote?.ev??-Infinity)))byId.set(r.id,r);
  }
  const bucket=r=>!r.dataOK?0:r.modelOK&&r.marketOK&&r.quote?3:r.marketOK?2:1;
  return [...byId.values()].filter(r=>r.dataOK).sort((a,b)=>bucket(b)-bucket(a)||(b.quote?.ev??-Infinity)-(a.quote?.ev??-Infinity)||a.id-b.id)
    .slice(0,Math.max(0,Math.min(5,Math.floor(limit)||0))).map((r,i)=>({...r,rank:i+1}));
}
