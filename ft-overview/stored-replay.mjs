import {number,assess,createStore} from './core.mjs';
import {marketFromRows} from './adapter.mjs';
const text=(v,max=100)=>typeof v==='string'?v.slice(0,max):'';
const health=v=>['OK','EMPTY','ERROR','UNAVAILABLE'].includes(v)?v:'UNKNOWN';
function observed(raw={}){
 const p=raw.stats_presence||{},m=raw.metrics?.total||{};
 return {at:number(raw.captured_at),goals:{home:number(raw.goals?.home),away:number(raw.goals?.away)},metrics:Object.fromEntries(['shots','sot','inbox','xg'].map(k=>[k,p[k]===true?number(m[k]):null]))};
}
function markets(rows){return (Array.isArray(rows)?rows:[]).filter(r=>r.category==='over_under').slice(0,20).map(r=>({category:'over_under',main_line:number(r.main_line),bookmaker:text(r.bookmaker?.name||r.bookmaker),update:typeof r.update==='string'?text(r.update):number(r.update),integrity:{valid:r.integrity?.valid!==false},status:{blocked:!!r.status?.blocked,stopped:!!r.status?.stopped,finished:!!r.status?.finished},feed_status:{blocked:!!r.feed_status?.blocked,stopped:!!r.feed_status?.stopped,finished:!!r.feed_status?.finished},values:(r.values||[]).slice(0,60).map(v=>({value:text(v.value),handicap:number(v.handicap),odd:number(v.odd),suspended:!!v.suspended}))}));}
// Explicit football-only whitelist. Never export stored devices, subscription
// endpoints, headers, tokens, preferences or the original D1 payload.
export function storedRowsToInputs(rows){
 const inputs=[],controls=[],rejected=[];
 for(const row of rows){
  let item;try{item=typeof row.payload==='string'?JSON.parse(row.payload):row.payload;}catch{rejected.push({reason:'INVALID_JSON'});continue;}
  if(item?.__fe_deleted===true)continue;
  const u=item?.ui,f=u?.fixture,id=number(row.fixture_id),at=number(u?.captured_at);
  const invalid=!Number.isSafeInteger(id)||id<=0?'INVALID_FIXTURE_ID':!u?'NO_PUBLISHED_SNAPSHOT':number(item?.id)!==id?'STORED_ID_MISMATCH':number(f?.fixture?.id)!==id?'PUBLISHED_FIXTURE_MISMATCH':at===null||at<=0?'NO_SOURCE_TIMESTAMP':null;
  if(invalid){rejected.push({fixture_id:id,reason:invalid});continue;}
  const raw=u.snapshot||{},source=observed(raw),goals={home:number(f.goals?.home),away:number(f.goals?.away)};
  const mismatch=(source.goals.home!==null&&source.goals.home!==goals.home)||(source.goals.away!==null&&source.goals.away!==goals.away);
  const sourceHealth={stats:health(item.last?.sourceHealth?.stats),events:health(item.last?.sourceHealth?.events)};
  const s={id,at,revision:at,minute:number(f.fixture?.status?.elapsed),status:text(f.fixture?.status?.short,10),home:text(f.teams?.home?.name),away:text(f.teams?.away?.name),league:text(f.league?.name),goals,metrics:source.metrics,history:(item.history||[]).slice(-30).map(observed),statsError:sourceHealth.stats!=='OK'||mismatch,model:null,market:null,sourceHealth,sourceKind:'STORED_PRODUCTION_SNAPSHOT',sourceMismatch:mismatch};
  s.market=marketFromRows(markets(raw.market_rows),s);
  inputs.push(s);controls.push({id,cooldownUntil:Math.max(number(item.cooldown)||0,number(item.h1CooldownUntil)||0),resetAt:number(item.h1ResetAt)||0});
 }
 return {inputs,controls,rejected};
}
export function sourceDetailRowsToInputs(rows,engine){
 const packet={inputs:[],controls:[],rejected:[]},byId=new Map();
 for(const row of rows){try{
  const p=JSON.parse(row.payload_json),f=p.fixture;
  if(number(f?.fixture?.id)!==number(row.fixture_id)){packet.rejected.push({fixture_id:number(row.fixture_id),reason:'SOURCE_FIXTURE_MISMATCH'});continue;}
  const sm=engine.statMap(p.stats_raw||[]),presence=engine.watchStatsPresence(sm,f),at=number(row.captured_at);
  const normalized=engine.normalizeLiveMarkets(p.odds_raw||[],{homeName:f.teams?.home?.name,awayName:f.teams?.away?.name});
  const item={id:number(row.fixture_id),last:{sourceHealth:{stats:p.source_health?.stats??(presence.core===true?'OK':'UNAVAILABLE'),events:p.source_health?.events}},ui:{captured_at:at,fixture:f,snapshot:{captured_at:at,goals:f.goals,metrics:engine.watchAggregate(sm,f),stats_presence:presence,market_rows:normalized}}};
  const parsed=storedRowsToInputs([{fixture_id:row.fixture_id,payload:item}]);packet.rejected.push(...parsed.rejected);
  for(const s of parsed.inputs){s.sourceKind='STORED_SOURCE_DETAIL_NORMALIZED';s.sourceHealthBasis=p.source_health?'STORED_HEALTH':'STORED_STATS_PRESENCE';
   if((number(row.score_home)!==null&&number(row.score_home)!==s.goals.home)||(number(row.score_away)!==null&&number(row.score_away)!==s.goals.away)){s.sourceMismatch=true;s.statsError=true;}
   const old=byId.get(s.id);if(!old)byId.set(s.id,s);else if(s.at>old.at){s.history=[...old.history,{at:old.at,goals:old.goals,metrics:old.metrics}];byId.set(s.id,s);}else old.history.push({at:s.at,goals:s.goals,metrics:s.metrics});
  }
 }catch{packet.rejected.push({fixture_id:number(row.fixture_id),reason:'SOURCE_NORMALIZATION_FAILED'});}}
 packet.inputs=[...byId.values()];return packet;
}
export function auditStoredInputs(packet,now){
 const store=createStore();packet.inputs.forEach(s=>store.ingest(s));const rows=store.read(now,{controls:packet.controls});
 return {schema:'FT_OVERVIEW_REAL_INPUT_AUDIT_V1',captured_at:now,source:'PRODUCTION_D1_STORED_ONLY',provider_calls:0,production_writes:0,rows:packet.inputs.length,unique_fixtures:new Set(packet.inputs.map(s=>s.id)).size,top:rows.filter(r=>r.rank&&r.rank<=5).map(r=>({fixture_id:r.id,rank:r.rank,reason:'INPUT_COMPLETENESS_ATTENTION_ONLY'})),matches:rows.map(r=>({fixture_id:r.id,home:r.snapshot.home,away:r.snapshot.away,source_at:r.at,source_kind:r.snapshot.sourceKind,source_health_basis:r.snapshot.sourceHealthBasis||'STORED_HEALTH',status:r.snapshot.status,minute:r.minute,goals:r.snapshot.goals,metrics:r.snapshot.metrics,source_health:r.snapshot.sourceHealth,source_mismatch:r.snapshot.sourceMismatch,market:r.snapshot.market,entry_now:r.entry,reason:r.reason,model_present:r.modelOK,at_source_time:assess(r.snapshot,r.at).entry,live_action:r.recommendation.action})),rejected:packet.rejected,limits:['STORED_ROWS_MAY_BE_STALE','NO_NEW_PROVIDER_REQUEST','NO_DEEP_HISTORY_IN_THIS_CAPTURE','NO_CALIBRATED_MODEL','NO_LIVE_RECOMMENDATION']};
}
