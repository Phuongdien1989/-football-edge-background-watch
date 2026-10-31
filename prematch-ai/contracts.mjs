// PRE-MATCH V1: pure contracts. No provider, storage, DOM or LIVE state access.
export const SCHEMA='FE_PREMATCH_V1';
export const MODEL='PM_TEAM_RATE_V1';
export const n=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
export const count=x=>Number.isSafeInteger(x)&&x>=0;
export const time=x=>Number.isSafeInteger(x)&&x>0;
export function requireValue(ok,reason){if(!ok)throw Error(reason);}
export function canonical(x){if(x===undefined)throw Error('UNDEFINED_CANONICAL_VALUE');return JSON.stringify(sort(x));}
function sort(x){if(Array.isArray(x))return x.map(sort);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])]));if(typeof x==='number'&&!Number.isFinite(x))throw Error('NONFINITE_VALUE');return x;}
export async function digest(x){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(x)));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
export const omitHash=x=>Object.fromEntries(Object.entries(x).filter(([k])=>k!=='hash'));
export function fixtureOK(f){return f&&Number.isSafeInteger(f.id)&&f.id>0&&time(f.kickoff)&&time(f.observedAt)&&f.observedAt<f.kickoff&&Number.isSafeInteger(f.home?.id)&&f.home.id>0&&Number.isSafeInteger(f.away?.id)&&f.away.id>0&&f.home.id!==f.away.id&&Number.isSafeInteger(f.league?.id)&&f.league.id>0&&['REAL','LAB'].includes(f.kind);}
export function marketKey(q){return canonical({fixtureId:q.fixtureId,source:q.source,bookmaker:q.bookmaker,marketId:q.marketId,period:q.period,type:q.type,selection:q.selection,line:q.line??null,basis:q.basis});}
export function safeInput(raw){
 requireValue(raw?.schema===SCHEMA,'INPUT_SCHEMA_REQUIRED');requireValue(Array.isArray(raw.fixtures)&&raw.fixtures.length<=100,'FIXTURE_LIMIT_100');
 requireValue(Array.isArray(raw.artifacts)&&raw.artifacts.length<=10,'ARTIFACT_LIMIT_10');
 const fs=raw.fixtures.map(f=>{requireValue(fixtureOK(f),'INVALID_FIXTURE');const team=t=>({id:t.id,name:typeof t.name==='string'?t.name.slice(0,160):'Chưa có tên đội'});return {id:f.id,kind:f.kind,status:f.status,observedAt:f.observedAt,kickoff:f.kickoff,home:team(f.home),away:team(f.away),league:{id:f.league.id,name:typeof f.league.name==='string'?f.league.name.slice(0,160):'Chưa có tên giải'},neutralVenue:f.neutralVenue===true};});
 requireValue(new Set(fs.map(f=>f.id)).size===fs.length,'DUPLICATE_FIXTURE');
 const rawQuotes=Array.isArray(raw.quotes)?raw.quotes:[];requireValue(rawQuotes.length<=2000,'QUOTE_LIMIT_2000');const fields=['fixtureId','source','bookmaker','marketId','period','type','selection','line','odds','basis','ruleStatus','ruleReference','receivedAt','sourceUpdatedAt','availability','checkedAt','validUntil','suspended'];const quotes=rawQuotes.map(q=>{requireValue(q&&typeof q==='object','INVALID_QUOTE_ROW');return Object.fromEntries(fields.filter(k=>q[k]!==undefined).map(k=>[k,q[k]]));});
 // Whitelist: credentials/config and arbitrary host globals are never retained.
 return {schema:SCHEMA,fixtures:fs,artifacts:structuredClone(raw.artifacts),quotes:structuredClone(quotes),evidence:Array.isArray(raw.evidence)?structuredClone(raw.evidence).slice(0,500):[],label:typeof raw.label==='string'?raw.label.slice(0,200):null};
}
export function adaptDeep(b,{kind='REAL'}={}){
 const m=b?.meta,f=m?.fixture,t=m?.teams,at=b?.observed_at;
 requireValue(time(at)&&Number.isSafeInteger(f?.timestamp),'DEEP_RECEIPT_REQUIRED');
 const fixture={id:m.fixture_id,kind,home:t.home,away:t.away,league:m.league,kickoff:f.timestamp*1000,observedAt:at,status:f.status?.short};
 requireValue(fixtureOK(fixture),'INVALID_DEEP_FIXTURE');
 return {schema:SCHEMA,fixtures:[fixture],artifacts:[],quotes:[],evidence:[{id:'deep:'+m.fixture_id,kind:'FACT',receivedAt:at,topic:'history',text:'Đã nhận DEEP bundle; cần artifact mô hình và contract PRE rõ ràng. Không tự chuyển API prediction thành dự báo riêng.'}],label:'DEEP import — chưa có artifact/quote contract'};
}
