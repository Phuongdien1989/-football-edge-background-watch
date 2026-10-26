// Detached observations and existing HC conclusions. Never fits a probability.
const number=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const side=x=>Object.fromEntries(['shots','sot','inbox','xg','corners','possession','red'].map(k=>[k,number(x?.[k])]));
export function readHCLiveEvidence(item,now){
 const s=item?.latest||{},e=item?.eval||{},h=side(s.metrics?.home),a=side(s.metrics?.away),at=number(s.fresh_at)??number(s.captured_at),gap=number(e.states?.liveGap),pre=number(e.states?.preAdv),q=s.market?.quotes?.[0]||s.market;
 const available=['shots','sot','inbox','xg','corners','possession'].filter(k=>h[k]!==null&&a[k]!==null),fresh=at!==null&&at<=now+5000&&now-at<=60000;
 // These are the existing engine's exact labels, not new fitted cutoffs.
 const dataDirection=gap===null?'UNKNOWN':Math.abs(gap)<10?'BALANCED':gap>0?'HOME':'AWAY';
 const marketDirection=q?.sourceQuote===true&&typeof q.line==='number'&&Number.isFinite(q.line)?q.line<0?'HOME_GIVES':q.line>0?'AWAY_GIVES':'LEVEL':'UNKNOWN';
 return {at,fresh,home:h,away:a,available,missing:available.length===0,liveGap:gap,preAdv:pre,dataDirection,marketDirection,
  dataTier:e.dataTier||s.metrics?.dataTier||'UNKNOWN',dq:number(e.dq),core:number(e.core?.count),footballCore:number(e.core?.footballCount),
  homeTrend:e.homeTrend?{trend:e.homeTrend.trend,i3:number(e.homeTrend.i3),i5:number(e.homeTrend.i5),i10:number(e.homeTrend.i10)}:null,
  awayTrend:e.awayTrend?{trend:e.awayTrend.trend,i3:number(e.awayTrend.i3),i5:number(e.awayTrend.i5),i10:number(e.awayTrend.i10)}:null,
  marketFit:e.marketFit?{level:e.marketFit.level,lineMove:e.marketFit.lineMove,priceMove:e.marketFit.priceMove,velocity:e.marketFit.velocity}:null,
  legacyState:e.state||null,legacyRecommendation:e.recommendation||null,probabilityAdjusted:false,
  scope:'EXISTING_HC_ANALYTICS_NOT_CALIBRATED_COVER_PROBABILITY'};
}
export function hcReadiness(row){
 const blockers=['LIVE_PROBABILITY_UNCALIBRATED'];
 if(!row.model)blockers.push('MODEL_CONTEXT_MISSING');
 if(!row.liveEvidence?.fresh)blockers.push('LIVE_STATS_STALE_OR_MISSING');
 if(row.liveEvidence?.missing!==false)blockers.push('LIVE_TEAM_STATS_MISSING');
 if(!row.valuations?.length)blockers.push('SOURCE_QUOTE_MISSING');
 if(!row.valuations?.some(v=>v.result.status==='RESEARCH_PRICED'))blockers.push('SOURCE_SETTLEMENT_OR_QUOTE_NOT_VERIFIED');
 return {fixtureId:row.id,blockers,tradeReady:false,productionReady:false,probabilityScope:'HISTORY_SCORE_REGULATION_TIME_ONLY',liveEvidenceScope:'LEGACY_DESCRIPTIVE_ONLY'};
}
