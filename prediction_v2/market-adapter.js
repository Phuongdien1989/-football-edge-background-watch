/* FOOTBALL EDGE — Prediction V2 / B4 + Batch 02 market identity
 * Extracts actual supported offers without inventing lines.
 * Batch 02 preserves FT/H1/H2 identity and provenance. Strict callers may reject
 * unknown-period, stale, suspended, or post-cutoff markets before pricing.
 */
import {normalizeMarketPeriod,timestampIso,timestampMs,STRICT_VALID,UNKNOWN_PROVENANCE,AFTER_CUTOFF} from './observation-contract.js';
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const text=v=>String(v??'').trim();
function lineFrom(v){const h=finite(v?.handicap);if(h!=null)return h;const m=text(v?.value).match(/[-+]?\d+(?:\.\d+)?/);return m?Number(m[0]):null}
function sideFromValue(v,market){
  const s=text(v?.value).toUpperCase();
  if(market==='TOTAL')return /OVER|TÀI|TAI/.test(s)?'OVER':/UNDER|XỈU|XIU/.test(s)?'UNDER':null;
  if(market==='ASIAN_HANDICAP'){
    const explicit=String(v?.selection_side??v?.selection_outcome??'').toUpperCase();if(explicit==='HOME')return 'HOME';if(explicit==='AWAY')return 'AWAY';
    return /HOME|1\b|CHỦ|CHU/.test(s)?'HOME':/AWAY|2\b|KHÁCH|KHACH/.test(s)?'AWAY':null;
  }
  return null;
}
export function marketType(row){
  const c=text(row?.category).toLowerCase(),n=text(row?.market??row?.bet).toLowerCase();
  if(c==='over_under'||/over.?under|total goals|asian total/.test(n))return 'TOTAL';
  if(c==='asian_handicap'||/asian handicap|handicap/.test(n))return 'ASIAN_HANDICAP';
  return null;
}
export function marketPeriod(row){
  for(const v of [row?.market_period,row?.period,row?.scope,row?.segment,row?.half]){const p=normalizeMarketPeriod(v);if(p)return {period:p,source:'EXPLICIT_FIELD'}}
  const n=text(row?.market??row?.bet??row?.name).toUpperCase();
  if(/FIRST\s*HALF|1ST\s*HALF|\bH1\b|\b1H\b/.test(n))return {period:'H1',source:'MARKET_NAME'};
  if(/SECOND\s*HALF|2ND\s*HALF|\bH2\b|\b2H\b/.test(n))return {period:'H2',source:'MARKET_NAME'};
  if(/FULL\s*TIME|FULLTIME|90\s*MIN|MATCH\s*(?:TOTAL|HANDICAP)/.test(n))return {period:'FT',source:'MARKET_NAME'};
  if(/^(GOALS?\s+OVER\/UNDER|ASIAN\s+HANDICAP|ASIAN\s+TOTAL|TOTAL\s+GOALS?)$/i.test(n))return {period:'FT',source:'PROVIDER_BASE_MARKET_CONVENTION'};
  return {period:null,source:'UNKNOWN'};
}
function marketStatus(row,v){
  const st=row?.feed_status||row?.status||{};
  if(row?.integrity?.valid===false)return 'INVALID';
  if(st.blocked||st.stopped||st.finished||v?.suspended)return 'SUSPENDED';
  return 'OPEN';
}
function marketTimes(row,v){
  const provider=timestampIso(v?.provider_updated_at??v?.update??row?.provider_updated_at??row?.update),
    received=timestampIso(v?.received_at??row?.received_at??row?.__received_at);
  return {provider_updated_at:provider,received_at:received};
}
export function assessMarketAvailability(offer,{evaluationCutoff=null,maxAgeMs=null,targetPeriod=null,strict=false}={}){
  const reasons=[],cut=timestampMs(evaluationCutoff),recv=timestampMs(offer?.received_at),provider=timestampMs(offer?.provider_updated_at),
    period=normalizeMarketPeriod(offer?.market_period),target=normalizeMarketPeriod(targetPeriod);
  if(offer?.market_status!=='OPEN')reasons.push('MARKET_NOT_OPEN');
  if(!period)reasons.push('UNKNOWN_PERIOD');
  if(target&&period&&target!==period)reasons.push('PERIOD_MISMATCH');
  let provenance=recv==null?UNKNOWN_PROVENANCE:(cut!=null&&recv>cut?AFTER_CUTOFF:STRICT_VALID);
  if(strict&&provenance!==STRICT_VALID)reasons.push(provenance);
  const freshnessBase=provider??recv,age=(cut!=null&&freshnessBase!=null)?Math.max(0,cut-freshnessBase):null;
  if(maxAgeMs!=null&&age!=null&&age>Number(maxAgeMs))reasons.push('STALE_MARKET');
  if(strict&&maxAgeMs!=null&&age==null)reasons.push('UNKNOWN_MARKET_AGE');
  return {eligible:reasons.length===0,reasons,provenance_status:provenance,freshness_age_ms:age};
}
export function extractActualOffersDetailed(rows=[],options={}){
  const offers=[],rejected=[];
  for(const row of rows||[]){
    const mt=marketType(row);if(!mt)continue;const per=marketPeriod(row);
    for(const v of row?.values||[]){
      const odds=finite(v?.odd),line=lineFrom(v),selection=sideFromValue(v,mt),status=marketStatus(row,v),times=marketTimes(row,v);
      const base={market:mt,market_period:per.period,market_period_source:per.source,selection,line,odds,main:v?.main===true,
        bookmaker:row?.bookmaker||null,source:row?.source||row?.provider||'API_FOOTBALL',market_name:row?.market||row?.bet||null,
        source_value:v?.value||null,market_status:status,...times};
      if(odds==null||odds<=1||line==null||!selection){rejected.push({...base,rejection_reasons:['INVALID_LINE_ODDS_OR_SELECTION']});continue}
      const availability=assessMarketAvailability(base,options),full={...base,...availability};
      if(availability.eligible)offers.push(full);else rejected.push({...full,rejection_reasons:availability.reasons});
    }
  }
  const key=o=>[o.market,o.market_period||'UNKNOWN',o.line,o.bookmaker||'',o.selection].join('|'),map=new Map();
  for(const o of offers){const k=key(o),p=map.get(k);if(!p||Number(o.main)>Number(p.main))map.set(k,o)}
  return {offers:[...map.values()],rejected,policy:{strict:options?.strict===true,target_period:normalizeMarketPeriod(options?.targetPeriod),max_age_ms:finite(options?.maxAgeMs),validated:false}};
}
export function extractActualOffers(rows=[],options={}){return extractActualOffersDetailed(rows,options).offers}
export function pairTwoWayOffers(offers=[]){
  const groups=new Map();for(const o of offers){const k=[o.market,o.market_period||'UNKNOWN',o.line,o.bookmaker||''].join('|');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o)}
  const out=[];for(const [key,rows] of groups){const a=rows.find(x=>x.selection==='OVER'||x.selection==='HOME'),b=rows.find(x=>x.selection==='UNDER'||x.selection==='AWAY');
    out.push({key,market:rows[0]?.market,market_period:rows[0]?.market_period,line:rows[0]?.line,bookmaker:rows[0]?.bookmaker,a:a||null,b:b||null})}
  return out;
}