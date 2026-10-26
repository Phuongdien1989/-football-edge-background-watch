// HC research model: no I/O, odds, legacy GAP, prediction-score weights or setters.
export const VERSION='HC_TEAM_GAMMA_POISSON_DIFFERENCE_V1';
const n=x=>x===null||x===undefined||typeof x==='boolean'||x===''?null:Number.isFinite(Number(x))?Number(x):null;
const integer=x=>Number.isSafeInteger(x)&&x>=0;
function predictive(alpha,beta,exposure){
 const q=exposure/(beta+exposure);let p=Math.pow(1-q,alpha),sum=p;const out=[p];
 for(let k=1;k<1000;k++){p*=((alpha+k-1)/k)*q;out.push(p);sum+=p;if(k>alpha*exposure/beta&&1-sum<1e-12)break;}
 if(!Number.isFinite(sum)||Math.abs(1-sum)>1e-8)return null;out[out.length-1]+=1-sum;return out;
}
export function modelHC(input={}){
 const fail=reason=>({ok:false,reason,model:null}),id=n(input.fixtureId),home=n(input.homeId),away=n(input.awayId),at=n(input.at),kickoff=n(input.kickoff),minute=n(input.minute),status=input.status,g=input.goals;
 if(!integer(id)||id===0||!integer(home)||!integer(away)||home===away||home===0||away===0||!at||!kickoff||minute===null||minute<0||!['NS','1H','HT','2H','LIVE'].includes(status))return fail('INVALID_FIXTURE_CLOCK');
 if(!integer(g?.home)||!integer(g?.away))return fail('INVALID_SCORE');
 if(status!=='NS'&&kickoff>at||status==='NS'&&(minute!==0||g.home+g.away!==0))return fail('CLOCK_SCORE_MISMATCH');
 if(['2H','LIVE'].includes(status)&&minute>=90)return fail('ADDED_TIME_NOT_MODELED');
 if(minute>90||status==='2H'&&minute<45||status==='HT'&&minute<45)return fail('CLOCK_PHASE_MISMATCH');
 const elapsed=status==='NS'?0:status==='HT'?45:status==='1H'?Math.min(45,minute):minute;
 const unique=new Map(),excluded={future:0,invalid:0,conflict:0};
 for(const r of [...(input.homeRecent||[]),...(input.awayRecent||[])]){
  const date=Date.parse(r.date),h=n(r.home_id),a=n(r.away_id),gh=n(r.goals?.home),ga=n(r.goals?.away),fid=n(r.fixture_id);
  if(date>=kickoff||date>at||fid===id){excluded.future++;continue;}
  if(r.status!=='FT'||!Number.isFinite(date)||!integer(h)||!integer(a)||h===a||!integer(gh)||!integer(ga)||![h,a].includes(home)&&![h,a].includes(away)){excluded.invalid++;continue;}
  const key=fid!==null?'id:'+fid:JSON.stringify([date,h,a]),old=unique.get(key),row={key,date,home:h,away:a,gh,ga};
  if(old&&(old.conflict||JSON.stringify(old)!==JSON.stringify(row))){unique.set(key,{conflict:true});continue;}unique.set(key,row);
 }
 const ordered=[...unique.values()].filter(r=>{if(r.conflict){excluded.conflict++;return false;}return true;}).sort((a,b)=>b.date-a.date||String(a.key).localeCompare(String(b.key)));
 const hr=ordered.filter(r=>[r.home,r.away].includes(home)).slice(0,8),ar=ordered.filter(r=>[r.home,r.away].includes(away)).slice(0,8);
 if(!hr.length||!ar.length)return fail('MISSING_TEAM_FT_HISTORY');
 const pool=[...new Map([...hr,...ar].map(r=>[r.key,r])).values()],forTeam=(r,t)=>r.home===t?r.gh:r.ga,againstTeam=(r,t)=>r.home===t?r.ga:r.gh;
 // Each unique fixture contributes once per target scoring rate. If both target
 // teams played each other, attack and opposing defence are the same observation.
 const historicHome=pool.reduce((sum,r)=>sum+([r.home,r.away].includes(home)?forTeam(r,home):againstTeam(r,away)),0);
 const historicAway=pool.reduce((sum,r)=>sum+([r.home,r.away].includes(away)?forTeam(r,away):againstTeam(r,home)),0);
 const exposure=(90-elapsed)/90,beta=pool.length+elapsed/90,homeAlpha=.5+historicHome+g.home,awayAlpha=.5+historicAway+g.away;
 const hpmf=predictive(homeAlpha,beta,exposure),apmf=predictive(awayAlpha,beta,exposure);if(!hpmf||!apmf)return fail('DISTRIBUTION_INVALID');
 const difference=new Map();for(let h=0;h<hpmf.length;h++)for(let a=0;a<apmf.length;a++)difference.set(h-a,(difference.get(h-a)||0)+hpmf[h]*apmf[a]);
 const remainingDifference=[...difference].sort((a,b)=>a[0]-b[0]).map(([goals,p])=>({goals,p}));
 return {ok:true,reason:null,model:{version:VERSION,kind:'RESEARCH',validated:false,independentOfMarket:true,at,fixtureId:id,
  condition:{minute,status,nominalElapsed:elapsed,score:{...g}},homeRemaining:hpmf,awayRemaining:apmf,remainingDifference,
  meanHomeRemaining:homeAlpha/beta*exposure,meanAwayRemaining:awayAlpha/beta*exposure,
  sample:{home:hr.length,away:ar.length,unique:pool.length},provenance:{fixtureKeys:pool.map(r=>r.key),historicalHomeGoals:historicHome,historicalAwayGoals:historicAway,homeAlpha,awayAlpha,beta,remainingExposure:exposure,excluded},
  assumptions:['COMPARABLE_ATTACK_AND_OPPOSING_DEFENCE_EXPOSURES','EACH_HISTORICAL_FIXTURE_ONCE_PER_RATE','GAMMA_POISSON_POSTERIOR','CONDITION_ON_OBSERVED_SCORE_AND_REGULATION_MINUTE','CONDITIONAL_INDEPENDENCE_OF_FUTURE_TEAM_GOALS','CONSTANT_RATE','NO_OPPONENT_STRENGTH_OR_SHOT_XG_RED_CARD_ADJUSTMENT','ADDED_TIME_NOT_ESTIMATED','UNCALIBRATED_RESEARCH']}};
}
export function differenceSummary(model){
 if(!model||model.version!==VERSION)return null;
 const out={homeMoreRemaining:0,sameRemaining:0,awayMoreRemaining:0,homeWinFT:0,drawFT:0,awayWinFT:0,expectedFinalGoalDifference:null};
 const initial=model.condition.score.home-model.condition.score.away;
 for(const x of model.remainingDifference){out[x.goals>0?'homeMoreRemaining':x.goals<0?'awayMoreRemaining':'sameRemaining']+=x.p;const full=initial+x.goals;out[full>0?'homeWinFT':full<0?'awayWinFT':'drawFT']+=x.p;}
 out.expectedFinalGoalDifference=initial+model.meanHomeRemaining-model.meanAwayRemaining;return out;
}
