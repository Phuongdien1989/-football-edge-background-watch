import {settleAH} from '../hc-model/valuation.mjs';
import {settlement} from '../ft-overview/core.mjs';
import {n,time,marketKey,digest} from './contracts.mjs';
export function contractError(q){
 if(!q||!['FT','HT'].includes(q.period)||!['1X2','AH','OU'].includes(q.type))return 'UNSUPPORTED_MARKET';
 if(typeof q.source!=='string'||!q.source||typeof q.bookmaker!=='string'||!q.bookmaker||typeof q.marketId!=='string'||!q.marketId)return 'SOURCE_ID_REQUIRED';
 if(q.basis!=='REGULATION'||q.ruleStatus!=='VERIFIED'||typeof q.ruleReference!=='string'||!q.ruleReference.trim())return 'SETTLEMENT_RULE_REQUIRED';
 if(q.type==='1X2')return ['HOME','DRAW','AWAY'].includes(q.selection)?null:'INVALID_SELECTION';
 if(n(q.line)===null||Math.abs(q.line*4-Math.round(q.line*4))>1e-8||Math.abs(q.line)>100||q.type==='OU'&&q.line<0)return 'INVALID_SIGNED_LINE';
 return (q.type==='AH'?['HOME','AWAY']:['OVER','UNDER']).includes(q.selection)?null:'INVALID_SELECTION';
}
export function settleScore(q,home,away){
 if(contractError(q))throw Error(contractError(q));
 if(!Number.isSafeInteger(home)||home<0||!Number.isSafeInteger(away)||away<0)throw Error('INVALID_REGULATION_SCORE');
 if(q.type==='AH')return settleAH(home-away,q.selection,q.line);
 if(q.type==='OU'){const value=settlement(home+away,q.line)*(q.selection==='OVER'?1:-1);return value===0?0:value;}
 return (home>away?'HOME':home<away?'AWAY':'DRAW')===q.selection?1:-1;
}
export function priceMatrix(joint,q){
 if(contractError(q)||n(q.odds)===null||q.odds<=1)return null;
 if(!Array.isArray(joint)||!joint.length||joint.some(r=>!Array.isArray(r)||r.some(p=>n(p)===null||p<0)))return null;
 const out={win:0,halfWin:0,push:0,halfLose:0,lose:0};let mass=0;
 joint.forEach((r,h)=>r.forEach((p,a)=>{mass+=p;const x=settleScore(q,h,a);out[x===1?'win':x===.5?'halfWin':x===0?'push':x===-.5?'halfLose':'lose']+=p;}));
 if(Math.abs(mass-1)>1e-8)return null;
 const w=out.win+.5*out.halfWin,l=out.lose+.5*out.halfLose;
 return {...out,winWeight:w,loseWeight:l,profitProbability:out.win+out.halfWin,fairOdds:w>0?1+l/w:null,ev:w*(q.odds-1)-l};
}
export async function evaluate(forecast,q,{now=Date.now()}={}){
 const out={schema:'FE_PREMATCH_EVALUATION_V1',forecastId:forecast?.id??null,fixtureId:q?.fixtureId??null,at:now,quote:structuredClone(q),status:'WAIT_RULE',reason:null,price:null,sensitivity:null,experimental:true};
 if(!forecast){out.status='MODEL_WAIT';out.reason='FORECAST_REQUIRED';}
 else if(q.fixtureId!==forecast.fixtureId){out.reason='FIXTURE_MISMATCH';}
 else if(now>=forecast.kickoff){out.status='CLOSED_PRE';out.reason='KICKOFF_REACHED';}
 else if(!time(now)||!time(q.receivedAt)||q.receivedAt>now||q.receivedAt>=forecast.kickoff||q.sourceUpdatedAt!=null&&(!time(q.sourceUpdatedAt)||q.sourceUpdatedAt>q.receivedAt))out.reason='INVALID_QUOTE_CLOCK';
 else if(contractError(q)){out.reason=contractError(q);}
 else if(q.period==='HT'&&!forecast.distributions.HT){out.status='MODEL_WAIT';out.reason='TRUE_HT_HISTORY_REQUIRED';}
 else{
  out.price=priceMatrix(forecast.distributions[q.period],q);
  if(!out.price){out.status='WAIT_PRICE';out.reason='INVALID_PRICE';}
  else{
   const variants=forecast.variants.map(v=>({name:v.name,price:priceMatrix(v.distributions[q.period],q)})).filter(v=>v.price);
   const evs=[out.price.ev,...variants.map(v=>v.price.ev)];out.sensitivity={kind:'MODEL_VARIATION_NOT_CONFIDENCE_INTERVAL',variants:variants.map(v=>({name:v.name,ev:v.price.ev,fairOdds:v.price.fairOdds})),minEV:Math.min(...evs),maxEV:Math.max(...evs),signDisagreement:Math.min(...evs)<0&&Math.max(...evs)>0};
   const available=q.availability==='CONFIRMED'&&time(q.checkedAt)&&q.checkedAt>=q.receivedAt&&q.checkedAt<=now&&time(q.validUntil)&&q.validUntil>now&&q.validUntil<=forecast.kickoff&&q.suspended!==true;
   if(!available){out.status='WAIT_PRICE';out.reason='INDICATIVE_OR_UNAVAILABLE_QUOTE';}
   else if(out.price.ev<=0){out.status='NO_ENTRY';out.reason='NONPOSITIVE_MODEL_EV';}
   else if(out.sensitivity.signDisagreement){out.status='WAIT_MODEL_REVIEW';out.reason='EV_SIGN_DIFFERS_BETWEEN_MODELS';}
   else {out.status='OPEN_TRIAL';out.reason='POSITIVE_UNCALIBRATED_MODEL_EV';}
  }
 }
 out.id=await digest(out);return out;
}
export function noVigPairs(quotes){
 const groups=new Map();for(const q of quotes){if(contractError(q)||n(q.odds)===null||q.odds<=1)continue;const k=JSON.stringify([q.fixtureId,q.source,q.bookmaker,q.marketId,q.period,q.type,q.line??null,q.receivedAt,q.sourceUpdatedAt??null]);const g=groups.get(k)||[];g.push(q);groups.set(k,g);}
 const out=[];for(const group of groups.values()){
  const q=group[0],sides=q.type==='1X2'?['HOME','DRAW','AWAY']:q.type==='OU'&&Math.abs(q.line%1-.5)<1e-8?['OVER','UNDER']:null;
  if(!sides||group.length!==sides.length||new Set(group.map(x=>x.selection)).size!==sides.length||!sides.every(s=>group.some(q=>q.selection===s)))continue;
  const inv=group.reduce((s,q)=>s+1/q.odds,0);out.push({fixtureId:q.fixtureId,type:q.type,period:q.period,method:'PROPORTIONAL_MATCHED_SOURCE',overround:inv-1,probabilities:Object.fromEntries(group.map(q=>[q.selection,1/q.odds/inv])),contracts:group.map(marketKey)});
 }return out;
}
export function rankFixtures(rows){
 const leaders=rows.map(r=>{const candidates=r.evaluations.filter(e=>e.status==='OPEN_TRIAL').sort((a,b)=>b.price.ev-a.price.ev||a.id.localeCompare(b.id));return {...r,top:candidates[0]??null,backups:candidates.slice(1,3),rank:null};});
 const sorted=leaders.filter(r=>r.top).sort((a,b)=>b.top.price.ev-a.top.price.ev||a.fixture.id-b.fixture.id).slice(0,5);
 sorted.forEach((r,i)=>{r.rank=i+1;r.role=i===0?'TOP 1':i<3?'BACKUP':'WATCHLIST';});return {rows:leaders,top:sorted};
}
