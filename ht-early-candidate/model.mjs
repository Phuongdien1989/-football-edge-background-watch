// Transparent HT-only research model. No market inputs or score-to-probability conversion.
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const time=x=>finite(x)&&x>0?(x<1e12?x*1000:x):null;
const integer=x=>Number.isInteger(x)&&x>=0;
function poisson(lambda) {
 if(!finite(lambda)||lambda<0)return null;
 let p=Math.exp(-lambda),sum=p;const out=[p];
 for(let k=1;k<500;k++){p*=lambda/k;out.push(p);sum+=p;if(k>lambda&&1-sum<1e-12)break;}
 if(!finite(sum)||1-sum>1e-8)return null;out[out.length-1]+=1-sum;return out;
}
function predictive(alpha,beta,exposure) {
 const q=exposure/(beta+exposure);let p=Math.pow(1-q,alpha),sum=p;const pmf=[p];
 for(let k=1;k<500;k++){p*=((alpha+k-1)/k)*q;pmf.push(p);sum+=p;if(k>alpha*exposure/beta&&1-sum<1e-12)break;}
 if(!finite(sum)||1-sum>1e-8)return null;pmf[pmf.length-1]+=1-sum;return pmf;
}
export function htTeamModel(snapshot,fixture,context) {
 const home=fixture?.teams?.home?.id,away=fixture?.teams?.away?.id,kickoff=time(fixture?.fixture?.timestamp),at=snapshot?.at,m=snapshot?.minute;
 if(fixture?.fixture?.id!==snapshot?.id||kickoff>at||!Number.isSafeInteger(home)||!Number.isSafeInteger(away)||home===away||!kickoff||!finite(at)||!finite(m)||m<=0||m>=45||!['1H','LIVE'].includes(snapshot?.status)
   ||!integer(snapshot.goals?.home)||!integer(snapshot.goals?.away)||!finite(context?.at)||context.at>at||context.at<=0)return null;
 const unique=new Map();
 for(const r of context.rows||[]) {
   const id=r.fixture_id,date=time(r.kickoff);
   if(!Number.isSafeInteger(id)||id===snapshot.id||!date||date>=kickoff||date>=at||r.status!=='FT'||!integer(r.halftime_home)||!integer(r.halftime_away))continue;
   const old=unique.get(id);
   if(old&&(old.halftime_home!==r.halftime_home||old.halftime_away!==r.halftime_away)){unique.set(id,{conflict:true});continue;}
   if(old?.conflict)continue;unique.set(id,{...r,date});
 }
 const rows=[...unique.values()].filter(r=>!r.conflict).sort((a,b)=>b.date-a.date||a.fixture_id-b.fixture_id);
 const involved=(r,id)=>r.home_team_id===id||r.away_team_id===id;
 const h=rows.filter(r=>involved(r,home)).slice(0,8),a=rows.filter(r=>involved(r,away)).slice(0,8);
 if(!h.length||!a.length)return null;
 const pool=[...new Map([...h,...a].map(r=>[r.fixture_id,r])).values()];
 const total=pool.reduce((n,r)=>n+r.halftime_home+r.halftime_away,0),goals=snapshot.goals.home+snapshot.goals.away;
 // Jeffreys prior for a Poisson rate: alpha=1/2. Each historic HT is one exposure.
 // The current elapsed HT supplies goals and fractional exposure, without market data.
 const alpha=.5+total+goals,beta=pool.length+m/45,remaining=(45-m)/45,lambda=alpha/beta*remaining,pmf=predictive(alpha,beta,remaining);
 if(!pmf)return null;
 const sd=Math.sqrt(alpha)/beta*remaining;
 const scenarios=[{name:'RATE_MINUS_ONE_POSTERIOR_SD',pmf:poisson(Math.max(0,lambda-sd))},{name:'RATE_PLUS_ONE_POSTERIOR_SD',pmf:poisson(lambda+sd)}];
 return {version:'HT_TEAM_GAMMA_POISSON_RESEARCH_V1',fixtureId:snapshot.id,period:'H1_REMAINING',kind:'RESEARCH',validated:false,independent:true,at,
   condition:{at,minute:m,goals:{...snapshot.goals}},pmf,scenarios,lambda,sample:{home:h.length,away:a.length,unique:pool.length},
   provenance:{contextAt:context.at,kickoff,fixtureIds:pool.map(r=>r.fixture_id),historicalHTGoals:total,alpha,beta},
   assumptions:['TRUE_HALFTIME_SCORES_ONLY','JEFFREYS_POISSON_RATE_PRIOR','CONSTANT_RATE_WITHIN_HT','NOMINAL_45_MINUTE_CLOCK','ADDED_TIME_NOT_ESTIMATED','NO_OPPONENT_STRENGTH_ADJUSTMENT','NO_SHOT_OR_RED_CARD_RATE_ADJUSTMENT','UNCALIBRATED_RESEARCH']};
}
