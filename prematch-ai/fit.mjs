// Offline training only. Never imported by the UI or worker runtime.
import {MODEL,count,time,requireValue,canonical,digest} from './contracts.mjs';
export function historyAt(rows,cutoff,leagueId){
 requireValue(time(cutoff)&&Array.isArray(rows),'INVALID_TRAIN_INPUT');const map=new Map(),excluded=[];
 for(const r of rows){
  let reason=null;
  if(!Number.isSafeInteger(r?.id)||r.id<=0||!time(r.kickoff)||!time(r.availableAt)||r.kickoff>=r.availableAt||r.availableAt>cutoff)reason='ASOF_OR_ID';
  else if(r.leagueId!==leagueId)reason='OTHER_LEAGUE';
  else if(!Number.isSafeInteger(r.homeId)||r.homeId<=0||!Number.isSafeInteger(r.awayId)||r.awayId<=0||r.homeId===r.awayId)reason='TEAMS';
  else if(!['FT','AET','PEN'].includes(r.status)||!count(r.regulation?.home)||!count(r.regulation?.away))reason='REGULATION_SCORE_REQUIRED';
  else if(r.halftime!=null&&(!count(r.halftime.home)||!count(r.halftime.away)||r.halftime.home>r.regulation.home||r.halftime.away>r.regulation.away))reason='INVALID_HT';
  if(reason){excluded.push({id:r?.id??null,reason});continue;}
  if(map.has(r.id)&&canonical(map.get(r.id))!==canonical(r)){map.set(r.id,{id:r.id,conflict:true});continue;}
  map.set(r.id,structuredClone(r));
 }
 const out=[...map.values()].filter(r=>{if(r.conflict){excluded.push({id:r.id,reason:'CONFLICTING_REVISION'});return false;}return true;}).sort((a,b)=>a.kickoff-b.kickoff||a.id-b.id);
 return {rows:out,excluded};
}
function observations(rows,period){return rows.flatMap(r=>{const s=period==='HT'?r.halftime:period==='H2'&&r.halftime?{home:r.regulation.home-r.halftime.home,away:r.regulation.away-r.halftime.away}:period==='FT'?r.regulation:null;return s?[{a:r.homeId,d:r.awayId,home:1,y:s.home},{a:r.awayId,d:r.homeId,home:0,y:s.away}]:[];});}
export function fitRate(rows,{period='FT',ridge=1,maxSweeps=300}={}){
 const obs=observations(rows,period);requireValue(obs.length>0,'NO_PERIOD_DATA');
 const ids=[...new Set(obs.flatMap(r=>[r.a,r.d]))].sort((a,b)=>a-b),idx=new Map(ids.map((x,i)=>[x,i])),p=2+2*ids.length,theta=Array(p).fill(0);
 // Pseudo-count free initialization; zero-only samples are bounded numerically,
 // but not allowed to produce a separately claimed calibrated prediction.
 theta[0]=Math.log(Math.max(1e-8,obs.reduce((s,x)=>s+x.y,0)/obs.length));
 const design=obs.map(o=>({y:o.y,ix:[0,...(o.home?[1]:[]),2+idx.get(o.a),2+ids.length+idx.get(o.d)]}));
 const members=Array.from({length:p},()=>[]);design.forEach((o,i)=>o.ix.forEach(k=>members[k].push(i)));
 const eta=design.map(o=>o.ix.reduce((s,k)=>s+theta[k],0));let converged=false;
 for(let s=0;s<maxSweeps;s++){
  let max=0;
  for(let k=0;k<p;k++){
   const penalty=k<2?0:ridge;let grad=-penalty*theta[k],curv=penalty;
   for(const i of members[k]){const mu=Math.exp(eta[i]);grad+=design[i].y-mu;curv+=mu;}
   if(curv===0)continue;
   const step=Math.max(-1,Math.min(1,grad/curv));theta[k]+=step;max=Math.max(max,Math.abs(step));for(const i of members[k])eta[i]+=step;
  }
  // Sum-to-zero identifiability; compensate intercept exactly.
  for(const start of [2,2+ids.length]){const mean=theta.slice(start,start+ids.length).reduce((a,b)=>a+b,0)/ids.length;for(let i=start;i<start+ids.length;i++)theta[i]-=mean;theta[0]+=mean;}
  if(max<1e-7){converged=true;break;}
 }
 const teams=Object.fromEntries(ids.map((id,i)=>[id,{attack:theta[2+i],defenceWeakness:theta[2+ids.length+i],sample:rows.filter(r=>r.homeId===id||r.awayId===id).length}]));
 const loss=design.reduce((s,o)=>{const e=o.ix.reduce((v,k)=>v+theta[k],0);return s+Math.exp(e)-o.y*e;},0)/design.length;
 return {period,intercept:theta[0],homeAdvantage:theta[1],teams,ridge,converged,loss,observations:obs.length};
}
export function rate(fit,h,a){return {home:Math.exp(fit.intercept+fit.homeAdvantage+(fit.teams[h]?.attack??0)+(fit.teams[a]?.defenceWeakness??0)),away:Math.exp(fit.intercept+(fit.teams[a]?.attack??0)+(fit.teams[h]?.defenceWeakness??0))};}
function heldoutLoss(fit,rows){const obs=observations(rows,fit.period);if(!obs.length)return null;return obs.reduce((s,o)=>{const m=rate(fit,o.home?o.a:o.d,o.home?o.d:o.a)[o.home?'home':'away'];return s+m-o.y*Math.log(m);},0)/obs.length;}
function periodFit(rows,period){
 const eligible=period==='FT'?rows:rows.filter(r=>r.halftime);
 if(!eligible.length)return null;
 const times=[...new Set(eligible.map(r=>r.kickoff))],boundary=times[Math.floor(times.length*.8)],train=eligible.filter(r=>r.kickoff<boundary&&r.availableAt<=boundary),validation=eligible.filter(r=>r.kickoff>=boundary);
 const trials=[.1,1,10].map(ridge=>{const f=fitRate(train.length?train:eligible,{period,ridge});return {ridge,validationLoss:train.length&&validation.length?heldoutLoss(f,validation):null};});
 const chosen=[...trials].sort((a,b)=>(a.validationLoss??Infinity)-(b.validationLoss??Infinity)||Math.abs(Math.log(a.ridge))-Math.abs(Math.log(b.ridge)))[0];
 const model=fitRate(eligible,{period,ridge:chosen.ridge});
 // League-only baseline is an independently fitted simpler model, NOT a confidence interval.
 const obs=observations(eligible,period),home=obs.filter(o=>o.home),away=obs.filter(o=>!o.home),mean=x=>x.reduce((s,o)=>s+o.y,0)/x.length;
 const ah=Math.max(1e-8,mean(home)),aa=Math.max(1e-8,mean(away));
 return {primary:model,baseline:{period,intercept:Math.log(aa),homeAdvantage:Math.log(ah/aa),teams:{},kind:'LEAGUE_ONLY_BASELINE'},selection:{method:train.length?'CHRONOLOGICAL_HOLDOUT':'NO_HOLDOUT_AVAILABLE',trainFixtures:train.length,validationFixtures:validation.length,boundary:boundary??null,trials},fixtures:eligible.length};
}
export async function trainArtifact(input){
 const {rows,excluded}=historyAt(input.history,input.cutoff,input.leagueId);requireValue(rows.length>0,'NO_ASOF_HISTORY');
 const phases={FT:periodFit(rows,'FT'),HT:periodFit(rows,'HT'),H2:periodFit(rows,'H2')};
 const artifact={schema:'FE_PREMATCH_MODEL_ARTIFACT_V1',version:MODEL,leagueId:input.leagueId,cutoff:input.cutoff,synthetic:input.synthetic===true,calibrated:false,phases,historyHash:await digest(rows),training:{fixtureIds:rows.map(r=>r.id),fixtures:rows.length,firstKickoff:rows[0].kickoff,lastAvailableAt:Math.max(...rows.map(r=>r.availableAt)),excluded,method:'RIDGE_POISSON_ATTACK_DEFENCE',timeWeighting:'NONE_V1',uncertainty:'BASELINE_MODEL_VARIATION_NOT_CONFIDENCE_INTERVAL',advancedFeatures:'NOT_FITTED'}};
 artifact.hash=await digest(artifact);return artifact;
}
