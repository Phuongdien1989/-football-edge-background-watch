// Adapter for existing HT snapshots. Does not fetch, estimate a PMF or alter input.
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&/^\d+(?:\.\d+)?$/.test(v)?Number(v):null;
function quoteTime(v) {
  if(v==null)return null;
  const n=num(v);
  if(n!==null)return n<1e12?n*1000:n;
  const t=typeof v==='string'?Date.parse(v):NaN;
  return Number.isFinite(t)?t:null;
}
export function htMarketLadder(item) {
  const s=item?.latest||{},result=[];
  const receipt=num(s.market_at)??num(item?.lastMarketAt);
  for(const row of s.market_rows||[]) {
    if(row.category!=='h1_total'||row.integrity?.valid===false||row.status?.blocked||row.status?.stopped||row.status?.finished||row.feed_status?.blocked||row.feed_status?.stopped||row.feed_status?.finished)continue;
    const at=row.update==null?receipt:quoteTime(row.update);
    // Never substitute the statistics timestamp for a missing market timestamp.
    if(at===null)continue;
    const pairs=new Map();
    for(const v of row.values||[]) {
      if(v.suspended)continue;
      const label=String(v.value||''),side=/^over\b|^tài\b|^tai\b/i.test(label)?'over':/^under\b|^xỉu\b|^xiu\b/i.test(label)?'under':null;
      const line=num(v.handicap),odd=num(v.odd);
      if(!side||line===null||line<0||odd===null||odd<=1||Math.abs(line*4-Math.round(line*4))>1e-8)continue;
      const pair=pairs.get(line)||{line};
      // Conflicting duplicate prices from one row are ambiguous; exclude the pair.
      if(pair[side]!=null&&pair[side]!==odd)pair.conflict=true;
      pair[side]=odd;pairs.set(line,pair);
    }
    for(const pair of pairs.values())if(!pair.conflict&&pair.over>1)result.push({...pair,period:'H1',basis:'FIRST_HALF_TOTAL',
      bookmaker:row.bookmaker?.name||(typeof row.bookmaker==='string'?row.bookmaker:null)||'API_FOOTBALL_LIVE_FEED',
      at,timestampBasis:row.update==null?'MARKET_RECEIPT':'PROVIDER_UPDATE',score:{...s.goals}});
  }
  return result;
}
export function snapshotForHT(item,{model=null}={}) {
  const s=item?.latest||{},p=s.stats_presence||{},t=s.metrics?.total||{};
  const hasStats=['shots','sot','inbox','corners','xg'].some(k=>p[k]===true&&num(t[k])!==null);
  return {id:Number(item?.id),at:num(s.fresh_at),minute:num(s.minute),status:s.status,periodConfirmed:s.period_confirmed??null,
    goals:{home:num(s.goals?.home),away:num(s.goals?.away)},statsError:!hasStats||s.data_health?.level==='NO_STATS',
    cooldownUntil:num(item?.cooldownUntil),resetAt:num(item?.resetAt),model,market:null};
}
