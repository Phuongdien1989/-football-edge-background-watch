import {canonical,digest,time,marketKey} from './contracts.mjs';
import {settleScore} from './pricing.mjs';
export async function preparePair(row){
 if(!row.forecast)throw Error('FORECAST_REQUIRED');
 const payload={schema:'FE_PREMATCH_PAIR_V1',fixture:row.fixture,forecast:row.forecast,evaluations:row.evaluations,topId:row.top?.id??null,policy:'PM_TRIAL_EV_MODEL_VARIATION_V1'};
 return {id:await digest(payload),hash:await digest(payload),payload};
}
export async function verifyRecord(record){return !!record?.payload&&record.id===record.hash&&record.hash===await digest(record.payload);}
export async function openLedger(indexedDB=globalThis.indexedDB){
 if(!indexedDB)throw Error('LOCAL_LEDGER_UNAVAILABLE');
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('fe_prematch_ai_v1',1);r.onupgradeneeded=()=>{r.result.createObjectStore('records',{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('LOCAL_LEDGER_UNAVAILABLE'));});
 return {async append(record){if(!await verifyRecord(record))throw Error('RECORD_HASH_INVALID');return new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite'),store=tx.objectStore('records'),get=store.get(record.id);let duplicate=false;get.onsuccess=()=>{if(get.result){if(canonical(get.result)!==canonical(record)){tx.abort();return;}duplicate=true;}else store.add(record);};tx.oncomplete=()=>resolve({duplicate});tx.onabort=()=>reject(Error('IMMUTABLE_RECORD_CONFLICT'));tx.onerror=()=>reject(Error('LEDGER_WRITE_FAILED'));});},async all(){return new Promise((resolve,reject)=>{const r=db.transaction('records').objectStore('records').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('LEDGER_READ_FAILED'));});},close(){db.close();}};
}
export function validateCohort(pairs,outcomes,{closingQuotes=[]}={}){
 const forecastRows=[],entries=[],excluded=[],seen=new Set();
 // Fixed FIRST_FORECAST policy per fixture; no retrospective best-of revisions.
 const ordered=[...pairs].sort((a,b)=>a.forecast.cutoff-b.forecast.cutoff||a.forecast.id.localeCompare(b.forecast.id));
 for(const r of ordered){const f=r.forecast;if(seen.has(f.fixtureId))continue;seen.add(f.fixtureId);
  const os=outcomes.filter(o=>o.fixtureId===f.fixtureId&&o.verified===true&&time(o.recordedAt)&&o.recordedAt>=f.kickoff).sort((a,b)=>a.recordedAt-b.recordedAt||String(a.revision).localeCompare(String(b.revision)));
  const o=os.at(-1),score=o?.regulation;
  if(!o||!['FT','AET','PEN'].includes(o.status)||![score?.home,score?.away].every(x=>Number.isSafeInteger(x)&&x>=0)){excluded.push({fixtureId:f.fixtureId,reason:'VERIFIED_REGULATION_OUTCOME_REQUIRED'});continue;}
  const actual=score.home>score.away?'HOME':score.home<score.away?'AWAY':'DRAW',p=f.summary.FT.wdl;
  const brier=Object.keys(p).reduce((s,k)=>s+(p[k]-Number(k===actual))**2,0),ll=-Math.log(Math.max(1e-15,p[actual]));
  forecastRows.push({fixtureId:f.fixtureId,leagueId:r.fixture.league.id,actual,probabilities:p,brier,logLoss:ll,synthetic:f.synthetic});
  const e=r.evaluations.find(e=>e.id===r.topId);if(!e||e.status!=='OPEN_TRIAL')continue;
  const s=e.quote.period==='HT'?o.halftime:score;if(!s||![s.home,s.away].every(x=>Number.isSafeInteger(x)&&x>=0)){excluded.push({fixtureId:f.fixtureId,reason:'PERIOD_OUTCOME_MISSING'});continue;}
  const result=settleScore(e.quote,s.home,s.away),net=result>0?result*(e.quote.odds-1):result;
  const closing=closingQuotes.filter(q=>marketKey(q)===marketKey(e.quote)&&time(q.receivedAt)&&q.receivedAt>=e.quote.receivedAt&&q.receivedAt<f.kickoff&&typeof q.odds==='number'&&q.odds>1).sort((a,b)=>b.receivedAt-a.receivedAt)[0];
  entries.push({fixtureId:f.fixtureId,market:e.quote.type,period:e.quote.period,result,netUnits:net,estimatedEV:e.price.ev,clvSameContractPriceRatio:closing?e.quote.odds/closing.odds-1:null});
 }
 const avg=(a,k)=>a.length?a.reduce((s,r)=>s+r[k],0)/a.length:null;
 return {schema:'FE_PREMATCH_VALIDATION_V1',selectionPolicy:'FIRST_FORECAST_PER_FIXTURE',forecasts:forecastRows.length,entries:entries.length,brier:avg(forecastRows,'brier'),logLoss:avg(forecastRows,'logLoss'),roi:avg(entries,'netUnits'),realizedUnits:entries.reduce((s,e)=>s+e.netUnits,0),forecastRows,entryRows:entries,excluded,calibrated:false,claim:'EXPLORATORY_ONLY_NO_PROFITABILITY_CERTIFICATION'};
}
