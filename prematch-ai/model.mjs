import {MODEL,fixtureOK,time,requireValue,digest,omitHash} from './contracts.mjs';
const sum=a=>a.reduce((s,x)=>s+x,0);
export function poisson(lambda){
 requireValue(Number.isFinite(lambda)&&lambda>=0&&lambda<=100,'RATE_OUT_OF_NUMERICAL_SCOPE');
 let p=Math.exp(-lambda),total=p;const a=[p];
 for(let k=1;k<1000;k++){p*=lambda/k;a.push(p);total+=p;if(k>lambda&&1-total<1e-12)break;}
 requireValue(Math.abs(1-total)<1e-8,'POISSON_TAIL_NOT_BOUNDED');a[a.length-1]+=1-total;return a;
}
function rates(fit,f){return {home:Math.exp(fit.intercept+(f.neutralVenue===true?0:fit.homeAdvantage)+(fit.teams[f.home.id]?.attack??0)+(fit.teams[f.away.id]?.defenceWeakness??0)),away:Math.exp(fit.intercept+(fit.teams[f.away.id]?.attack??0)+(fit.teams[f.home.id]?.defenceWeakness??0))};}
function matrix(l){const h=poisson(l.home),a=poisson(l.away);return h.map(x=>a.map(y=>x*y));}
export function summarize(joint){
 let home=0,draw=0,away=0,meanHome=0,meanAway=0;const totals=[],difference={};
 joint.forEach((r,h)=>r.forEach((p,a)=>{if(h>a)home+=p;else if(h===a)draw+=p;else away+=p;meanHome+=h*p;meanAway+=a*p;totals[h+a]=(totals[h+a]||0)+p;difference[h-a]=(difference[h-a]||0)+p;}));
 requireValue(Math.abs(home+draw+away-1)<1e-8,'JOINT_MASS_INVALID');
 return {wdl:{HOME:home,DRAW:draw,AWAY:away},meanHome,meanAway,totals,difference,goalBands:[sum(totals.slice(0,2)),sum(totals.slice(2,4)),sum(totals.slice(4))]};
}
function phaseView(artifact,f,variant){
 const htFit=artifact.phases.HT?.[variant],h2Fit=artifact.phases.H2?.[variant];
 const ht=htFit?rates(htFit,f):null,h2=h2Fit?rates(h2Fit,f):null;
 const ft=ht&&h2?{home:ht.home+h2.home,away:ht.away+h2.away}:rates(artifact.phases.FT[variant],f);
 return {FT:matrix(ft),HT:ht?matrix(ht):null,H2:h2?matrix(h2):null,rates:{FT:ft,HT:ht,H2:h2}};
}
function htft(ht,h2){if(!ht||!h2)return null;const a=summarize(ht).difference,b=summarize(h2).difference,out=Object.fromEntries(['HOME','DRAW','AWAY'].flatMap(h=>['HOME','DRAW','AWAY'].map(f=>[h+'_'+f,0]))),result=d=>d>0?'HOME':d<0?'AWAY':'DRAW';for(const [x,p]of Object.entries(a))for(const [y,q]of Object.entries(b))out[result(+x)+'_'+result(+x+(+y))]+=p*q;return out;}
export async function predict(f,artifact,{now=Date.now()}={}){
 const wait=reason=>({status:'MODEL_WAIT',reason,fixture:structuredClone(f),forecast:null});
 if(!fixtureOK(f)||!time(now)||f.observedAt>now)return wait('INVALID_OR_FUTURE_SNAPSHOT');
 if(f.status!=='NS')return wait('SOURCE_NOT_PRE_MATCH');
 if(!artifact||artifact.schema!=='FE_PREMATCH_MODEL_ARTIFACT_V1'||artifact.version!==MODEL||artifact.leagueId!==f.league.id||!time(artifact.cutoff)||artifact.cutoff>f.observedAt)return wait('MATCHING_ASOF_ARTIFACT_REQUIRED');
 if(artifact.synthetic!==true&&f.kind==='LAB'||artifact.synthetic===true&&f.kind!=='LAB')return wait('LAB_REAL_DATA_MIX_FORBIDDEN');
 if(artifact.hash!==await digest(omitHash(artifact)))return wait('ARTIFACT_HASH_MISMATCH');
 try{
  for(const phase of ['FT','HT','H2'])if(artifact.phases[phase]){
   const fit=artifact.phases[phase].primary;
   requireValue(fit?.converged===true,'MODEL_FIT_NOT_CONVERGED');
   requireValue(fit&&Number.isFinite(fit.intercept)&&Number.isFinite(fit.homeAdvantage),'INVALID_MODEL_PARAMETERS');
   for(const t of Object.values(fit.teams))requireValue(Number.isFinite(t.attack)&&Number.isFinite(t.defenceWeakness),'INVALID_TEAM_PARAMETERS');
  }
  const base=phaseView(artifact,f,'primary'),alternative=phaseView(artifact,f,'baseline'),ft=summarize(base.FT),ht=base.HT?summarize(base.HT):null;
  const sample={home:artifact.phases.FT.primary.teams[f.home.id]?.sample??0,away:artifact.phases.FT.primary.teams[f.away.id]?.sample??0,league:artifact.training.fixtures,ht:artifact.phases.HT?.fixtures??0};
  const forecast={schema:'FE_PREMATCH_FORECAST_V1',fixtureId:f.id,kind:f.kind,cutoff:f.observedAt,kickoff:f.kickoff,artifactHash:artifact.hash,modelVersion:MODEL,trainCutoff:artifact.cutoff,calibrated:false,means:base.rates,distributions:{FT:base.FT,HT:base.HT},summary:{FT:ft,HT:ht,HTFT:htft(base.HT,base.H2)},variants:[{name:'LEAGUE_ONLY_BASELINE',distributions:{FT:alternative.FT,HT:alternative.HT}}],sample,
   uncertainty:{kind:'MODEL_VARIATION_NOT_CONFIDENCE_INTERVAL',validated:false,reason:'Đối chiếu mô hình đội và baseline cấp giải; chưa phải khoảng tin cậy đã hiệu chỉnh.'},
   applicability:sample.home&&sample.away?'RESEARCH':'LIMITED_LEAGUE_PRIOR',assumptions:['CONDITIONAL_INDEPENDENT_POISSON_GOALS','OPPONENT_ADJUSTED_ATTACK_DEFENCE','NO_ODDS_INPUT','NO_FITTED_PLAYER_TACTICAL_EFFECT','UNCALIBRATED_RESEARCH'],synthetic:artifact.synthetic===true};
  forecast.id=await digest(forecast);
  return {status:forecast.applicability==='RESEARCH'?'FOOTBALL_READY':'LIMITED',reason:null,fixture:structuredClone(f),forecast};
 }catch(e){return wait(String(e.message||e));}
}
