// Delivery consumes the card models; it does not rank fixtures or tune forecasts.
import {assessHTItem} from '../ht-early-candidate/assess-item.mjs';
import {readLegacy} from '../ft-overview/adapter.mjs';
import {assess} from '../ft-overview/core.mjs';
import {reviewFTDecision} from '../ft-overview/experimental-decision.mjs';
export const POLICY='FE_MECHANISM_NOTIFICATIONS_V1';
export const HOLD_MS=300000;
export const capabilities=()=>({schema:POLICY,ht:'RESEARCH_PRICE',ftOverview:'RESEARCH_PRICE',ftV2:'RESEARCH_PRICE',goalFT:'LEGACY_SIGNAL',hc:'GAP_SIGNAL_ONLY',hcEntry:'NOT_AVAILABLE_NO_VERIFIED_ENTRY_POLICY',groupBy:'DEVICE_FIXTURE',holdMs:HOLD_MS,manualScannerOnly:true});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function mechanismPrefs(p={}) {return {h1:p.h1!==false,ftOverview:p.ftOverview!==false,ftV2:p.ftV2!==false};}
export function anyMechanism(p={}) {return p.enabled!==false&&(p.h1!==false||p.goal!==false||p.gap!==false||p.ftOverview!==false||p.ftV2!==false);}
const summary=r=>({state:r.state??r.entry,action:r.action??r.recommendation?.action,at:r.at,quote:r.quote??null,recommendation:r.recommendation??null,modelVersion:r.model?.version??r.modelVersion??null,reason:r.reasons?.[0]??r.reason??null});
export function evaluateMechanisms({fixture,snapshot,item,htContext,ftBundle,now=Date.now()}) {
 const id=fixture?.fixture?.id,at=snapshot.captured_at;
 const base={id,home:fixture.teams.home.name,away:fixture.teams.away.name,league:fixture.league?.name,latest:{...snapshot,fixture},history:item.history||[],cooldownUntil:item.cooldown||0,resetAt:item.h1ResetAt||0};
 const results={};
 let sharedHT={at:htContext?.at??at,rows:[],source:htContext?.source??null,error:htContext?.error??null};
 try {const ht=assessHTItem({...base,cooldownUntil:item.h1CooldownUntil||0},htContext,now);results.ht=summary(ht);const used=new Set(ht.model?.provenance?.fixtureIds||[]);sharedHT.rows=(htContext?.rows||[]).filter(r=>used.has(r.fixture_id));}catch{results.ht={state:'MODEL_ERROR',action:'WAIT',reason:'HT_EVALUATION_FAILED',at};}
 const bridge={read:()=>({watchState:{items:[base]}})},bundles={read:()=>ftBundle?[ftBundle]:[]};
 for(const [kind,conditionedFT] of [['ftOverview',false],['ftV2',true]])try {
  const s=readLegacy(bridge,bundles,{conditionedFT})[0];
  if(!s)throw Error('NO_SNAPSHOT');s.eventAt=Math.max(item.parityResetAt||0,item.h1ResetAt||0);s.cooldownUntil=Math.max(s.cooldownUntil||0,item.cooldown||0);
  const row=assess(s,now,{trialRecommendations:true}),review=conditionedFT?reviewFTDecision(row):null;
  results[kind]={...summary(row),action:review?.action??row.recommendation.action,reason:review?.reason?.[0]??row.reason};
 }catch{results[kind]={state:'MODEL_ERROR',action:'WAIT',reason:'FT_EVALUATION_FAILED',at};}
 // HC research explicitly has no selected side/tradeReady. Do not invent one.
 results.hc={state:'RESEARCH_ONLY',action:'NO_ENTRY_PUSH',at,reason:'HC_RESEARCH_HAS_NO_VERIFIED_ENTRY_POLICY'};
 return {schema:POLICY,fixtureId:id,observedAt:at,results,context:{schema:POLICY,fixtureId:id,observedAt:at,ht:sharedHT,ftBundle}};
}
export function priceCandidates(packet,prefs,fixture,snapshot) {
 const result=[],g=snapshot.goals,event=[g?.home,g?.away,snapshot.status,snapshot.metrics?.total?.red??null];
 for(const kind of ['ht','ftOverview','ftV2']) {
  if((kind==='ht'?prefs.h1:prefs[kind])===false)continue;
  const r=packet.results[kind],rec=r?.recommendation,q=r?.quote;
  if(r?.action!=='TRIAL_OVER'||!q||!finite(q.ev)||q.ev<=0||!finite(q.fairOdds)||!finite(q.win)||!finite(rec?.line)||!finite(rec?.odds))continue;
  result.push({kind,type:'RESEARCH_RECOMMENDATION',at:packet.observedAt,identity:JSON.stringify([kind,rec.period,rec.basis,rec.line,event]),period:rec.period,line:rec.line,odds:rec.odds,fairOdds:q.fairOdds,winProbability:q.win,ev:q.ev,modelVersion:r.modelVersion});
 }
 return result;
}
export function legacyCandidates(signals,at,snapshot) {
 return ['goal','gap'].filter(k=>signals[k]).map(kind=>({kind,type:'SIGNAL',at,identity:JSON.stringify([kind,snapshot.goals,snapshot.status]),...signals[kind]}));
}
export function planDelivery(previous,candidates,{now,observedAt,results={},legacyLastSent=0}={}) {
 const state=structuredClone(previous||{schema:POLICY,lastAttemptAt:legacyLastSent||0,records:{}});state.records||={};
 const before=JSON.stringify(state),send=[];
 for(const kind of ['ht','ftOverview','ftV2']) {
  const r=results[kind],old=state.records[kind];
  // Only a fresh, genuinely negative price rearms. Missing/stale data is not a crossing.
  if(old&&r?.quote&&r.quote.ev<=0&&r.action==='WAIT_PRICE'&&observedAt>old.observedAt&&now-observedAt>=0&&now-observedAt<=55000)old.armed=true;
 }
 const timeOK=finite(now)&&finite(observedAt)&&observedAt>0&&now>=observedAt&&now-observedAt<=60000;
 if(timeOK&&(!state.lastAttemptAt||now-state.lastAttemptAt>=HOLD_MS))for(const c of candidates) {
  const old=state.records[c.kind];
  if(c.at!==observedAt||c.kind==='ht'&&now-observedAt>55000||old&&observedAt<=old.observedAt)continue;
  if(c.type==='SIGNAL'||!old||old.identity!==c.identity||old.armed||['RESERVED','UNCONFIRMED'].includes(old.deliveryState))send.push(c);
 }
 if(send.length) {
  state.lastAttemptAt=now;state.outcome='RESERVED';state.sourceAt=observedAt;
  state.referenceUntil=now+HOLD_MS;
  for(const c of send)state.records[c.kind]={identity:c.identity,observedAt,armed:false,deliveryState:'RESERVED',reference:structuredClone(c)};
 }
 return {send,state,changed:JSON.stringify(state)!==before};
}
const fmt=n=>n.toFixed(2),pct=n=>(n*100).toFixed(1)+'%';
export function mechanismPayload(f,s,entries,now) {
 const id=f.fixture.id,first=entries.find(x=>x.type==='RESEARCH_RECOMMENDATION')||entries[0];
 const tab=first.kind==='ht'?'ht':first.kind==='ftV2'?'ftv2':first.kind==='gap'?'hc':first.kind==='goal'?'ft':'valuation';
 const labels={ht:'HT',ftOverview:'FT Overview',ftV2:'FT AI V2',goal:'Goal FT',gap:'HC GAP'};
 const text=x=>String(x??'').slice(0,64);
 const lines=entries.map(c=>c.type==='SIGNAL'?`${labels[c.kind]} · TÍN HIỆU ${text(c.actual??Math.round(c.value))} ≥ ${c.threshold}; chưa phải giá vào`:`${labels[c.kind]} · Tài ${c.line} @${fmt(c.odds)} · P thắng đủ ${pct(c.winProbability)} · Fair ${fmt(c.fairOdds)} · EV ${pct(c.ev)} · thử nghiệm`);
 const signals=Object.fromEntries(entries.filter(x=>x.type==='SIGNAL').map(c=>[c.kind,{value:c.value,threshold:c.threshold,actual:c.actual==null?undefined:text(c.actual),source:c.source==null?undefined:text(c.source)}]));
 const payload={title:'Football Edge · '+entries.map(x=>labels[x.kind]).join(' / '),body:`${text(f.teams.home.name)} – ${text(f.teams.away.name)} | ${s.minute}′ | ${s.goals.home}-${s.goals.away}\n${text(f.league?.name)}\n${lines.join('\n')}`,url:`https://shiny-silence-d892.ngophuonghuy.workers.dev/?fe_fixture=${id}&fe_mode=${first.kind==='ht'?'H1':first.kind==='gap'?'HC':'FT'}#fe-tabs/${tab}/${id}`,tag:'fe-mechanism-'+id,created_at:now,fixture_id:id,fe_mode:first.kind==='ht'?'H1':first.kind==='gap'?'HC':'FT',schema:POLICY,signals,recommendations:entries.filter(x=>x.type==='RESEARCH_RECOMMENDATION').map(({identity,...r})=>r)};
 if(new TextEncoder().encode(JSON.stringify(payload)).length>3500){payload.body=payload.body.slice(0,700);payload.recommendations=payload.recommendations.map(r=>({kind:r.kind,at:r.at,line:r.line,odds:r.odds,ev:r.ev}));}
 return payload;
}
