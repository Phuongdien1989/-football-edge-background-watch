// Five-minute research reference only. No entry authorization, I/O or persistence.
const copy=x=>structuredClone(x),TTL=300000;
const key=q=>JSON.stringify([q?.sourceId,q?.marketId,q?.mode,q?.period,q?.line]);
const phase=s=>s==='1H'||s==='HT'||s==='2H'||s==='NS'?s:'OTHER';
function snapshot(row,v){return {fixtureId:row.id,home:row.home,away:row.away,league:row.league,at:row.at,minute:row.context?.minute??row.model?.condition?.minute,context:copy(row.context||row.model?.condition||{}),quote:copy(v.quote),result:copy(v.result)};}
function valid(row,v,now){return row?.model&&Number.isFinite(row.at)&&row.at<=now+5000&&now-row.at<=60000&&Number.isFinite(v?.quote?.quoteAt)&&v.quote.quoteAt<=now+5000&&now-v.quote.quoteAt<=60000&&['RULE_WAIT','RESEARCH_PRICED'].includes(v.result?.status)&&!!(v.result.prices||v.result.scenarios);}
export function createHCResearchSessions(){
 const sessions=new Map(),watermarks=new Map();let clock=-Infinity;
 function time(now){if(!Number.isFinite(now))throw Error('INVALID_SESSION_TIME');clock=Math.max(clock,now);return clock;}
 function expire(now){for(const [id,s]of sessions)if(now>=s.expiresAt){watermarks.set(id,s.expiresAt);sessions.delete(id);}while(watermarks.size>100)watermarks.delete(watermarks.keys().next().value);}
 function read(id,now){now=time(now);expire(now);const s=sessions.get(id);if(!s)return null;const out=copy(s);if(out.status==='TRACKING'&&(now-out.current.at>60000||now-out.current.quote.quoteAt>60000)){out.status='PAUSED';out.reason='STALE';}return out;}
 function update(rows,now){now=time(now);expire(now);const ids=new Set(rows.map(r=>r.id));
  for(const [id,s]of sessions)if(!ids.has(id)&&s.status!=='INVALIDATED'){s.status='PAUSED';s.reason='SOURCE_MISSING';}
  for(const row of rows.slice(0,5)){
   const v=row.valuations?.[0],good=valid(row,v,now);let s=sessions.get(row.id);
   if(!s){if(!good||watermarks.has(row.id)&&(row.at<watermarks.get(row.id)||v.quote.quoteAt<=watermarks.get(row.id)))continue;
    if(sessions.size>=20){const victim=[...sessions.keys()].find(id=>!ids.has(id));if(victim===undefined)continue;sessions.delete(victim);}
    const first=snapshot(row,v);s={fixtureId:row.id,startedAt:now,expiresAt:now+TTL,status:'TRACKING',reason:'RESEARCH_REFERENCE',original:first,current:copy(first),tradeReady:false,recommendation:null};sessions.set(row.id,s);continue;}
   const c=row.context||row.model?.condition||{},o=s.original.context;
   if(!Number.isFinite(row.at)||row.at<s.current.at){if(s.status!=='INVALIDATED'){s.status='PAUSED';s.reason='OUT_OF_ORDER';}continue;}
   let reason=null;
   if(c.score&&o.score&&(c.score.home!==o.score.home||c.score.away!==o.score.away))reason='SCORE_CHANGED';
   else if(c.status&&phase(c.status)!==phase(o.status))reason='PHASE_CHANGED';
   else if(Number.isFinite(c.red)&&Number.isFinite(o.red)&&c.red!==o.red)reason='RED_CHANGED';
   else if(c.resetAt>(o.resetAt||0))reason='RESET_REQUIRED';
   else if(v?.quote&&v.quote.quoteAt>=s.current.quote.quoteAt&&key(v.quote)!==key(s.original.quote))reason='CONTRACT_CHANGED';
   else if(v?.result?.rule?.basis&&v.result.rule.basis!==s.original.result.rule?.basis)reason='SETTLEMENT_CHANGED';
   if(reason){s.status='INVALIDATED';s.reason=reason;}
   if(v?.quote?.quoteAt<s.current.quote.quoteAt){if(s.status!=='INVALIDATED'){s.status='PAUSED';s.reason='OUT_OF_ORDER';}continue;}
   if(good)s.current=snapshot(row,v);
   if(s.status!=='INVALIDATED'){s.status=good?'TRACKING':'PAUSED';s.reason=good?'RESEARCH_REFERENCE':v?.result?.status||'QUOTE_MISSING';}
  }
  return rows.map(row=>({...row,session:read(row.id,now)}));
 }
 return Object.freeze({update,read,list:now=>{now=time(now);expire(now);return [...sessions.keys()].map(id=>read(id,now));}});
}
