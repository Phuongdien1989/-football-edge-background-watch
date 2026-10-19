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
  if(!Number.isSafeInteger(id)||id<=0||number(item?.id)!==id||number(f?.fixture?.id)!==id||at===null||at<=0){rejected.push({fixture_id:id,reason:'NO_PUBLISHED_MATCHING_SNAPSHOT'});continue;}
  const raw=u.snapshot||{},source=observed(raw),goals={home:number(f.goals?.home),away:number(f.goals?.away)};
  const mismatch=(source.goals.home!==null&&source.goals.home!==goals.home)||(source.goals.away!==null&&source.goals.away!==goals.away);
  const sourceHealth={stats:health(item.last?.sourceHealth?.stats),events:health(item.last?.sourceHealth?.events)};
  const s={id,at,revision:at,minute:number(f.fixture?.status?.elapsed),status:text(f.fixture?.status?.short,10),home:text(f.teams?.home?.name),away:text(f.teams?.away?.name),league:text(f.league?.name),goals,metrics:source.metrics,history:(item.history||[]).slice(-30).map(observed),statsError:sourceHealth.stats!=='OK'||mismatch,model:null,market:null,sourceHealth,sourceKind:'STORED_PRODUCTION_SNAPSHOT',sourceMismatch:mismatch};
  s.market=marketFromRows(markets(raw.market_rows),s);
  inputs.push(s);controls.push({id,cooldownUntil:Math.max(number(item.cooldown)||0,number(item.h1CooldownUntil)||0),resetAt:number(item.h1ResetAt)||0});
 }
 return {inputs,controls,rejected};
}
export function auditStoredInputs(packet,now){
 const store=createStore();packet.inputs.forEach(s=>store.ingest(s));const rows=store.read(now,{controls:packet.controls});
 return {schema:'FT_OVERVIEW_REAL_INPUT_AUDIT_V1',captured_at:now,source:'PRODUCTION_D1_STORED_ONLY',provider_calls:0,production_writes:0,rows:packet.inputs.length,unique_fixtures:new Set(packet.inputs.map(s=>s.id)).size,top:rows.filter(r=>r.rank&&r.rank<=5).map(r=>({fixture_id:r.id,rank:r.rank,reason:'INPUT_COMPLETENESS_ATTENTION_ONLY'})),matches:rows.map(r=>({fixture_id:r.id,home:r.snapshot.home,away:r.snapshot.away,source_at:r.at,status:r.snapshot.status,minute:r.minute,goals:r.snapshot.goals,metrics:r.snapshot.metrics,source_health:r.snapshot.sourceHealth,source_mismatch:r.snapshot.sourceMismatch,market:r.snapshot.market,entry_now:r.entry,reason:r.reason,model_present:r.modelOK,at_source_time:assess(r.snapshot,r.at).entry,live_action:r.recommendation.action})),rejected:packet.rejected,limits:['STORED_ROWS_MAY_BE_STALE','NO_NEW_PROVIDER_REQUEST','NO_DEEP_HISTORY_IN_THIS_CAPTURE','NO_CALIBRATED_MODEL','NO_LIVE_RECOMMENDATION']};
}
