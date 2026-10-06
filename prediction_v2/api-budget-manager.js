/* FOOTBALL EDGE — Prediction V2 / B2
 * Provider-aware API budget manager.
 * SHADOW / candidate only. No production behavior change.
 */
export const API_PRIORITY=Object.freeze({CRITICAL:5,HIGH:4,MEDIUM:3,LOW:2,BACKGROUND:1});
export const DEFAULT_API_PLAN=Object.freeze({
  dailyLimit:75000,minuteLimit:450,resetHourUTC:0,hardReserveCalls:60,minuteReserveCalls:20,
  staleProviderMs:5*60*1000,minBackoffMs:1500,maxBackoffMs:60000
});
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function getHeader(headers,name){
  if(!headers)return null;
  try{if(typeof headers.get==='function'){const v=headers.get(name)??headers.get(name.toLowerCase())??headers.get(name.toUpperCase());return v==null?null:v}}catch{}
  const wanted=String(name).toLowerCase();for(const [k,v] of Object.entries(headers||{}))if(String(k).toLowerCase()===wanted)return v;
  return null;
}
export function parseRateLimitHeaders(headers){
  return {
    dailyLimit:finite(getHeader(headers,'x-ratelimit-requests-limit')),
    dailyRemaining:finite(getHeader(headers,'x-ratelimit-requests-remaining')),
    minuteLimit:finite(getHeader(headers,'x-ratelimit-limit')),
    minuteRemaining:finite(getHeader(headers,'x-ratelimit-remaining'))
  };
}
export function msUntilUtcReset(now=Date.now(),resetHourUTC=0){
  const next=new Date(now);next.setUTCHours(resetHourUTC,0,0,0);if(next.getTime()<=now)next.setUTCDate(next.getUTCDate()+1);return Math.max(1,next.getTime()-now);
}
export function quotaPace({remaining,limit,now=Date.now(),resetHourUTC=0}){
  const rem=finite(remaining),lim=finite(limit);if(rem==null||lim==null||lim<=0)return {known:false};
  const hoursLeft=msUntilUtcReset(now,resetHourUTC)/3600000,remainingPct=clamp(rem/lim,0,1),idealRemainingPct=clamp(hoursLeft/24,0,1);
  return {known:true,hoursLeft,remainingPct,idealRemainingPct,surplusPct:remainingPct-idealRemainingPct,burnPerHour:hoursLeft>0?rem/hoursLeft:rem};
}
export class ApiBudgetManager{
  constructor(config={}){
    this.cfg={...DEFAULT_API_PLAN,...config};
    this.state={day:null,localNetworkCalls:0,providerDailyLimit:null,providerDailyRemaining:null,providerMinuteLimit:null,providerMinuteRemaining:null,providerObservedAt:0,statusObservedAt:0,consecutive429:0,backoffUntil:0,lastMode:'UNKNOWN'};
  }
  resetDayIfNeeded(now=Date.now()){
    const day=new Date(now).toISOString().slice(0,10);if(this.state.day!==day){this.state.day=day;this.state.localNetworkCalls=0;this.state.consecutive429=0;this.state.backoffUntil=0}
  }
  observeHeaders(headers,now=Date.now()){
    this.resetDayIfNeeded(now);const x=parseRateLimitHeaders(headers);this.state.localNetworkCalls++;
    if(x.dailyLimit!=null)this.state.providerDailyLimit=x.dailyLimit;if(x.dailyRemaining!=null)this.state.providerDailyRemaining=x.dailyRemaining;
    if(x.minuteLimit!=null)this.state.providerMinuteLimit=x.minuteLimit;if(x.minuteRemaining!=null)this.state.providerMinuteRemaining=x.minuteRemaining;
    if(Object.values(x).some(v=>v!=null))this.state.providerObservedAt=now;this.state.consecutive429=0;return this.snapshot(now);
  }
  observeStatusPayload(payload,now=Date.now()){
    this.resetDayIfNeeded(now);const req=payload?.requests||payload?.response?.requests||{},limit=finite(req.limit_day??req.limit??req.daily_limit),current=finite(req.current??req.used);
    if(limit!=null)this.state.providerDailyLimit=limit;if(limit!=null&&current!=null)this.state.providerDailyRemaining=Math.max(0,limit-current);this.state.statusObservedAt=now;return this.snapshot(now);
  }
  observe429(now=Date.now()){
    this.resetDayIfNeeded(now);this.state.consecutive429=Math.min(8,this.state.consecutive429+1);
    const delay=Math.min(this.cfg.maxBackoffMs,this.cfg.minBackoffMs*(2**(this.state.consecutive429-1)));this.state.backoffUntil=Math.max(this.state.backoffUntil,now+delay);return delay;
  }
  effectiveDaily(now=Date.now()){
    this.resetDayIfNeeded(now);const providerFresh=this.state.providerObservedAt>0&&now-this.state.providerObservedAt<=this.cfg.staleProviderMs,
      providerLimit=finite(this.state.providerDailyLimit),providerRemaining=finite(this.state.providerDailyRemaining),configuredLimit=finite(this.cfg.dailyLimit)||75000,
      localRemaining=Math.max(0,configuredLimit-this.state.localNetworkCalls),limit=providerFresh&&providerLimit!=null?providerLimit:configuredLimit,
      remaining=providerFresh&&providerRemaining!=null?Math.min(providerRemaining,localRemaining):localRemaining;
    return {limit,remaining,providerFresh,localRemaining};
  }
  mode(now=Date.now()){
    const daily=this.effectiveDaily(now),pace=quotaPace({remaining:daily.remaining,limit:daily.limit,now,resetHourUTC:this.cfg.resetHourUTC}),pct=pace.known?pace.remainingPct:1,hrs=pace.known?pace.hoursLeft:24,
      dynamicReserve=Math.max(this.cfg.hardReserveCalls,Math.round(daily.limit*(hrs<=2?.0025:hrs<=6?.006:.012))),surplus=pace.known&&pace.surplusPct>=.10,behind=pace.known&&pace.surplusPct<=-.10;
    let key='NORMAL';if(daily.remaining<=dynamicReserve)key='RESERVE';else if(pct<=.03)key='VERY_LOW';else if(pct<=.08)key='LOW';else if(behind)key='AHEAD_OF_BURN';else if(surplus)key='SURPLUS';
    this.state.lastMode=key;return {key,daily,pace,dynamicReserve};
  }
  decision({priority='MEDIUM',candidate=false,now=Date.now()}={}){
    this.resetDayIfNeeded(now);const rank=typeof priority==='number'?priority:(API_PRIORITY[String(priority).toUpperCase()]||API_PRIORITY.MEDIUM);
    if(now<this.state.backoffUntil)return {allow:false,reason:'RATE_BACKOFF',delayMs:this.state.backoffUntil-now,mode:this.state.lastMode};
    const m=this.mode(now),minRem=finite(this.state.providerMinuteRemaining),minLim=finite(this.state.providerMinuteLimit)||this.cfg.minuteLimit;
    if(minRem!=null&&minRem<=this.cfg.minuteReserveCalls){const ratio=minLim>0?minRem/minLim:0,delay=Math.max(1000,Math.round((1-ratio)*6000));if(rank<API_PRIORITY.CRITICAL)return {allow:false,reason:'MINUTE_RESERVE',delayMs:delay,mode:m.key}}
    if(m.key==='RESERVE')return {allow:rank>=API_PRIORITY.CRITICAL,reason:rank>=API_PRIORITY.CRITICAL?'CRITICAL_ONLY':'DAILY_RESERVE',delayMs:rank>=API_PRIORITY.CRITICAL?0:60000,mode:m.key};
    if(m.key==='VERY_LOW')return {allow:rank>=API_PRIORITY.HIGH||(candidate&&rank>=API_PRIORITY.MEDIUM),reason:'VERY_LOW_DAILY',delayMs:rank>=API_PRIORITY.HIGH?0:60000,mode:m.key};
    if(m.key==='LOW')return {allow:rank>=API_PRIORITY.MEDIUM||(candidate&&rank>=API_PRIORITY.LOW),reason:'LOW_DAILY',delayMs:rank>=API_PRIORITY.MEDIUM?0:30000,mode:m.key};
    return {allow:true,reason:m.key==='SURPLUS'?'USE_SURPLUS':'NORMAL',delayMs:0,mode:m.key};
  }
  recommendedBreadthRaw(key){
    if(key==='SURPLUS')return {deepCandidates:24,contextTeams:40,backfillFixtures:80,ttlMultiplier:1};
    if(key==='NORMAL')return {deepCandidates:16,contextTeams:28,backfillFixtures:40,ttlMultiplier:1};
    if(key==='AHEAD_OF_BURN')return {deepCandidates:12,contextTeams:20,backfillFixtures:12,ttlMultiplier:1.25};
    if(key==='LOW')return {deepCandidates:8,contextTeams:12,backfillFixtures:0,ttlMultiplier:1.5};
    if(key==='VERY_LOW')return {deepCandidates:5,contextTeams:6,backfillFixtures:0,ttlMultiplier:2};
    return {deepCandidates:3,contextTeams:0,backfillFixtures:0,ttlMultiplier:3};
  }
  recommendedBreadth(now=Date.now()){return this.recommendedBreadthRaw(this.mode(now).key)}
  snapshot(now=Date.now()){
    const m=this.mode(now);return {...this.state,effective_limit:m.daily.limit,effective_remaining:m.daily.remaining,provider_fresh:m.daily.providerFresh,pace:m.pace,mode:m.key,dynamic_reserve:m.dynamicReserve,breadth:this.recommendedBreadthRaw(m.key)};
  }
}
