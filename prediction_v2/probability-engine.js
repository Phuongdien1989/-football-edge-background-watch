/* FOOTBALL EDGE — Prediction V2 / B3
 * Continuous shadow probability model.
 * BASE PROBABILITY -> LIVE UPDATE -> CONFIDENCE.
 * No market price/odds are consumed here. No PASS/FAIL or entry decision is emitted.
 */
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const round=(v,d=4)=>{const n=finite(v);if(n==null)return null;const p=10**d;return Math.round(n*p)/p};
const mean=a=>{const x=(a||[]).map(finite).filter(v=>v!=null);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
const logistic=z=>1/(1+Math.exp(-z));
const pct=p=>p==null?null:round(clamp(p,0,1)*100,1);
function contextLambdas(context){
  const h=context?.home?.strength||{},a=context?.away?.strength||{};
  const hGF=finite(h.goals_for_avg),hGA=finite(h.goals_against_avg),aGF=finite(a.goals_for_avg),aGA=finite(a.goals_against_avg);
  const home=mean([hGF,aGA]),away=mean([aGF,hGA]),total=home!=null&&away!=null?home+away:mean([hGF,hGA,aGF,aGA]);
  return {home:home==null?null:clamp(home,.15,4),away:away==null?null:clamp(away,.15,4),total:total==null?null:clamp(total,.6,6),
    source:(home!=null&&away!=null)?'TEAM_ATTACK_DEFENCE':'PARTIAL_TEAM_RATE'};
}
function horizonFor(packet,h){
  const m=finite(packet?.state?.minute)||0,e=String(packet?.engine||'FT'),remaining=e==='H1'?Math.max(0,45-m):Math.max(0,90-m);
  return Math.max(0,Math.min(h,remaining));
}
function poissonGoal(lambda90,h){const l=finite(lambda90);if(l==null||l<0)return null;const hh=Math.max(0,finite(h)||0);return clamp(1-Math.exp(-(l/90)*hh),0,1)}
function calibrationBlend(raw,cal,h){
  const p=finite(cal?.[`goal_${h}m_rate`]??cal?.[`p${h}`]??cal?.probability),n=finite(cal?.n);
  if(raw==null||p==null||n==null||n<=0)return {p:raw,weight:0};
  const w=clamp(n/(n+250),0,.72);return {p:clamp(raw*(1-w)+p*w,0,1),weight:round(w,3)};
}
function componentLiveIndex(packet){
  const c=packet?.live?.components||{},parts=[];
  const add=(name,w)=>{const v=finite(c[name]);if(v!=null)parts.push({name,value:clamp(v),weight:w})};
  add('pressure',.31);add('chance',.31);add('momentum',.24);add('game',.10);add('legacy_context',.04);
  const den=parts.reduce((s,x)=>s+x.weight,0),base=den?parts.reduce((s,x)=>s+x.value*x.weight,0)/den:.5,
    acc=clamp(finite(packet?.live?.acceleration)||0,-1,1),delta=(base-.5)*1.35+acc*.20;
  return {index:round(base,3),acceleration:round(acc,3),log_hazard_delta:round(delta,4),parts};
}
function directionalContext(packet,base){
  const dom=finite(packet?.live?.dominance),ctx=finite(packet?.context?.directional_index),homeL=finite(base?.home_lambda),awayL=finite(base?.away_lambda),
    prior=homeL!=null&&awayL!=null?Math.log(clamp(homeL,.05,8)/clamp(awayL,.05,8)):0,
    z=prior+(dom??0)*.90+(ctx??0)*.35,home=logistic(z);
  return {home_given_goal:round(home,4),away_given_goal:round(1-home,4),dominance:dom,context_index:ctx,logit:round(z,4)};
}
function confidence(packet,base,calibration){
  const q=packet?.quality||{},liveCoverage=clamp(finite(packet?.live?.component_coverage)??0),dq=clamp(finite(q.dq)??0),fresh=finite(q.freshness_sec),
    freshScore=fresh==null?.35:clamp(1-fresh/120),mature=packet?.live?.mature?1:clamp((finite(packet?.live?.baseline_age_min)||0)/3),
    hc=finite(packet?.context?.home_confidence),ac=finite(packet?.context?.away_confidence),
    contextScore=mean([hc,ac])??(q.context_available?.45:.15),baseScore=base?.fallback?0.25:base?.lambda_match!=null?.85:.15,
    n=finite(calibration?.n)||0,calScore=clamp(n/500),
    score=100*(liveCoverage*.23+dq*.20+freshScore*.16+mature*.13+contextScore*.13+baseScore*.10+calScore*.05);
  const penalties=[];
  if(q.partial)penalties.push('PARTIAL_STATS');if(q.incomplete)penalties.push('DATA_INCOMPLETE');if(q.baseline)penalties.push('BASELINE_IMMATURE');
  if(fresh!=null&&fresh>60)penalties.push('STALE_60S_PLUS');if(base?.fallback)penalties.push('BASELINE_FALLBACK');
  const adjusted=clamp((score-(q.partial?10:0)-(q.incomplete?22:0)-(q.baseline?12:0))/100,0,1),
    band=adjusted>=.72?'HIGH':adjusted>=.48?'MEDIUM':'LOW';
  return {value:round(adjusted,3),score_100:round(adjusted*100,1),band,
    components:{live_coverage:round(liveCoverage,3),dq:round(dq,3),freshness:round(freshScore,3),maturity:round(mature,3),
      context:round(contextScore,3),baseline:round(baseScore,3),calibration:round(calScore,3)},penalties};
}
export function buildBaseProbability(packet,{fallbackLambda90=2.5}={}){
  const c=packet?.context?.packet||null,l=contextLambdas(c),fallback=l.total==null,lambda=fallback?fallbackLambda90:l.total;
  return {lambda_match:round(lambda,3),home_lambda:l.home,away_lambda:l.away,source:fallback?'CONFIGURABLE_NEUTRAL_FALLBACK':l.source,fallback};
}
export function predictShadowProbability(packet,{fallbackLambda90=2.5,calibration=packet?.calibration||null}={}){
  const base=buildBaseProbability(packet,{fallbackLambda90}),live=componentLiveIndex(packet),
    hazardMultiplier=clamp(Math.exp(live.log_hazard_delta),.50,2.50),effectiveLambda=clamp(base.lambda_match*hazardMultiplier,.25,9),probs={},blends={};
  for(const h of [5,10,15]){
    const hh=horizonFor(packet,h),raw=poissonGoal(effectiveLambda,hh),bl=calibrationBlend(raw,calibration,h);
    probs[`goal_${h}m`]=round(bl.p,4);blends[`goal_${h}m`]=bl.weight;
  }
  probs.goal_10m=Math.max(probs.goal_5m??0,probs.goal_10m??0);
  probs.goal_15m=Math.max(probs.goal_10m??0,probs.goal_15m??0);
  const dir=directionalContext(packet,{home_lambda:base.home_lambda,away_lambda:base.away_lambda}),conf=confidence(packet,base,calibration);
  return {schema:'FE_PREDICTION_V2_PROBABILITY_B3',shadow_only:true,market_used:false,fixture_id:packet?.fixture_id??null,
    engine:packet?.engine??null,captured_at:packet?.captured_at??Date.now(),
    base:{...base,goal_5m:pct(poissonGoal(base.lambda_match,horizonFor(packet,5))),goal_10m:pct(poissonGoal(base.lambda_match,horizonFor(packet,10))),
      goal_15m:pct(poissonGoal(base.lambda_match,horizonFor(packet,15)))},
    live_update:{index:live.index,acceleration:live.acceleration,log_hazard_delta:live.log_hazard_delta,hazard_multiplier:round(hazardMultiplier,3),
      effective_lambda_90:round(effectiveLambda,3),parts:live.parts},
    probabilities:{goal_5m:pct(probs.goal_5m),goal_10m:pct(probs.goal_10m),goal_15m:pct(probs.goal_15m),
      home_next_goal_given_goal:pct(dir.home_given_goal),away_next_goal_given_goal:pct(dir.away_given_goal)},
    calibration_blend:blends,direction:dir,confidence:conf,decision:null,
    note:'Shadow probability only. No market edge, threshold gate, TOP mutation or entry decision in B3.'};
}
