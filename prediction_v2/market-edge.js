/* FOOTBALL EDGE — Prediction V2 / B4
 * Market-aware value layer using ONLY real offers that exist now.
 * Supports Asian Total and Asian Handicap settlement math.
 * SHADOW ONLY: no auto entry, no stake, no production TOP mutation.
 */
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const round=(v,d=4)=>{const n=finite(v);if(n==null)return null;const p=10**d;return Math.round(n*p)/p};
function poissonPmf(lambda,k){const l=Math.max(0,finite(lambda)||0);if(k<0||!Number.isInteger(k))return 0;let p=Math.exp(-l);for(let i=1;i<=k;i++)p*=l/i;return p}
function poissonDist(lambda,maxGoals=12){const out=[];let sum=0;for(let k=0;k<=maxGoals;k++){const p=poissonPmf(lambda,k);out.push({goals:k,p});sum+=p}if(sum<1)out[out.length-1].p+=1-sum;return out}
function splitQuarterLine(line){
  const l=finite(line);if(l==null)return [];const q=Math.round(l*4)/4,frac=((q%1)+1)%1;
  if(Math.abs(frac-.25)<1e-9)return [round(q-.25,2),round(q+.25,2)];
  if(Math.abs(frac-.75)<1e-9)return [round(q-.25,2),round(q+.25,2)];
  return [q];
}
function binaryResult(value,line,side){
  const v=finite(value),l=finite(line);if(v==null||l==null)return null;
  const d=side==='OVER'?v-l:l-v;return d>1e-9?'WIN':d<-1e-9?'LOSS':'PUSH';
}
function combineHalf(a,b){
  const xs=[a,b],wins=xs.filter(x=>x==='WIN').length,losses=xs.filter(x=>x==='LOSS').length,pushes=xs.filter(x=>x==='PUSH').length;
  if(wins===2)return 'WIN';if(losses===2)return 'LOSS';if(pushes===2)return 'PUSH';if(wins===1&&pushes===1)return 'HALF_WIN';
  if(losses===1&&pushes===1)return 'HALF_LOSS';if(wins===1&&losses===1)return 'PUSH';return 'PUSH';
}
export function asianTotalResult(finalGoals,line,side='OVER'){
  const parts=splitQuarterLine(line),s=String(side).toUpperCase();if(!parts.length||!['OVER','UNDER'].includes(s))return null;
  const r=parts.map(x=>binaryResult(finalGoals,x,s));return r.length===1?r[0]:combineHalf(r[0],r[1]);
}
export function asianHandicapResult(homeGoals,awayGoals,line,selection='HOME'){
  const parts=splitQuarterLine(line),sel=String(selection).toUpperCase();if(!parts.length||!['HOME','AWAY'].includes(sel))return null;
  const one=h=>{const margin=sel==='HOME'?Number(homeGoals)-Number(awayGoals):Number(awayGoals)-Number(homeGoals),d=margin+h;return d>1e-9?'WIN':d<-1e-9?'LOSS':'PUSH'};
  const r=parts.map(one);return r.length===1?r[0]:combineHalf(r[0],r[1]);
}
function emptyMass(){return {WIN:0,HALF_WIN:0,PUSH:0,HALF_LOSS:0,LOSS:0}}
function addMass(m,result,p){if(result&&m[result]!=null)m[result]+=p}
function summarizeMass(m,offeredOdds){
  const winEq=m.WIN+.5*m.HALF_WIN,lossEq=m.LOSS+.5*m.HALF_LOSS,fairOdds=winEq>0?1+lossEq/winEq:null,o=finite(offeredOdds),
    ev=o!=null?winEq*(o-1)-lossEq:null;
  return {mass:Object.fromEntries(Object.entries(m).map(([k,v])=>[k,round(v,5)])),win_equivalent:round(winEq,5),loss_equivalent:round(lossEq,5),
    fair_odds:round(fairOdds,3),offered_odds:o,expected_return:round(ev,4),edge_pct:ev==null?null:round(ev*100,2)};
}
export function totalEdge({currentGoals=0,lambdaRemaining,line,side='OVER',odds,maxGoals=12}={}){
  const l=finite(line),lam=finite(lambdaRemaining);if(l==null||lam==null||finite(odds)==null)return {valid:false,reason:'MISSING_MODEL_OR_MARKET'};
  const m=emptyMass();for(const r of poissonDist(lam,maxGoals))addMass(m,asianTotalResult(Number(currentGoals)+r.goals,l,side),r.p);
  return {valid:true,market:'TOTAL',selection:String(side).toUpperCase(),line:l,lambda_remaining:round(lam,3),...summarizeMass(m,odds)};
}
export function handicapEdge({homeGoals=0,awayGoals=0,lambdaHomeRemaining,lambdaAwayRemaining,line,selection='HOME',odds,maxGoals=9}={}){
  const lh=finite(lambdaHomeRemaining),la=finite(lambdaAwayRemaining),l=finite(line);if(lh==null||la==null||l==null||finite(odds)==null)return {valid:false,reason:'MISSING_MODEL_OR_MARKET'};
  const hd=poissonDist(lh,maxGoals),ad=poissonDist(la,maxGoals),m=emptyMass();
  for(const h of hd)for(const a of ad)addMass(m,asianHandicapResult(Number(homeGoals)+h.goals,Number(awayGoals)+a.goals,l,selection),h.p*a.p);
  return {valid:true,market:'ASIAN_HANDICAP',selection:String(selection).toUpperCase(),line:l,lambda_home_remaining:round(lh,3),
    lambda_away_remaining:round(la,3),...summarizeMass(m,odds)};
}
export function removeVigTwoWay(aOdds,bOdds){
  const a=finite(aOdds),b=finite(bOdds);if(a==null||b==null||a<=1||b<=1)return null;const ia=1/a,ib=1/b,s=ia+ib;
  return {a:round(ia/s,4),b:round(ib/s,4),overround:round(s-1,4)};
}
export function modelRemainingLambdas(prediction,state={}){
  const eff=finite(prediction?.live_update?.effective_lambda_90??prediction?.base?.lambda_match),minute=finite(state?.minute)??0,
    engine=String(prediction?.engine||'FT'),end=engine==='H1'?45:90,remaining=Math.max(0,end-minute),
    total=eff==null?null:eff*remaining/90,homeShare=finite(prediction?.direction?.home_given_goal),
    home=total==null?null:total*clamp(homeShare??.5),away=total==null?null:total-(home??0);
  return {remaining_minutes:remaining,total:round(total,4),home:round(home,4),away:round(away,4)};
}
